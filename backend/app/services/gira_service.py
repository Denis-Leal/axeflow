"""
gira_service.py — AxeFlow
Serviço de gestão de giras.

Soft delete: giras nunca são apagadas fisicamente.
deleted_at preenchido = gira "deletada" — todas as queries filtram deleted_at IS NULL.
"""
from sqlalchemy.orm import Session
from fastapi import HTTPException
from uuid import UUID
from app.models.gira import Gira
from app.models.usuario import Usuario
from app.models.inscricao import InscricaoGira
from app.schemas.gira_schema import GiraCreate, GiraUpdate, GiraResponse
from app.utils.slug import generate_gira_slug
from app.services.push_service import broadcast_push_notification
from datetime import datetime


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
            Gira.deleted_at.is_(None),  # soft delete: exclui giras "deletadas"
        )
        .order_by(Gira.data.desc())
        .all()
    )

    result = []
    for g in giras:
        total = db.query(InscricaoGira).filter(
            InscricaoGira.gira_id == g.id,
            InscricaoGira.status != "cancelado",
        ).count()
        result.append(_enrich(g, db, total))
    return result


def create_gira(db: Session, data: GiraCreate, user: Usuario) -> GiraResponse:
    """Cria nova gira. Giras públicas recebem slug único com hash."""
    is_publica = data.acesso != "fechada"

    # Slug apenas para giras públicas (fechadas não têm página pública)
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

    # Notificar membros sobre nova gira
    data_fmt    = gira.data.strftime("%d/%m/%Y")
    horario_fmt = gira.horario.strftime("%H:%M")
    acesso_label = "pública" if is_publica else "fechada (membros)"
    broadcast_push_notification(
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

    total = db.query(InscricaoGira).filter(
        InscricaoGira.gira_id == gira.id,
        InscricaoGira.status != "cancelado",
    ).count()
    return _enrich(gira, db, total)


def update_gira(db: Session, gira_id: UUID, data: GiraUpdate, terreiro_id: UUID) -> GiraResponse:
    """Atualiza campos da gira. Envia push se status mudou."""
    gira = db.query(Gira).filter(
        Gira.id == gira_id,
        Gira.terreiro_id == terreiro_id,
        Gira.deleted_at.is_(None),
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    campos_alterados = data.model_dump(exclude_unset=True)
    # aplica alterações
    for field, value in campos_alterados.items():
        setattr(gira, field, value)

    # 🔥 valida estado final
    if gira.acesso == "fechada":
        if gira.limite_membros == 0:
            raise HTTPException(400, "Gira fechada precisa de limite_membros")

        # limpa campos inválidos
        gira.limite_consulentes = 0
        gira.abertura_lista = None
        gira.fechamento_lista = None
        gira.responsavel_lista_id = None

    elif gira.acesso == "publica":
        if gira.limite_consulentes == 0:
            raise HTTPException(400, "Gira pública precisa de limite_consulentes")

        gira.limite_membros = None
    db.commit()
    db.refresh(gira)

    # Push apenas quando status muda explicitamente
    if "status" in campos_alterados:
        msgs = {
            "aberta":    ("📋 Lista Aberta",    f"A lista da gira {gira.titulo} está aberta!"),
            "fechada":   ("🔒 Lista Encerrada", f"A lista da gira {gira.titulo} foi encerrada."),
            "concluida": ("✅ Gira Concluída",  f"A gira {gira.titulo} foi marcada como concluída."),
        }
        novo_status = campos_alterados["status"]
        if novo_status in msgs:
            titulo_push, corpo_push = msgs[novo_status]
            broadcast_push_notification(title=titulo_push, body=corpo_push, url=f"/giras/{gira.id}")

    return _enrich(gira, db)


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
    gira.deleted_at = datetime.utcnow()  # soft delete — dado preservado no banco
    db.commit()

    broadcast_push_notification(
        title="🗑️ Gira Removida",
        body=f"A gira {titulo} foi removida.",
        url="/giras",
    )

    return {"ok": True}
