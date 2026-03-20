"""
0011_password_reset_tokens.py — AxeFlow

Cria a tabela password_reset_tokens para o fluxo de recuperação de senha.

Design de segurança:
  - token_hash: SHA-256 do token gerado (nunca armazena o valor real)
  - expires_at: tokens expiram em 1 hora — janela curta reduz risco de abuso
  - used_at: token é invalidado após uso (não pode ser reutilizado)
  - terreiro_id: garante isolamento multi-tenant na validação
  - Índice em token_hash: lookup O(1) na autenticação do reset

Revision ID: 0011_password_reset_tokens
Revises: 0010_api_keys
Create Date: 2026-03-20
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0011_password_reset_tokens"
down_revision: Union[str, None] = "0010_api_keys"
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
    if _tabela_existe("password_reset_tokens"):
        return  # idempotente

    op.create_table(
        "password_reset_tokens",
        # ── Identidade ────────────────────────────────────────────────────────
        sa.Column("id",          postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id",     postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("terreiro_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("terreiros.id", ondelete="CASCADE"), nullable=False),

        # ── Token (nunca armazenar o valor real) ──────────────────────────────
        # SHA-256 hexdigest do token gerado com secrets.token_urlsafe(32)
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),

        # ── Controle de validade ──────────────────────────────────────────────
        # Token expira em 1 hora após criação
        sa.Column("expires_at", sa.DateTime, nullable=False),
        # Preenchido quando o token é usado — impede reutilização
        sa.Column("used_at",    sa.DateTime, nullable=True),

        # ── Timestamps ────────────────────────────────────────────────────────
        sa.Column("created_at", sa.DateTime, nullable=False,
                  server_default=sa.text("NOW()")),
    )

    # Lookup rápido por hash na validação do token (caminho crítico)
    op.create_index("ix_prt_token_hash",   "password_reset_tokens", ["token_hash"])
    # Limpeza periódica de tokens expirados e não usados
    op.create_index("ix_prt_expires_at",   "password_reset_tokens", ["expires_at"])
    # Consulta de tokens por usuário (para invalidar anteriores)
    op.create_index("ix_prt_user_id",      "password_reset_tokens", ["user_id"])


def downgrade() -> None:
    if not _tabela_existe("password_reset_tokens"):
        return

    for idx in ["ix_prt_user_id", "ix_prt_expires_at", "ix_prt_token_hash"]:
        if _indice_existe(idx):
            op.drop_index(idx, table_name="password_reset_tokens")

    op.drop_table("password_reset_tokens")