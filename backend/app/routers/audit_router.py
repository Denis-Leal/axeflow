"""
audit_router.py — AxeFlow
Recebe logs de erro do frontend e registra no servidor.
"""
import logging
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/audit", tags=["audit"])
logger = logging.getLogger("axeflow.audit")


class AuditLogEntry(BaseModel):
    context:   str
    status:    Optional[int] = None
    code:      Optional[str] = None
    url:       Optional[str] = None
    method:    Optional[str] = None
    detail:    Optional[str] = None
    userAgent: Optional[str] = None
    timestamp: Optional[str] = None


@router.post("/log")
async def receive_audit_log(entry: AuditLogEntry, request: Request):
    ip = request.client.host if request.client else "unknown"
    logger.warning(
        "[AUDIT] context=%s status=%s code=%s method=%s url=%s detail=%s ip=%s ts=%s",
        entry.context, entry.status, entry.code,
        entry.method, entry.url, entry.detail,
        ip, entry.timestamp or datetime.utcnow().isoformat(),
    )
    return {"ok": True}
