"""cascade delete inscricoes ao deletar gira

Revision ID: 0002_cascade_delete
Revises: 0001_initial
Create Date: 2026-03-09

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0002_cascade_delete'
down_revision: Union[str, None] = '0001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Remove a FK antiga (sem cascade) e recria com ON DELETE CASCADE
    # O nome da constraint pode variar — usamos IF EXISTS via SQL direto
    bind = op.get_bind()

    # Descobre o nome real da constraint
    result = bind.execute(sa.text("""
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'inscricoes_gira'::regclass
          AND confrelid = 'giras'::regclass
          AND contype = 'f'
    """))
    row = result.fetchone()

    if row:
        constraint_name = row[0]
        op.drop_constraint(constraint_name, "inscricoes_gira", type_="foreignkey")

    op.create_foreign_key(
        "fk_inscricoes_gira_gira_id",
        "inscricoes_gira", "giras",
        ["gira_id"], ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_inscricoes_gira_gira_id", "inscricoes_gira", type_="foreignkey")
    op.create_foreign_key(
        None,
        "inscricoes_gira", "giras",
        ["gira_id"], ["id"],
    )
