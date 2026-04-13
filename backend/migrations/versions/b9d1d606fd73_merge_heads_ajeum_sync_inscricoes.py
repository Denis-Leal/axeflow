"""merge heads: ajeum + sync inscricoes

Revision ID: b9d1d606fd73
Revises: 0012_sync_inscricoes_legado, 0012_ajeum
Create Date: 2026-03-21 21:30:02.506502

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b9d1d606fd73'
down_revision: Union[str, None] = ('0012_sync_inscricoes_legado', '0012_ajeum')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
