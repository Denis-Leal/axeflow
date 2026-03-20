"""
0008_audit_log.py — AxeFlow

Cria a tabela audit_logs que estava faltando no banco.

O model AuditLog e o router audit_router.py já existiam, mas a tabela
nunca foi gerada por migration — apenas pelo SQLAlchemy em modo de
criação automática (que não é usado em produção com Alembic).

Também adiciona índice em (context, created_at) para a query de
limpeza do cleanup_service rodar eficientemente.

Revision ID: 0008_audit_log
Revises: 0007_separar_inscricoes
Create Date: 2026-03-20
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0008_audit_log"
down_revision: Union[str, None] = "0007_separar_inscricoes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tabela_existe(nome: str) -> bool:
    from sqlalchemy import inspect
    return inspect(op.get_bind()).has_table(nome)


def _indice_existe(nome: str) -> bool:
    from sqlalchemy import text
    result = op.get_bind().execute(
        text("SELECT indexname FROM pg_indexes WHERE indexname = :n"),
        {"n": nome},
    )
    return result.fetchone() is not None


def upgrade() -> None:
    if _tabela_existe("audit_logs"):
        return  # idempotente — não recria se já existir

    op.create_table(
        "audit_logs",
        sa.Column("id",         postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("context",    sa.String(100), nullable=False),
        sa.Column("status",     sa.Integer,     nullable=True),
        sa.Column("code",       sa.String(50),  nullable=True),
        sa.Column("message",    sa.Text,        nullable=True),
        sa.Column("url",        sa.Text,        nullable=True),
        sa.Column("method",     sa.String(10),  nullable=True),
        sa.Column("user_agent", sa.Text,        nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )

    # Índice em context — filtro mais comum em consultas de auditoria
    op.create_index("ix_audit_logs_context",    "audit_logs", ["context"])

    # Índice em created_at — usado pelo cleanup_service na query de limpeza:
    # DELETE FROM audit_logs WHERE created_at < :cutoff
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade() -> None:
    if not _tabela_existe("audit_logs"):
        return

    if _indice_existe("ix_audit_logs_created_at"):
        op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")

    if _indice_existe("ix_audit_logs_context"):
        op.drop_index("ix_audit_logs_context", table_name="audit_logs")

    op.drop_table("audit_logs")