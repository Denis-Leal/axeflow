"""Add Coluna limite_membros

Revision ID: 7beb915f0351
Revises: 0003_melhorias
Create Date: 2026-03-12 00:57:49.128268
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = '7beb915f0351'
down_revision: Union[str, None] = '0003_melhorias'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    inspector = inspect(conn)
    cols = [c["name"] for c in inspector.get_columns(table)]
    return column in cols


def index_exists(table: str, index_name: str) -> bool:
    conn = op.get_bind()
    inspector = inspect(conn)
    indexes = [i["name"] for i in inspector.get_indexes(table)]
    return index_name in indexes


def upgrade() -> None:

    # --- giras ---
    if not column_exists("giras", "limite_membros"):
        op.add_column("giras", sa.Column("limite_membros", sa.Integer(), nullable=True))

    op.alter_column(
        "giras",
        "limite_consulentes",
        existing_type=sa.INTEGER(),
        nullable=True
    )

    # --- inscricoes_gira FK ---
    try:
        op.drop_constraint("fk_inscricoes_gira_gira_id", "inscricoes_gira", type_="foreignkey")
    except:
        pass

    op.create_foreign_key(
        "fk_inscricoes_gira_gira_id",
        "inscricoes_gira",
        "giras",
        ["gira_id"],
        ["id"]
    )

    # --- push_subscriptions ---
    if not column_exists("push_subscriptions", "updated_at"):
        op.add_column(
            "push_subscriptions",
            sa.Column("updated_at", sa.DateTime(), nullable=True)
        )

    if not index_exists("push_subscriptions", "ix_push_subscriptions_endpoint"):
        op.create_index(
            "ix_push_subscriptions_endpoint",
            "push_subscriptions",
            ["endpoint"],
            unique=True
        )

    try:
        op.drop_constraint(
            "push_subscriptions_terreiro_id_fkey",
            "push_subscriptions",
            type_="foreignkey"
        )
    except:
        pass

    if column_exists("push_subscriptions", "terreiro_id"):
        op.drop_column("push_subscriptions", "terreiro_id")

    # --- terreiros ---
    op.alter_column(
        "terreiros",
        "cidade",
        existing_type=sa.VARCHAR(length=255),
        nullable=False
    )

    try:
        op.drop_constraint("terreiros_slug_key", "terreiros", type_="unique")
    except:
        pass

    if column_exists("terreiros", "slug"):
        op.drop_column("terreiros", "slug")


def downgrade() -> None:

    if not column_exists("terreiros", "slug"):
        op.add_column(
            "terreiros",
            sa.Column("slug", sa.VARCHAR(length=255), nullable=True)
        )

    op.create_unique_constraint("terreiros_slug_key", "terreiros", ["slug"])

    op.alter_column(
        "terreiros",
        "cidade",
        existing_type=sa.VARCHAR(length=255),
        nullable=True
    )

    if not column_exists("push_subscriptions", "terreiro_id"):
        op.add_column(
            "push_subscriptions",
            sa.Column("terreiro_id", sa.UUID(), nullable=False)
        )

    op.create_foreign_key(
        "push_subscriptions_terreiro_id_fkey",
        "push_subscriptions",
        "terreiros",
        ["terreiro_id"],
        ["id"]
    )

    if index_exists("push_subscriptions", "ix_push_subscriptions_endpoint"):
        op.drop_index("ix_push_subscriptions_endpoint", table_name="push_subscriptions")

    if column_exists("push_subscriptions", "updated_at"):
        op.drop_column("push_subscriptions", "updated_at")

    op.drop_constraint("fk_inscricoes_gira_gira_id", "inscricoes_gira", type_="foreignkey")

    op.create_foreign_key(
        "fk_inscricoes_gira_gira_id",
        "inscricoes_gira",
        "giras",
        ["gira_id"],
        ["id"],
        ondelete="CASCADE"
    )

    op.alter_column(
        "giras",
        "limite_consulentes",
        existing_type=sa.INTEGER(),
        nullable=False
    )

    if column_exists("giras", "limite_membros"):
        op.drop_column("giras", "limite_membros")