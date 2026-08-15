"""
inscricao_router.py — AxeFlow
Endpoints de inscrição com auditoria completa.

Eventos registrados:
  PRESENCA_UPDATED    — presença marcada (INFO)
  INSCRICAO_CANCELADA — inscrição cancelada (WARNING)
  INSCRICAO_REATIVADA — inscrição reativada (INFO)
"""
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.inscricao_consulente import InscricaoConsulente
from app.models.usuario import Usuario
from app.schemas.inscricao_schema import InscricaoPublicaRequest, PresencaUpdate
from app.services import audit_service, inscricao_service
from app.services.presenca_consulente_service import (get_scores_para_gira,)


# Rate limiter por IP — evita abuso dos endpoints sem autenticação
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(tags=["inscricoes"])


# ── Inscrições de uma gira ─────────────────────────────────────────────────────

@router.get("/giras/{gira_id}/inscricoes")
def list_inscricoes(
    gira_id: UUID,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista inscrições de consulentes com score de presença histórico."""
    inscricoes = inscricao_service.list_inscricoes(db, gira_id, user.terreiro_id)
    scores = get_scores_para_gira(db, gira_id, user.terreiro_id)

    result = []
    for i in inscricoes:
        item = i.model_dump() if hasattr(i, "model_dump") else dict(i)
        insc = db.query(InscricaoConsulente).filter(InscricaoConsulente.id == i.id).first()
        item["score_presenca"] = scores.get(str(insc.consulente_id)) if insc and insc.consulente_id else None
        result.append(item)

    return result


# ── Inscrição pública (sem autenticação) ───────────────────────────────────────

@router.post("/gira/{slug}/inscrever/publico")
@limiter.limit("10/minute")
def inscrever_publico(
    slug: str,
    data: InscricaoPublicaRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Inscreve consulente em gira pública.
    Rate limit restritivo (10/min) — operação de escrita principal sem autenticação.
    """
    return inscricao_service.inscrever_publico(db, slug, data)


# ── Inscrição interna (autenticada) ───────────────────────────────────────────

@router.post("/gira/{gira_id}/inscrever/interno")
@limiter.limit("10/minute")
def inscrever_interno(
    gira_id: UUID,
    data: InscricaoPublicaRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Inscreve consulente em gira interna pelo painel administrativo."""
    return inscricao_service.inscrever_interno(db, gira_id, data, user.id)


# ── Presença e cancelamento ────────────────────────────────────────────────────

@router.patch("/inscricao/{inscricao_id}/presenca")
def update_presenca(
    inscricao_id: UUID,
    data: PresencaUpdate,
    request: Request,
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
    """Marca presença ou falta de um consulente em uma gira."""
    result = inscricao_service.update_presenca(db, inscricao_id, data, user.terreiro_id)

    audit_service.log(
        db, request,
        context="inscricao",
        action="PRESENCA_UPDATED",
        level="INFO",
        user_id=user.id,
        status=200,
        message=f"Presença atualizada: inscricao={inscricao_id} status={data.status}",
    )
    return result


@router.delete("/inscricao/{inscricao_id}")
def cancelar_inscricao(
    inscricao_id: UUID,
    request: Request,
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
    """Cancela uma inscrição e registra no audit log."""
    result = inscricao_service.cancelar_inscricao(db, inscricao_id, user.terreiro_id, user.id)

    audit_service.log(
        db, request,
        context="inscricao",
        action="INSCRICAO_CANCELADA",
        level="WARNING",
        user_id=user.id,
        status=200,
        message=f"Inscrição cancelada: {inscricao_id}",
    )
    return result


@router.post("/inscricao/{inscricao_id}/reativar")
def reativar_inscricao(
    inscricao_id: UUID,
    request: Request,
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
    """Reativa uma inscrição cancelada e registra no audit log."""
    result = inscricao_service.reativar_inscricao(db, inscricao_id, user.terreiro_id, user.id)

    audit_service.log(
        db, request,
        context="inscricao",
        action="INSCRICAO_REATIVADA",
        level="INFO",
        user_id=user.id,
        status=200,
        message=f"Inscrição reativada: {inscricao_id} → {result.get('status')}",
    )
    return result