"""
0022_add_deleted_at_to_inscricoes_consulente

Adiciona suporte a soft delete em inscrições de consulentes.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "0022_add_deleted_at_to_inscricoes_consulente"
down_revision: Union[str, None] = "0021_update_consulente_unique_phone_constraint"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "inscricoes_consulente",
        sa.Column("deleted_at", sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("inscricoes_consulente", "deleted_at")