"""
0010_api_keys.py — AxeFlow

Cria a tabela api_keys para autenticação de integrações externas
(n8n, Make, WhatsApp, desenvolvedores de terceiros).

Design de segurança:
  - Apenas o HASH SHA-256 da chave é armazenado (nunca o valor real)
  - O prefixo 'axf_' permite identificar vazamentos em logs/repos
  - terreiro_id garante isolamento multi-tenant
  - scopes define permissões granulares por chave
  - last_used_at e request_count permitem auditoria de uso

Revision ID: 0010_api_keys
Revises: 0009_audit_log_campos
Create Date: 2026-03-20
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0010_api_keys"
down_revision: Union[str, None] = "0009_audit_log_campos"
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
    if _tabela_existe("api_keys"):
        return  # idempotente

    op.create_table(
        "api_keys",
        # ── Identidade ────────────────────────────────────────────────────────
        sa.Column("id",          postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("terreiro_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("terreiros.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id",     postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False),

        # ── Chave ─────────────────────────────────────────────────────────────
        # prefix: 'axf_' — primeiros 7 chars visíveis para identificação
        sa.Column("prefix",    sa.String(10),  nullable=False),
        # key_hash: SHA-256 da chave completa — nunca armazenar o valor real
        sa.Column("key_hash",  sa.String(64),  nullable=False, unique=True),

        # ── Metadados ─────────────────────────────────────────────────────────
        sa.Column("nome",      sa.String(100), nullable=False),
        sa.Column("descricao", sa.Text,        nullable=True),

        # ── Permissões (JSON array de scopes) ─────────────────────────────────
        # Ex: ["giras:read", "inscricoes:write", "presenca:write", "relatorios:read"]
        sa.Column("scopes",    postgresql.JSONB, nullable=False, server_default="[]"),

        # ── Controle de acesso ────────────────────────────────────────────────
        sa.Column("ativa",     sa.Boolean,  nullable=False, server_default="true"),
        # expires_at: null = não expira (padrão para integrações)
        sa.Column("expires_at", sa.DateTime, nullable=True),

        # ── Auditoria de uso ──────────────────────────────────────────────────
        sa.Column("last_used_at",   sa.DateTime, nullable=True),
        sa.Column("request_count",  sa.BigInteger, nullable=False, server_default="0"),

        # ── Timestamps ────────────────────────────────────────────────────────
        sa.Column("created_at", sa.DateTime, nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("revoked_at", sa.DateTime, nullable=True),
    )

    # Índice para lookup rápido por hash (autenticação — caminho crítico)
    op.create_index("ix_api_keys_key_hash",   "api_keys", ["key_hash"])
    # Índice para listar chaves por terreiro (página de gestão)
    op.create_index("ix_api_keys_terreiro",   "api_keys", ["terreiro_id"])
    # Índice para filtrar apenas chaves ativas
    op.create_index("ix_api_keys_ativa",      "api_keys", ["terreiro_id", "ativa"])


def downgrade() -> None:
    if not _tabela_existe("api_keys"):
        return

    for idx in ["ix_api_keys_ativa", "ix_api_keys_terreiro", "ix_api_keys_key_hash"]:
        if _indice_existe(idx):
            op.drop_index(idx, table_name="api_keys")

    op.drop_table("api_keys")