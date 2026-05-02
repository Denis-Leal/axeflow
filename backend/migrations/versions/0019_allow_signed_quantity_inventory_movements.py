"""
0019_allow_signed_quantity_inventory_movements

Altera modelo de movimentação de estoque para usar quantity com sinal:

ANTES:
  - quantity >= 0
  - type define direção (IN / OUT)

DEPOIS:
  - quantity pode ser negativo
  - sinal define direção (ledger-style)

MIGRAÇÃO:
  1. Converte dados existentes (OUT → negativo)
  2. Remove constraint de quantidade positiva
"""

from typing import Sequence, Union
from alembic import op

revision: str = "0019_allow_signed_quantity_inventory_movements"
down_revision: Union[str, None] = "0018_add_terreiro_id_to_consulentes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─────────────────────────────────────────────────────────────
    # 1. REMOVE CONSTRAINT PRIMEIRO
    # ─────────────────────────────────────────────────────────────
    op.drop_constraint(
        "ck_movement_quantity_positive",
        "inventory_movements",
        type_="check"
    )

    # ─────────────────────────────────────────────────────────────
    # 2. NORMALIZA DADOS EXISTENTES
    # ─────────────────────────────────────────────────────────────
    op.execute("""
        UPDATE inventory_movements
        SET quantity = -quantity
        WHERE type = 'OUT' AND quantity > 0
    """)

    op.execute("""
        UPDATE inventory_movements
        SET quantity = ABS(quantity)
        WHERE type = 'IN' AND quantity < 0
    """)


def downgrade() -> None:
    # ─────────────────────────────────────────────────────────────
    # 1. REVERTE DADOS PARA MODELO ANTIGO
    # OUT volta a ser positivo
    # ─────────────────────────────────────────────────────────────
    op.execute("""
        UPDATE inventory_movements
        SET quantity = ABS(quantity)
        WHERE type = 'OUT'
    """)

    # ─────────────────────────────────────────────────────────────
    # 2. RECRIA CONSTRAINT ANTIGA
    # ─────────────────────────────────────────────────────────────
    op.create_check_constraint(
        "ck_movement_quantity_positive",
        "inventory_movements",
        "quantity >= 0"
    )