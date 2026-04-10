"""
0016_devices_and_notification_logs

Cria:

- devices (FCM tokens por usuário/terreiro)
- notification_logs (auditoria de envio de push)

DECISÕES:
- token UNIQUE → evita duplicidade de device
- index por terreiro → envio rápido por tenant
- notification_logs com index por device_id
- payload_hash indexado (base para deduplicação futura)

Revision ID: 0016_devices_and_notification_logs
Revises: 0015_inventory_system
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0016_devices_and_notification_logs"
down_revision: Union[str, None] = "0015_inventory_system"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ── Helpers ───────────────────────────────────────────

def _tabela_existe(nome: str) -> bool:
    from sqlalchemy import inspect
    return inspect(op.get_bind()).has_table(nome)


# ── Upgrade ───────────────────────────────────────────

def upgrade() -> None:

    # ═══════════════════════════════════════════════════
    # 1. devices
    # ═══════════════════════════════════════════════════
    if not _tabela_existe("devices"):
        op.create_table(
            "devices",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),

            sa.Column("user_id", postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("usuarios.id"), nullable=False),

            sa.Column("terreiro_id", postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("terreiros.id"), nullable=False),

            sa.Column("token", sa.Text(), nullable=False, unique=True),

            sa.Column("platform", sa.String(), nullable=False),
            sa.Column("provider", sa.String(), nullable=False),

            sa.Column("active", sa.Boolean(), server_default="true"),

            sa.Column("last_seen", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()")),
        )

        op.create_index("ix_device_terreiro", "devices", ["terreiro_id"])
        op.create_index("ix_device_user", "devices", ["user_id"])
        op.create_index("ix_device_active", "devices", ["active"])


    # ═══════════════════════════════════════════════════
    # 2. notification_logs
    # ═══════════════════════════════════════════════════
    if not _tabela_existe("notification_logs"):
        op.create_table(
            "notification_logs",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),

            sa.Column("device_id", postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("devices.id"), nullable=True),

            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),

            sa.Column("payload_hash", sa.String(), nullable=False),

            sa.Column("success", sa.Boolean(), server_default="false"),

            sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()")),
        )

        op.create_index("ix_log_device", "notification_logs", ["device_id"])
        op.create_index("ix_log_user", "notification_logs", ["user_id"])
        op.create_index("ix_log_payload", "notification_logs", ["payload_hash"])


# ── Downgrade ─────────────────────────────────────────

def downgrade() -> None:

    if _tabela_existe("notification_logs"):
        op.drop_table("notification_logs")

    if _tabela_existe("devices"):
        op.drop_table("devices")