"""0005_push_to_terreiro

Revision ID: 0005_push_to_terreiro
Revises: 0004_...
Create Date: 2026-03-18
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers
revision = '0005_push_to_terreiro'
down_revision = '0004_email_por_terreiro'  # ajuste aqui
branch_labels = None
depends_on = None

def coluna_existe(tabela: str, coluna: str) -> bool:
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c["name"] for c in insp.get_columns(tabela)]
    return coluna in cols

def upgrade():
    # 1. Adiciona colunas (nullable TEMPORARIAMENTE)
    # user_id
    if not coluna_existe('push_subscriptions', 'user_id'):
        op.add_column(
            'push_subscriptions',
            sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True)
        )

        op.create_foreign_key(
            'fk_push_user',
            'push_subscriptions', 'usuarios',
            ['user_id'], ['id']
        )

    # terreiro_id
    if not coluna_existe('push_subscriptions', 'terreiro_id'):
        op.add_column(
            'push_subscriptions',
            sa.Column('terreiro_id', postgresql.UUID(as_uuid=True), nullable=True)
        )

        op.create_foreign_key(
            'fk_push_terreiro',
            'push_subscriptions', 'terreiros',
            ['terreiro_id'], ['id']
        )

    # 2. Cria FKs
    op.create_foreign_key(
        'fk_push_user',
        'push_subscriptions', 'usuarios',
        ['user_id'], ['id']
    )

    op.create_foreign_key(
        'fk_push_terreiro',
        'push_subscriptions', 'terreiros',
        ['terreiro_id'], ['id']
    )

    # ⚠️ 3. (OPCIONAL) Popular dados aqui se necessário

    # 4. Tornar NOT NULL (SÓ se você garantir dados)
    op.alter_column('push_subscriptions', 'user_id', nullable=True)  # ou False se tiver dados
    op.alter_column('push_subscriptions', 'terreiro_id', nullable=True)  # ou False se tiver dados


def downgrade():
    op.drop_constraint('fk_push_terreiro', 'push_subscriptions', type_='foreignkey')
    op.drop_constraint('fk_push_user', 'push_subscriptions', type_='foreignkey')

    op.drop_column('push_subscriptions', 'terreiro_id')
    op.drop_column('push_subscriptions', 'user_id')