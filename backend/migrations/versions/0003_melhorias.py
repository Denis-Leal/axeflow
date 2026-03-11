"""melhorias: notas consulente, observacoes inscricao, lista_espera, indices, updated_at

Revision ID: 0003_melhorias
Revises: 0002_cascade_delete
Create Date: 2026-03-11

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0003_melhorias'
down_revision: Union[str, None] = '0002_cascade_delete'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def has_column(table, column):
    bind = op.get_bind()
    return bind.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = :t AND column_name = :c)"
    ), {"t": table, "c": column}).scalar()


def has_index(index_name):
    bind = op.get_bind()
    return bind.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = :i)"
    ), {"i": index_name}).scalar()


def has_constraint(constraint_name):
    bind = op.get_bind()
    return bind.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = :c)"
    ), {"c": constraint_name}).scalar()


def upgrade() -> None:

    # ── consulentes ───────────────────────────────────────────────────────────
    if not has_column("consulentes", "notas"):
        op.add_column("consulentes", sa.Column("notas", sa.Text(), nullable=True))

    if not has_column("consulentes", "updated_at"):
        op.add_column("consulentes", sa.Column("updated_at", sa.DateTime(), nullable=True))
        op.execute(sa.text("UPDATE consulentes SET updated_at = created_at WHERE updated_at IS NULL"))

    # ── inscricoes_gira ───────────────────────────────────────────────────────
    if not has_column("inscricoes_gira", "observacoes"):
        op.add_column("inscricoes_gira", sa.Column("observacoes", sa.Text(), nullable=True))

    if not has_column("inscricoes_gira", "updated_at"):
        op.add_column("inscricoes_gira", sa.Column("updated_at", sa.DateTime(), nullable=True))
        op.execute(sa.text("UPDATE inscricoes_gira SET updated_at = created_at WHERE updated_at IS NULL"))

    # Adiciona lista_espera ao enum de status
    bind = op.get_bind()
    result = bind.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'lista_espera' "
        "AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'statusinscricaoenum'))"
    ))
    if not result.scalar():
        op.execute(sa.text("ALTER TYPE statusinscricaoenum ADD VALUE IF NOT EXISTS 'lista_espera' AFTER 'confirmado'"))

    # Unique constraint gira_id + consulente_id
    if not has_constraint("uq_gira_consulente"):
        # Remove duplicatas antes (cancela as mais antigas)
        op.execute(sa.text("""
            UPDATE inscricoes_gira SET status = 'cancelado'
            WHERE id IN (
                SELECT id FROM (
                    SELECT id, ROW_NUMBER() OVER (
                        PARTITION BY gira_id, consulente_id
                        ORDER BY created_at DESC
                    ) AS rn
                    FROM inscricoes_gira
                    WHERE consulente_id IS NOT NULL
                ) t WHERE rn > 1
            )
        """))
        op.create_unique_constraint("uq_gira_consulente", "inscricoes_gira", ["gira_id", "consulente_id"])

    # ── giras ─────────────────────────────────────────────────────────────────
    if not has_column("giras", "updated_at"):
        op.add_column("giras", sa.Column("updated_at", sa.DateTime(), nullable=True))
        op.execute(sa.text("UPDATE giras SET updated_at = created_at WHERE updated_at IS NULL"))

    # ── usuarios ──────────────────────────────────────────────────────────────
    if not has_column("usuarios", "updated_at"):
        op.add_column("usuarios", sa.Column("updated_at", sa.DateTime(), nullable=True))
        op.execute(sa.text("UPDATE usuarios SET updated_at = created_at WHERE updated_at IS NULL"))

    # ── Índices de performance ────────────────────────────────────────────────
    if not has_index("ix_inscricoes_gira_status"):
        op.create_index("ix_inscricoes_gira_status", "inscricoes_gira", ["gira_id", "status"])

    if not has_index("ix_inscricoes_gira_posicao"):
        op.create_index("ix_inscricoes_gira_posicao", "inscricoes_gira", ["gira_id", "posicao"])

    if not has_index("ix_giras_terreiro_data"):
        op.create_index("ix_giras_terreiro_data", "giras", ["terreiro_id", "data"])

    if not has_index("ix_consulentes_telefone"):
        op.create_index("ix_consulentes_telefone", "consulentes", ["telefone"])


def downgrade() -> None:
    op.drop_index("ix_consulentes_telefone", table_name="consulentes")
    op.drop_index("ix_giras_terreiro_data", table_name="giras")
    op.drop_index("ix_inscricoes_gira_posicao", table_name="inscricoes_gira")
    op.drop_index("ix_inscricoes_gira_status", table_name="inscricoes_gira")
    op.drop_constraint("uq_gira_consulente", "inscricoes_gira", type_="unique")
    op.drop_column("inscricoes_gira", "observacoes")
    op.drop_column("inscricoes_gira", "updated_at")
    op.drop_column("consulentes", "notas")
    op.drop_column("consulentes", "updated_at")
    op.drop_column("giras", "updated_at")
    op.drop_column("usuarios", "updated_at")
