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
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── Quem ──────────────────────────────────────────────────────────────────
    # NULL em eventos não autenticados (ex: login falhou, inscrição pública)
    user_id    = Column(UUID(as_uuid=True), nullable=True, index=True)
    ip         = Column(String(45), nullable=True)         # IPv4 ou IPv6

    # ── O quê ─────────────────────────────────────────────────────────────────
    # Categoria ampla (ex: "auth", "gira", "inscricao")
    context    = Column(String(100), nullable=False, index=True)
    # Evento específico (ex: "LOGIN_OK", "GIRA_CREATED", "INSCRICAO_CANCELADA")
    action     = Column(String(100), nullable=True,  index=True)
    # Severidade: INFO | WARNING | ERROR
    level      = Column(String(10),  nullable=False, default="INFO")

    # ── Detalhes HTTP ─────────────────────────────────────────────────────────
    status     = Column(Integer, nullable=True)   # HTTP status code
    code       = Column(String(50), nullable=True) # código interno (ex: ERR_NETWORK)
    method     = Column(String(10), nullable=True)
    url        = Column(Text, nullable=True)
    message    = Column(Text, nullable=True)
    user_agent = Column(Text, nullable=True)

    # ── Rastreabilidade ───────────────────────────────────────────────────────
    # UUID gerado por requisição — correlaciona logs de uma mesma chamada
    trace_id   = Column(String(36), nullable=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    __table_args__ = (
        # Query mais comum: filtrar por contexto + período para dashboards
        Index("ix_audit_logs_context_created", "context", "created_at"),
        # Rastrear todas as ações de um usuário específico
        Index("ix_audit_logs_user_created",    "user_id", "created_at"),
    )