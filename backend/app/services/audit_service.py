"""
audit_service.py — AxeFlow
Serviço central de auditoria.

Todos os routers chamam audit_service.log() em vez de escrever
diretamente no banco ou no logger. Isso centraliza:
  - geração de trace_id
  - captura de IP
  - gravação no banco
  - espelhamento no logger Python (para stdout/Render logs)

Uso:
    from app.services.audit_service import audit

    audit(db, request,
        context="auth",
        action="LOGIN_OK",
        level="INFO",
        user_id=user.id,
        status=200,
    )
"""
import uuid
import logging
from typing import Optional
from uuid import UUID

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog

logger = logging.getLogger("axeflow.audit")


def _get_ip(request: Request) -> str:
    """
    Extrai o IP real do cliente.
    Respeita X-Forwarded-For quando presente (Vercel/Render usam proxy).
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # Pega o primeiro IP da cadeia (cliente original)
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def log(
    db: Session,
    request: Request,
    *,
    context: str,
    action: Optional[str] = None,
    level: str = "INFO",
    user_id: Optional[UUID] = None,
    status: Optional[int] = None,
    code: Optional[str] = None,
    message: Optional[str] = None,
    trace_id: Optional[str] = None,
) -> AuditLog:
    """
    Grava um evento de auditoria no banco e no logger Python.

    Parâmetros:
        db       : sessão SQLAlchemy (obrigatório)
        request  : objeto Request do FastAPI (para IP, método, URL, user-agent)
        context  : categoria do evento — ex: "auth", "gira", "inscricao"
        action   : nome semântico — ex: "LOGIN_OK", "GIRA_CREATED"
        level    : "INFO" | "WARNING" | "ERROR"
        user_id  : UUID do usuário autenticado (None para eventos anônimos)
        status   : HTTP status code da resposta
        code     : código interno de erro (ex: "ERR_LIMITE_VAGAS")
        message  : mensagem descritiva livre
        trace_id : correlaciona logs de uma mesma requisição;
                   gerado automaticamente se não fornecido
    """
    ip = _get_ip(request)
    tid = trace_id or str(uuid.uuid4())

    entry = AuditLog(
        user_id    = user_id,
        ip         = ip,
        context    = context,
        action     = action,
        level      = level,
        status     = status,
        code       = code,
        method     = request.method,
        url        = str(request.url),
        message    = message,
        user_agent = request.headers.get("user-agent"),
        trace_id   = tid,
    )
    db.add(entry)
    db.commit()

    # Espelha no logger para aparecer no stdout do Render/Docker
    log_fn = {
        "ERROR":   logger.error,
        "WARNING": logger.warning,
    }.get(level, logger.info)

    log_fn(
        "[%s] action=%s status=%s code=%s ip=%s user=%s trace=%s — %s",
        context, action, status, code, ip, user_id, tid, message or "",
    )

    return entry