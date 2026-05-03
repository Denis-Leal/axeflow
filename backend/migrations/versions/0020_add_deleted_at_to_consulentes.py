"""
0020_add_deleted_at_to_consulentes

Adiciona suporte a soft delete no modelo de consulentes.

ALTERAÇÕES:
  - Adiciona coluna deleted_at (nullable)
  - Permite marcar registros como deletados sem remover do banco
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "0020_add_deleted_at_to_consulentes"
down_revision: Union[str, None] = "0019_allow_signed_quantity_inventory_movements"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─────────────────────────────────────────────────────────────
    # 1. ADICIONA COLUNA deleted_at
    # ─────────────────────────────────────────────────────────────
    op.add_column(
        "consulentes",
        sa.Column("deleted_at", sa.DateTime(), nullable=True)
    )

    # (Opcional, mas recomendado futuramente)
    # Índice parcial para performance em queries ativas
    # PostgreSQL apenas:
    op.execute("""
        CREATE INDEX ix_consulentes_not_deleted
        ON consulentes (id)
        WHERE deleted_at IS NULL
    """)


def downgrade() -> None:
    # ─────────────────────────────────────────────────────────────
    # 1. REMOVE ÍNDICE
    # ─────────────────────────────────────────────────────────────
    op.execute("DROP INDEX IF EXISTS ix_consulentes_not_deleted")

    # ─────────────────────────────────────────────────────────────
    # 2. REMOVE COLUNA
    # ─────────────────────────────────────────────────────────────
    op.drop_column("consulentes", "deleted_at")