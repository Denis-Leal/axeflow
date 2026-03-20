"""
0009_audit_log_campos.py — AxeFlow

Adiciona campos críticos de auditoria que estavam faltando:
  - user_id:  rastreia o usuário autenticado
  - level:    severidade do evento (INFO/WARNING/ERROR)
  - ip:       endereço IP do cliente
  - trace_id: correlaciona logs de uma mesma requisição
  - action:   nome semântico do evento (separado de context)

Revision ID: 0009_audit_log_campos
Revises: 0008_audit_log
Create Date: 2026-03-20
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0009_audit_log_campos"
down_revision: Union[str, None] = "0008_audit_log"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _coluna_existe(tabela: str, coluna: str) -> bool:
    from sqlalchemy import text
    result = op.get_bind().execute(
        text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = :t AND column_name = :c"
        ),
        {"t": tabela, "c": coluna},
    )
    return result.fetchone() is not None


def _indice_existe(nome: str) -> bool:
    from sqlalchemy import text
    result = op.get_bind().execute(
        text("SELECT indexname FROM pg_indexes WHERE indexname = :n"),
        {"n": nome},
    )
    return result.fetchone() is not None


def upgrade() -> None:
    # ── Novos campos ──────────────────────────────────────────────────────────
    if not _coluna_existe("audit_logs", "user_id"):
        op.add_column("audit_logs",
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True))

    if not _coluna_existe("audit_logs", "ip"):
        op.add_column("audit_logs",
            sa.Column("ip", sa.String(45), nullable=True))

    if not _coluna_existe("audit_logs", "level"):
        op.add_column("audit_logs",
            sa.Column("level", sa.String(10), nullable=False, server_default="INFO"))

    if not _coluna_existe("audit_logs", "action"):
        op.add_column("audit_logs",
            sa.Column("action", sa.String(100), nullable=True))

    if not _coluna_existe("audit_logs", "trace_id"):
        op.add_column("audit_logs",
            sa.Column("trace_id", sa.String(36), nullable=True))

    # ── Índices compostos para queries de dashboard e rastreamento ────────────
    if not _indice_existe("ix_audit_logs_context_created"):
        op.create_index(
            "ix_audit_logs_context_created",
            "audit_logs", ["context", "created_at"],
        )

    if not _indice_existe("ix_audit_logs_user_created"):
        op.create_index(
            "ix_audit_logs_user_created",
            "audit_logs", ["user_id", "created_at"],
        )

    if not _indice_existe("ix_audit_logs_action"):
        op.create_index("ix_audit_logs_action", "audit_logs", ["action"])

    if not _indice_existe("ix_audit_logs_trace_id"):
        op.create_index("ix_audit_logs_trace_id", "audit_logs", ["trace_id"])


def downgrade() -> None:
    for idx in [
        "ix_audit_logs_trace_id",
        "ix_audit_logs_action",
        "ix_audit_logs_user_created",
        "ix_audit_logs_context_created",
    ]:
        if _indice_existe(idx):
            op.drop_index(idx, table_name="audit_logs")

    for col in ["trace_id", "action", "level", "ip", "user_id"]:
        if _coluna_existe("audit_logs", col):
            op.drop_column("audit_logs", col)