"""
audit_log.py — AxeFlow

CORREÇÕES aplicadas:
  - user_id: rastreia qual usuário autenticado gerou o evento
  - level: INFO / WARNING / ERROR para filtragem e alertas
  - ip: endereço do cliente para detecção de abuso
  - trace_id: correlaciona múltiplos logs de uma mesma requisição
  - action: nome semântico do evento (ex: LOGIN_FAILED, GIRA_CREATED)
    separado de context para facilitar queries e dashboards
"""
import uuid
from app.utils.datetime_utils import utcnow
from sqlalchemy import Column, String, DateTime, Integer, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── Quem ──────────────────────────────────────────────────────────────────
    # NULL em eventos não autenticados (ex: login falhou, inscrição pública)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    ip: Mapped[str] = mapped_column(String(45), nullable=True)         # IPv4 ou IPv6

    # ── O quê ─────────────────────────────────────────────────────────────────
    # Categoria ampla (ex: "auth", "gira", "inscricao")
    context    : Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # Evento específico (ex: "LOGIN_OK", "GIRA_CREATED", "INSCRICAO_CANCELADA")
    action     : Mapped[str] = mapped_column(String(100), nullable=True,  index=True)
    # Severidade: INFO | WARNING | ERROR
    level      : Mapped[str] = mapped_column(String(10),  nullable=False, default="INFO")

    # ── Detalhes HTTP ─────────────────────────────────────────────────────────
    status     : Mapped[int] = mapped_column(Integer, nullable=True)   # HTTP status code
    code       : Mapped[str] = mapped_column(String(50), nullable=True) # código interno (ex: ERR_NETWORK)
    method     : Mapped[str] = mapped_column(String(10), nullable=True)
    url        : Mapped[str] = mapped_column(Text, nullable=True)
    message    : Mapped[str] = mapped_column(Text, nullable=True)
    user_agent : Mapped[str] = mapped_column(Text, nullable=True)

    # ── Rastreabilidade ───────────────────────────────────────────────────────
    # UUID gerado por requisição — correlaciona logs de uma mesma chamada
    trace_id   : Mapped[str] = mapped_column(String(36), nullable=True, index=True)

    created_at : Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)

    __table_args__ = (
        # Query mais comum: filtrar por contexto + período para dashboards
        Index("ix_audit_logs_context_created", "context", "created_at"),
        # Rastrear todas as ações de um usuário específico
        Index("ix_audit_logs_user_created",    "user_id", "created_at"),
    )