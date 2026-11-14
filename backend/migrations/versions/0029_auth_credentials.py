"""Versão das sessões e finalidade dos tokens de definição de senha."""
from alembic import op
import sqlalchemy as sa


revision = "0029_auth_credentials"
down_revision = "0028_public_portal_push"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "usuarios", sa.Column("token_version", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column(
        "password_reset_tokens", sa.Column("purpose", sa.String(length=16), nullable=False, server_default="reset"),
    )


def downgrade() -> None:
    op.drop_column("password_reset_tokens", "purpose")
    op.drop_column("usuarios", "token_version")
