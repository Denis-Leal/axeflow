"""financeiro inicial

Revision ID: 0026_financeiro_inicial
Revises: 0025_atendimentos_agendamentos
Create Date: 2026-09-15 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0026_financeiro_inicial"
down_revision: Union[str, None] = "0025_atendimentos_agendamentos"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


status_conta_receber_enum = postgresql.ENUM(
    "pendente",
    "parcial",
    "pago",
    "cancelado",
    name="status_conta_receber_enum",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()

    status_conta_receber_enum.create(
        bind,
        checkfirst=True,
    )

    op.create_table(
        "formas_pagamento",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "terreiro_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "nome",
            sa.String(length=100),
            nullable=False,
        ),
        sa.Column(
            "ativo",
            sa.Boolean(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["terreiro_id"],
            ["terreiros.id"],
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["usuarios.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_forma_pagamento_terreiro",
        "formas_pagamento",
        ["terreiro_id"],
    )

    op.create_index(
        "ix_forma_pagamento_terreiro_ativo",
        "formas_pagamento",
        ["terreiro_id", "ativo"],
    )

    op.create_table(
        "contas_receber",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "terreiro_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "agendamento_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "consulente_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "descricao",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "valor",
            sa.Numeric(12, 2),
            nullable=False,
        ),
        sa.Column(
            "status",
            status_conta_receber_enum,
            nullable=False,
        ),
        sa.Column(
            "data_vencimento",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "data_pagamento",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["terreiro_id"],
            ["terreiros.id"],
        ),
        sa.ForeignKeyConstraint(
            ["agendamento_id"],
            ["agendamentos.id"],
        ),
        sa.ForeignKeyConstraint(
            ["consulente_id"],
            ["consulentes.id"],
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["usuarios.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "agendamento_id",
            name="uq_conta_receber_agendamento",
        ),
    )

    op.create_index(
        "ix_conta_receber_terreiro",
        "contas_receber",
        ["terreiro_id"],
    )

    op.create_index(
        "ix_conta_receber_terreiro_status",
        "contas_receber",
        ["terreiro_id", "status"],
    )

    op.create_index(
        "ix_conta_receber_consulente",
        "contas_receber",
        ["consulente_id"],
    )

    op.create_index(
        "ix_conta_receber_agendamento",
        "contas_receber",
        ["agendamento_id"],
    )

    op.create_table(
        "pagamentos",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "terreiro_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "conta_receber_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "forma_pagamento_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "valor",
            sa.Numeric(12, 2),
            nullable=False,
        ),
        sa.Column(
            "data_pagamento",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "observacoes",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["terreiro_id"],
            ["terreiros.id"],
        ),
        sa.ForeignKeyConstraint(
            ["conta_receber_id"],
            ["contas_receber.id"],
        ),
        sa.ForeignKeyConstraint(
            ["forma_pagamento_id"],
            ["formas_pagamento.id"],
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["usuarios.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_pagamento_terreiro",
        "pagamentos",
        ["terreiro_id"],
    )

    op.create_index(
        "ix_pagamento_conta_receber",
        "pagamentos",
        ["conta_receber_id"],
    )

    op.create_index(
        "ix_pagamento_forma",
        "pagamentos",
        ["forma_pagamento_id"],
    )

    op.create_index(
        "ix_pagamento_data",
        "pagamentos",
        ["terreiro_id", "data_pagamento"],
    )

    op.create_table(
        "recibos",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "terreiro_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "pagamento_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "numero",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column(
            "emitido_em",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["terreiro_id"],
            ["terreiros.id"],
        ),
        sa.ForeignKeyConstraint(
            ["pagamento_id"],
            ["pagamentos.id"],
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["usuarios.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "pagamento_id",
            name="uq_recibo_pagamento",
        ),
    )

    op.create_index(
        "ix_recibo_terreiro",
        "recibos",
        ["terreiro_id"],
    )

    op.create_index(
        "ix_recibo_pagamento",
        "recibos",
        ["pagamento_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_recibo_pagamento",
        table_name="recibos",
    )
    op.drop_index(
        "ix_recibo_terreiro",
        table_name="recibos",
    )
    op.drop_table("recibos")

    op.drop_index(
        "ix_pagamento_data",
        table_name="pagamentos",
    )
    op.drop_index(
        "ix_pagamento_forma",
        table_name="pagamentos",
    )
    op.drop_index(
        "ix_pagamento_conta_receber",
        table_name="pagamentos",
    )
    op.drop_index(
        "ix_pagamento_terreiro",
        table_name="pagamentos",
    )
    op.drop_table("pagamentos")

    op.drop_index(
        "ix_conta_receber_agendamento",
        table_name="contas_receber",
    )
    op.drop_index(
        "ix_conta_receber_consulente",
        table_name="contas_receber",
    )
    op.drop_index(
        "ix_conta_receber_terreiro_status",
        table_name="contas_receber",
    )
    op.drop_index(
        "ix_conta_receber_terreiro",
        table_name="contas_receber",
    )
    op.drop_table("contas_receber")

    op.drop_index(
        "ix_forma_pagamento_terreiro_ativo",
        table_name="formas_pagamento",
    )
    op.drop_index(
        "ix_forma_pagamento_terreiro",
        table_name="formas_pagamento",
    )
    op.drop_table("formas_pagamento")

    bind = op.get_bind()

    status_conta_receber_enum.drop(
        bind,
        checkfirst=True,
    )