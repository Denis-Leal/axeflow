"""
gira_service.py — AxeFlow
Serviço de gestão de giras.

Soft delete: giras nunca são apagadas fisicamente.
deleted_at preenchido = gira "deletada" — todas as queries filtram deleted_at IS NULL.

IMPORTANTE sobre total_inscritos:
  Para giras PÚBLICAS → conta apenas inscrições de consulentes (consulente_id IS NOT NULL).
  Para giras FECHADAS → conta apenas inscrições de membros (membro_id IS NOT NULL).
  As duas categorias usam pools de vagas distintos e não se misturam.

ALTERAÇÃO em update_gira:
  Quando limite_consulentes aumenta, chama promover_fila_em_lote() para promover
  automaticamente as pessoas da lista de espera que agora cabem nas vagas novas.
  A lista de promovidos é retornada na resposta para o frontend abrir os WhatsApps.
"""
from sqlalchemy.orm import Session
from fastapi import HTTPException
from uuid import UUID
from app.models.gira import Gira
from app.models.usuario import Usuario
from app.models.inscricao import InscricaoGira
from app.schemas.gira_schema import GiraCreate, GiraUpdate, GiraResponse, GiraUpdateResponse, PromovdoFila
from app.utils.slug import generate_gira_slug
from app.services.push_service import send_push_to_terreiro
from app.services.inscricao_service import promover_fila_em_lote
from datetime import datetime


def _count_inscritos(db: Session, gira: Gira) -> int:
    """
    Conta inscrições ativas de acordo com o tipo de acesso da gira.

    Públicas  → consulentes externos (consulente_id IS NOT NULL)
    Fechadas  → membros do terreiro (membro_id IS NOT NULL)

    Garante que confirmação de membros não afeta vagas de consulentes.
    """
    if gira.acesso == "fechada":
        return db.query(InscricaoGira).filter(
            InscricaoGira.gira_id == gira.id,
            InscricaoGira.membro_id.isnot(None),
            InscricaoGira.status != "cancelado",
        ).count()
    else:
        return db.query(InscricaoGira).filter(
            InscricaoGira.gira_id == gira.id,
            InscricaoGira.consulente_id.isnot(None),
            InscricaoGira.status != "cancelado",
        ).count()


def _enrich(gira: Gira, db: Session, total_inscritos: int = 0) -> GiraResponse:
    """Converte Gira em GiraResponse com nome do responsável e total de inscritos."""
    r = GiraResponse.model_validate(gira)
    r.total_inscritos = total_inscritos
    if gira.responsavel_lista_id:
        resp = db.query(Usuario).filter(Usuario.id == gira.responsavel_lista_id).first()
        r.responsavel_lista_nome = resp.nome if resp else None
    return r


def list_giras(db: Session, terreiro_id: UUID):
    """Lista giras ativas (não deletadas) do terreiro, ordenadas por data desc."""
    giras = (
        db.query(Gira)
        .filter(
            Gira.terreiro_id == terreiro_id,
            Gira.deleted_at.is_(None),
        )
        .order_by(Gira.data.desc())
        .all()
    )
    return [_enrich(g, db, _count_inscritos(db, g)) for g in giras]


def create_gira(db: Session, data: GiraCreate, user: Usuario) -> GiraResponse:
    """Cria nova gira. Giras públicas recebem slug único com hash."""
    is_publica = data.acesso != "fechada"
    slug = generate_gira_slug(data.titulo, data.data) if is_publica else None

    gira = Gira(
        terreiro_id=user.terreiro_id,
        titulo=data.titulo,
        tipo=data.tipo,
        acesso=data.acesso,
        data=data.data,
        horario=data.horario,
        limite_consulentes=data.limite_consulentes,
        limite_membros=data.limite_membros if not is_publica else None,
        abertura_lista=data.abertura_lista if is_publica else None,
        fechamento_lista=data.fechamento_lista if is_publica else None,
        responsavel_lista_id=data.responsavel_lista_id,
        slug_publico=slug,
    )
    db.add(gira)
    db.commit()
    db.refresh(gira)

    data_fmt    = gira.data.strftime("%d/%m/%Y")
    horario_fmt = gira.horario.strftime("%H:%M")
    acesso_label = "pública" if is_publica else "fechada (membros)"
    send_push_to_terreiro(
        terreiro_id=gira.terreiro_id,
        title="✦ Nova Gira Criada",
        body=f"{gira.titulo} ({acesso_label}) — {data_fmt} às {horario_fmt}",
        url=f"/giras/{gira.id}",
    )

    return _enrich(gira, db, 0)


def get_gira(db: Session, gira_id: UUID, terreiro_id: UUID) -> GiraResponse:
    """Busca gira por ID. Retorna 404 para giras deletadas."""
    gira = db.query(Gira).filter(
        Gira.id == gira_id,
        Gira.terreiro_id == terreiro_id,
        Gira.deleted_at.is_(None),
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")
    return _enrich(gira, db, _count_inscritos(db, gira))


def update_gira(db: Session, gira_id: UUID, data: GiraUpdate, terreiro_id: UUID) -> GiraResponse:
    """
    Atualiza campos da gira.

    NOVO — Promoção em lote ao aumentar vagas:
      Se limite_consulentes aumentar em N, até N pessoas da lista de espera
      são promovidas automaticamente para confirmado (ordem FIFO).
      A lista de promovidos é incluída na resposta para o frontend
      abrir os WhatsApps em sequência.

    Envia push se status mudou explicitamente.
    """
    gira = db.query(Gira).filter(
        Gira.id == gira_id,
        Gira.terreiro_id == terreiro_id,
        Gira.deleted_at.is_(None),
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    campos_alterados = data.model_dump(exclude_unset=True)

    # ── Detectar aumento de vagas ANTES de aplicar as mudanças ───────────────
    # Guarda o limite anterior para calcular quantas vagas novas foram criadas
    limite_anterior = gira.limite_consulentes or 0
    novo_limite = campos_alterados.get("limite_consulentes", limite_anterior)
    vagas_abertas = max(0, (novo_limite or 0) - limite_anterior)

    # Aplica as alterações
    for field, value in campos_alterados.items():
        setattr(gira, field, value)

    # Valida e limpa campos inconsistentes após atualização
    if gira.acesso == "fechada":
        if gira.limite_membros == 0:
            raise HTTPException(400, "Gira fechada precisa de limite_membros")
        gira.limite_consulentes   = 0
        gira.abertura_lista       = None
        gira.fechamento_lista     = None
        gira.responsavel_lista_id = None
    elif gira.acesso == "publica":
        if gira.limite_consulentes == 0:
            raise HTTPException(400, "Gira pública precisa de limite_consulentes")
        gira.limite_membros = None

    # ── Promoção em lote ──────────────────────────────────────────────────────
    # Só faz sentido para giras públicas (fechadas não têm lista_espera de consulentes)
    promovidos: list[dict] = []
    if vagas_abertas > 0 and gira.acesso == "publica":
        promovidos = promover_fila_em_lote(db, gira.id, vagas_abertas)

    db.commit()
    db.refresh(gira)

    # Push de mudança de status (comportamento existente)
    if "status" in campos_alterados:
        msgs = {
            "aberta":    ("📋 Lista Aberta",    f"A lista da gira {gira.titulo} está aberta!"),
            "fechada":   ("🔒 Lista Encerrada", f"A lista da gira {gira.titulo} foi encerrada."),
            "concluida": ("✅ Gira Concluída",  f"A gira {gira.titulo} foi marcada como concluída."),
        }
        novo_status = campos_alterados["status"]
        if novo_status in msgs:
            titulo_push, corpo_push = msgs[novo_status]
            send_push_to_terreiro(
                terreiro_id=gira.terreiro_id,
                title=titulo_push,
                body=corpo_push,
                url=f"/giras/{gira.id}",
            )

    # Push informando promoções em lote (quando houve)
    if promovidos:
        nomes = ", ".join(p["nome"] for p in promovidos)
        send_push_to_terreiro(
            terreiro_id=gira.terreiro_id,
            title="🎉 Vagas Abertas — Fila Promovida",
            body=f"{len(promovidos)} pessoa(s) promovida(s) da espera: {nomes}",
            url=f"/giras/{gira.id}",
        )

    base = _enrich(gira, db, _count_inscritos(db, gira))

    # Retorna GiraUpdateResponse — estende GiraResponse com promovidos_fila,
    # garantindo que o FastAPI não descarte o campo ao serializar a resposta.
    return GiraUpdateResponse(
        **base.model_dump(),
        promovidos_fila=[PromovdoFila(**p) for p in promovidos],
    )


def delete_gira(db: Session, gira_id: UUID, terreiro_id: UUID):
    """
    Soft delete: preenche deleted_at em vez de remover o registro.
    Preserva histórico de inscrições e presença para analytics.
    """
    gira = db.query(Gira).filter(
        Gira.id == gira_id,
        Gira.terreiro_id == terreiro_id,
        Gira.deleted_at.is_(None),
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    titulo = gira.titulo
    gira.deleted_at = datetime.utcnow()
    db.commit()

    send_push_to_terreiro(
        terreiro_id=gira.terreiro_id,
        title="🗑️ Gira Removida",
        body=f"A gira {titulo} foi removida.",
        url="/giras",
    )

    return {"ok": True}