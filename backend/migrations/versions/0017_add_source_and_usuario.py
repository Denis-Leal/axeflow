"""
0017_add_source_and_usuario_to_inscricoes

Adiciona:

- consulentes:
    - created_by
    - source

- inscricoes_consulente:
    - usuario_id (FK usuarios)
    - source

DECISÕES:
- campos nullable para evitar quebra em produção
- FK com índice manual para performance futura
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0017_add_source_and_usuario"
down_revision: Union[str, None] = "0016_devices_and_notification_logs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    # ── CONSULENTES ───────────────────────────────────
    op.add_column(
        "consulentes",
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.add_column(
        "consulentes",
        sa.Column("source", sa.String(length=255), nullable=True),
    )

    # ── INSCRICOES_CONSULENTE ─────────────────────────
    op.add_column(
        "inscricoes_consulente",
        sa.Column("usuario_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.add_column(
        "inscricoes_consulente",
        sa.Column("source", sa.String(length=255), nullable=True),
    )

    # FK
    op.create_foreign_key(
        "fk_inscricao_usuario",
        "inscricoes_consulente",
        "usuarios",
        ["usuario_id"],
        ["id"],
    )

    # índice importante
    op.create_index(
        "ix_inscricao_consulente_usuario",
        "inscricoes_consulente",
        ["usuario_id"],
    )


def downgrade() -> None:

    # ── INSCRICOES_CONSULENTE ─────────────────────────
    op.drop_index("ix_inscricao_consulente_usuario", table_name="inscricoes_consulente")

    op.drop_constraint(
        "fk_inscricao_usuario",
        "inscricoes_consulente",
        type_="foreignkey",
    )

    op.drop_column("inscricoes_consulente", "source")
    op.drop_column("inscricoes_consulente", "usuario_id")

    # ── CONSULENTES ───────────────────────────────────
    op.drop_column("consulentes", "source")
    op.drop_column("consulentes", "created_by")