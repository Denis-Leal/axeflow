"""
0021_update_consulente_unique_phone_constraint

Substitui índice simples de telefone por índice único parcial
considerando soft delete.
"""

from typing import Sequence, Union
from alembic import op


revision: str = "0021_update_consulente_unique_phone_constraint"
down_revision: Union[str, None] = "0020_add_deleted_at_to_consulentes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─────────────────────────────────────────────────────────────
    # 1. REMOVE ÍNDICE ANTIGO
    # ─────────────────────────────────────────────────────────────
    op.drop_index("ix_consulentes_telefone", table_name="consulentes")

    # ─────────────────────────────────────────────────────────────
    # 2. CRIA ÍNDICE ÚNICO PARCIAL
    # ─────────────────────────────────────────────────────────────
    op.execute("""
        CREATE UNIQUE INDEX ux_consulente_telefone_ativo
        ON consulentes (telefone, terreiro_id)
        WHERE deleted_at IS NULL
    """)


def downgrade() -> None:
    # ─────────────────────────────────────────────────────────────
    # 1. REMOVE ÍNDICE NOVO
    # ─────────────────────────────────────────────────────────────
    op.execute("DROP INDEX IF EXISTS ux_consulente_telefone_ativo")

    # ─────────────────────────────────────────────────────────────
    # 2. RECRIA ÍNDICE ANTIGO
    # ─────────────────────────────────────────────────────────────
    op.create_index(
        "ix_consulentes_telefone",
        "consulentes",
        ["telefone"]
    )