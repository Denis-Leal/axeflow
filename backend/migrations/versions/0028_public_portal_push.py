"""Public portal FCM subscriptions and durable notification outbox.

Revision ID: 0028_public_portal_push
Revises: 0027_portal_publico
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0028_public_portal_push"
down_revision = "0027_portal_publico"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "public_push_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("token", sa.Text(), nullable=False),
        sa.Column("terreiro_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("terreiros.id", ondelete="CASCADE"), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_public_push_subscriptions_terreiro_active", "public_push_subscriptions", ["terreiro_id", "active"])
    op.create_index("uq_public_push_subscription_scope", "public_push_subscriptions", ["token", sa.text("COALESCE(terreiro_id, '00000000-0000-0000-0000-000000000000'::uuid)")], unique=True)
    op.create_table(
        "public_push_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("terreiro_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("terreiros.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_key", sa.String(length=255), nullable=False, unique=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("public_push_events")
    op.drop_index("uq_public_push_subscription_scope", table_name="public_push_subscriptions")
    op.drop_index("ix_public_push_subscriptions_terreiro_active", table_name="public_push_subscriptions")
    op.drop_table("public_push_subscriptions")
