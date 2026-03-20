"""
audit_router.py — AxeFlow
Recebe logs de erro do frontend e os persiste via audit_service.

O frontend (errorHandler.js) chama POST /audit/log quando detecta
erros de rede ou respostas HTTP inesperadas. Esse endpoint persiste
esses eventos na tabela audit_logs com os campos completos.
"""
import logging
from fastapi import APIRouter, Request, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services import audit_service

router = APIRouter(prefix="/audit", tags=["audit"])
logger = logging.getLogger("axeflow.audit")


class AuditLogEntry(BaseModel):
    context:   str
    action:    Optional[str] = None
    level:     Optional[str] = "WARNING"   # erros de frontend são ao menos WARNING
    status:    Optional[int] = None
    code:      Optional[str] = None
    url:       Optional[str] = None
    method:    Optional[str] = None
    detail:    Optional[str] = None
    userAgent: Optional[str] = None
    traceId:   Optional[str] = None


@router.post("/log")
async def receive_audit_log(
    entry: AuditLogEntry,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Recebe evento de auditoria do frontend e persiste no banco.
    Não requer autenticação — erros de login também precisam ser registrados.
    """
    audit_service.log(
        db, request,
        context  = entry.context,
        action   = entry.action,
        level    = entry.level or "WARNING",
        status   = entry.status,
        code     = entry.code,
        message  = entry.detail,
        trace_id = entry.traceId,
        # user_id não disponível aqui (frontend pode não ter token)
        # O frontend pode passar user_id no payload se quiser rastreamento completo
    )
    return {"ok": True}