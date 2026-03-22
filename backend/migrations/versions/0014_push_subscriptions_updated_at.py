"""Adiciona coluna updated_at em push_subscriptions

A coluna foi definida no model PushSubscription mas nunca adicionada
à tabela pelo histórico de migrations. Isso causava erro 500 ao criar
giras, pois o SQLAlchemy tentava fazer SELECT nessa coluna inexistente.

Revision ID: 0014_push_subscriptions_updated_at
Revises: b9d1d606fd73
Create Date: 2026-03-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# ── Identificadores da migration ──────────────────────────────────────────────
revision: str = "0014_push_subscriptions_updated_at"
down_revision: Union[str, None] = "b9d1d606fd73"  # merge head atual
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ── Helper de idempotência ────────────────────────────────────────────────────

def _coluna_existe(tabela: str, coluna: str) -> bool:
    """Verifica se a coluna já existe na tabela antes de criar/dropar.
    
    Torna o upgrade/downgrade idempotente: pode ser re-executado
    sem gerar erros caso a coluna já exista ou já tenha sido removida.
    """
    bind = op.get_bind()
    cols = [c["name"] for c in inspect(bind).get_columns(tabela)]
    return coluna in cols


# ── Upgrade ───────────────────────────────────────────────────────────────────

def upgrade() -> None:
    """Adiciona updated_at à tabela push_subscriptions.

    - Nullable porque registros existentes não têm valor para este campo.
    - O valor é preenchido pela camada Python (onupdate=datetime.utcnow)
      no model, não por trigger no banco — padrão consistente com o projeto.
    - Retroativamente preenche registros existentes com o valor de created_at
      para evitar NULL permanente em linhas antigas.
    """
    if not _coluna_existe("push_subscriptions", "updated_at"):
        # 1. Adiciona a coluna como nullable (registros existentes ficarão NULL)
        op.add_column(
            "push_subscriptions",
            sa.Column("updated_at", sa.DateTime, nullable=True),
        )

        # 2. Preenche registros existentes com created_at como valor inicial
        #    Evita que linhas antigas fiquem com updated_at = NULL para sempre,
        #    o que poderia confundir queries de "última atualização".
        op.execute(
            "UPDATE push_subscriptions SET updated_at = created_at "
            "WHERE updated_at IS NULL"
        )


# ── Downgrade ─────────────────────────────────────────────────────────────────

def downgrade() -> None:
    """Remove a coluna updated_at de push_subscriptions."""
    if _coluna_existe("push_subscriptions", "updated_at"):
        op.drop_column("push_subscriptions", "updated_at")