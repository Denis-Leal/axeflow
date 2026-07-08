"""
0023_enable_pg_trgm_extension

Habilita extensão pg_trgm para suporte a similarity()
em detecção de possíveis consulentes duplicados.
"""

from typing import Sequence, Union
from alembic import op


revision: str = "0023_enable_pg_trgm_extension"
down_revision: Union[str, None] = "0022_add_deleted_at_to_inscricoes_consulente"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")


def downgrade() -> None:
    # Não remover extensão automaticamente.
    # Pode estar sendo usada por outras queries/indexes.
    pass