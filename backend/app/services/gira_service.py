"""
gira_service.py — AxeFlow

CORREÇÃO: _count_inscritos agora usa InscricaoMembro para giras fechadas
e InscricaoConsulente para giras públicas, em vez de InscricaoGira para ambas.
"""
from sqlalchemy.orm import Session
from fastapi import HTTPException
from uuid import UUID
from app.models.gira import Gira
from app.models.usuario import Usuario
from app.models.inscricao_consulente import InscricaoConsulente
from app.models.inscricao_membro import InscricaoMembro
from app.schemas.gira_schema import GiraCreate, GiraUpdate, GiraResponse, GiraUpdateResponse, PromovdoFila
from app.utils.slug import generate_gira_slug
from app.services.push_service import send_push_to_terreiro
from app.services.inscricao_service import promover_fila_em_lote
from datetime import datetime


def _count_inscritos(db: Session, gira: Gira) -> int:
    """
    Conta inscrições ativas por tipo de acesso.

    Públicas  → InscricaoConsulente (consulentes externos)
    Fechadas  → InscricaoMembro (membros do terreiro)

    Pools completamente separados — um não interfere no outro.
    """
    if gira.acesso == "fechada":
        return db.query(InscricaoMembro).filter(
            InscricaoMembro.gira_id == gira.id,
            InscricaoMembro.status != "cancelado",
        ).count()
    else:
        return db.query(InscricaoConsulente).filter(
            InscricaoConsulente.gira_id == gira.id,
            InscricaoConsulente.status != "cancelado",
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
    """Cria nova gira. Giras públicas recebem slug único com hash anti-colisão."""
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

    data_fmt     = gira.data.strftime("%d/%m/%Y")
    horario_fmt  = gira.horario.strftime("%H:%M")
    acesso_label = "pública" if is_publica else "fechada (membros)"

    payload = {
        "title": "✦ Nova Gira Criada",
        "terreiro_id": str(gira.terreiro_id),
        "body": f"{gira.titulo} ({acesso_label}) — {data_fmt} às {horario_fmt}",
        "url": f"/giras/{gira.id}",
    }
    send_push_to_terreiro(
        db=db,
        terreiro_id=gira.terreiro_id,
        payload=payload,
    )

    return _enrich(gira, db, 0)


def get_gira(db: Session, gira_id: UUID, terreiro_id: UUID) -> GiraResponse:
    """Busca gira por ID. Retorna 404 para giras soft-deletadas."""
    gira = db.query(Gira).filter(
        Gira.id == gira_id,
        Gira.terreiro_id == terreiro_id,
        Gira.deleted_at.is_(None),
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")
    return _enrich(gira, db, _count_inscritos(db, gira))


def update_gira(db: Session, gira_id: UUID, data: GiraUpdate, terreiro_id: UUID) -> GiraUpdateResponse:
    """
    Atualiza campos da gira.
    Promoção em lote ao aumentar vagas — delegada ao inscricao_service com FOR UPDATE.
    """
    gira = db.query(Gira).filter(
        Gira.id == gira_id,
        Gira.terreiro_id == terreiro_id,
        Gira.deleted_at.is_(None),
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    dados = data.model_dump(exclude_unset=True)
    campos_alterados = {k: v for k, v in dados.items() if getattr(gira, k) != v}
    if not campos_alterados:
        return GiraUpdateResponse(**_enrich(gira, db).model_dump(), promovidos_fila=[])     
    
    limite_anterior = gira.limite_consulentes or 0
    novo_limite     = campos_alterados.get("limite_consulentes", limite_anterior)
    vagas_abertas   = max(0, (novo_limite or 0) - limite_anterior)

    for field, value in campos_alterados.items():
        setattr(gira, field, value)

    if gira.acesso == "fechada":
        if not gira.limite_membros:
            raise HTTPException(400, "Gira fechada precisa de limite_membros")
        gira.limite_consulentes   = 0
        gira.abertura_lista       = None
        gira.fechamento_lista     = None
        gira.responsavel_lista_id = None
    elif gira.acesso == "publica":
        if not gira.limite_consulentes:
            raise HTTPException(400, "Gira pública precisa de limite_consulentes")
        gira.limite_membros = None

    promovidos: list[dict] = []
    if vagas_abertas > 0 and gira.acesso == "publica":
        promovidos = promover_fila_em_lote(db, gira.id, vagas_abertas)

    db.commit()
    db.refresh(gira)
    
    if "acesso" in campos_alterados:
        acesso_label = "pública" if gira.acesso != "fechada" else "fechada (membros)"
        payload = {
            "title": "🔄 Gira Atualizada",
            "terreiro_id": str(gira.terreiro_id),
            "body": f"O acesso da gira {gira.titulo} foi alterado para: {acesso_label}",
            "url": f"/giras/{gira.id}",
        }
        send_push_to_terreiro(
            db=db,
            terreiro_id=gira.terreiro_id,
            payload=payload,
        )
    
    if "titulo" in campos_alterados:
        payload = {
            "title": "✏️ Gira Editada",
            "terreiro_id": str(gira.terreiro_id),
            "body": f"O título da gira foi alterado  de: {dados.get('titulo')} para: {gira.titulo}",
            "url": f"/giras/{gira.id}",
        }
        send_push_to_terreiro(
            db=db,
            terreiro_id=gira.terreiro_id,
            payload=payload,
        )
        
    if "tipo" in campos_alterados:
        payload = {
            "title": "🔄 Gira Atualizada",
            "terreiro_id": str(gira.terreiro_id),
            "body": f"O tipo da gira {gira.titulo} foi alterado de: {dados.get('tipo')} para: {gira.tipo}",
            "url": f"/giras/{gira.id}",
        }
        send_push_to_terreiro(
            db=db,
            terreiro_id=gira.terreiro_id,
            payload=payload,
        )

    if "status" in campos_alterados:
        msgs = {
            "aberta":    ("📋 Gira Aberta",    f"A gira {gira.titulo} foi marcada como aberta!"),
            "fechada":   ("🔒 Gira Encerrada", f"A gira {gira.titulo} foi marcada como encerrada."),
            "concluida": ("✅ Gira Concluída",  f"A gira {gira.titulo} foi marcada como concluída."),
        }
        if (novo_status := campos_alterados["status"]) in msgs:
            titulo_push, corpo_push = msgs[novo_status]
            
            payload = {
                "title": f"{titulo_push} — {gira.titulo}",
                "terreiro_id": str(gira.terreiro_id),
                "body": f"{corpo_push}",
                "url": f"/giras/{gira.id}",
            }
            send_push_to_terreiro(
                db=db,
                terreiro_id=gira.terreiro_id,
                payload=payload,
            )
        
    if "data" in campos_alterados or "horario" in campos_alterados:
        data_fmt     = gira.data.strftime("%d/%m/%Y")
        horario_fmt  = gira.horario.strftime("%H:%M")
        
        payload = {
            "title": "📅 Gira Atualizada",
            "terreiro_id": str(gira.terreiro_id),
            "body": f"A data/horário da gira {gira.titulo} foi alterada para: {data_fmt} às {horario_fmt}",
            "url": f"/giras/{gira.id}",
        }
        send_push_to_terreiro(
            db=db,
            terreiro_id=gira.terreiro_id,
            payload=payload,
        )
        
    if "Abertura_lista" in campos_alterados or "fechamento_lista" in campos_alterados:
        abertura_fmt   = gira.abertura_lista.strftime("%d/%m/%Y %H:%M") if gira.abertura_lista else "N/A"
        fechamento_fmt = gira.fechamento_lista.strftime("%d/%m/%Y %H:%M") if gira.fechamento_lista else "N/A"
        
        payload = {
            "title": "⏰ Gira Atualizada",
            "terreiro_id": str(gira.terreiro_id),
            "body": f"As datas da lista de espera da gira {gira.titulo} foram atualizadas: abertura: {abertura_fmt}, fechamento: {fechamento_fmt}",
            "url": f"/giras/{gira.id}",
        }
        
        send_push_to_terreiro(
            db=db,
            terreiro_id=gira.terreiro_id,
            payload=payload,
        )

    if promovidos:
        nomes = ", ".join(p["nome"] for p in promovidos)
        
        payload = {
            "title": "🎉 Vagas Abertas — Fila Promovida",
            "body": f"{len(promovidos)} pessoa(s) promovida(s) da espera: {nomes}",
            "url": f"/giras/{gira.id}",
            "terreiro_id": str(gira.terreiro_id),
        }
        send_push_to_terreiro(
            db=db,
            terreiro_id=gira.terreiro_id,
            payload=payload,
        )

    base = _enrich(gira, db, _count_inscritos(db, gira))
    return GiraUpdateResponse(
        **base.model_dump(),
        promovidos_fila=[PromovdoFila(**p) for p in promovidos],
    )


def delete_gira(db: Session, gira_id: UUID, terreiro_id: UUID):
    """Soft delete: preenche deleted_at em vez de remover fisicamente."""
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
    
    payload = {
        "title": "🗑️ Gira Removida",
        "body": f"A gira {titulo} foi removida.",
        "url": f"/giras/{gira.id}",
        "terreiro_id": str(gira.terreiro_id),
    }
    send_push_to_terreiro(
        db=db,
        terreiro_id=gira.terreiro_id,
        payload=payload,
    )

    return {"ok": True}