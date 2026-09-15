"""atendimentos e agendamentos

Revision ID: 0025_atendimentos_agendamentos
Revises: 0024
Create Date: 2026-09-14 22:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0025_atendimentos_agendamentos"
down_revision: Union[str, None] = "0024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


tipo_cobranca_enum = postgresql.ENUM(
    "servico",
    "hora",
    name="tipo_cobranca_atendimento_enum",
    create_type=False,
)

status_agendamento_enum = postgresql.ENUM(
    "agendado",
    "concluido",
    "cancelado",
    name="status_agendamento_enum",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()

    tipo_cobranca_enum.create(bind, checkfirst=True)
    status_agendamento_enum.create(bind, checkfirst=True)

    op.create_table(
        "atendimento_tipos",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("terreiro_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nome", sa.String(length=255), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("valor", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("tipo_cobranca", tipo_cobranca_enum, nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["usuarios.id"]),
        sa.ForeignKeyConstraint(["terreiro_id"], ["terreiros.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_atendimento_tipo_terreiro",
        "atendimento_tipos",
        ["terreiro_id"],
    )

    op.create_index(
        "ix_atendimento_tipo_terreiro_ativo",
        "atendimento_tipos",
        ["terreiro_id", "ativo"],
    )

    op.create_table(
        "agendamentos",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("terreiro_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("consulente_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("atendimento_tipo_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("inicio", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fim", sa.DateTime(timezone=True), nullable=False),
        sa.Column("valor", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("status", status_agendamento_enum, nullable=False),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["atendimento_tipo_id"], ["atendimento_tipos.id"]),
        sa.ForeignKeyConstraint(["consulente_id"], ["consulentes.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["usuarios.id"]),
        sa.ForeignKeyConstraint(["terreiro_id"], ["terreiros.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_agendamento_terreiro_inicio",
        "agendamentos",
        ["terreiro_id", "inicio"],
    )

    op.create_index(
        "ix_agendamento_terreiro_status",
        "agendamentos",
        ["terreiro_id", "status"],
    )

    op.create_index(
        "ix_agendamento_consulente",
        "agendamentos",
        ["consulente_id"],
    )

    op.create_index(
        "ix_agendamento_atendimento_tipo",
        "agendamentos",
        ["atendimento_tipo_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_agendamento_atendimento_tipo",
        table_name="agendamentos",
    )
    op.drop_index(
        "ix_agendamento_consulente",
        table_name="agendamentos",
    )
    op.drop_index(
        "ix_agendamento_terreiro_status",
        table_name="agendamentos",
    )
    op.drop_index(
        "ix_agendamento_terreiro_inicio",
        table_name="agendamentos",
    )
    op.drop_table("agendamentos")

    op.drop_index(
        "ix_atendimento_tipo_terreiro_ativo",
        table_name="atendimento_tipos",
    )
    op.drop_index(
        "ix_atendimento_tipo_terreiro",
        table_name="atendimento_tipos",
    )
    op.drop_table("atendimento_tipos")

    bind = op.get_bind()

    status_agendamento_enum.drop(bind, checkfirst=True)
    tipo_cobranca_enum.drop(bind, checkfirst=True)