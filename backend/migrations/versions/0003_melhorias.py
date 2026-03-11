"""
Melhorias de qualidade: soft delete, updated_at, observações, notas,
lista_espera status, índices de performance e unique constraint.

Revision ID: 0003_melhorias
Revises: 0002_cascade_delete
Create Date: 2026-03-11
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '0003_melhorias'
down_revision: Union[str, None] = '0002_cascade_delete'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def coluna_existe(tabela: str, coluna: str) -> bool:
    """Verifica se coluna já existe (idempotente em re-execuções)."""
    from sqlalchemy import text
    bind = op.get_bind()
    result = bind.execute(
        text("SELECT column_name FROM information_schema.columns "
             "WHERE table_name = :t AND column_name = :c"),
        {"t": tabela, "c": coluna}
    )
    return result.fetchone() is not None


def indice_existe(nome: str) -> bool:
    """Verifica se índice já existe."""
    from sqlalchemy import text
    bind = op.get_bind()
    result = bind.execute(
        text("SELECT indexname FROM pg_indexes WHERE indexname = :n"),
        {"n": nome}
    )
    return result.fetchone() is not None


def constraint_existe(nome: str) -> bool:
    """Verifica se constraint já existe."""
    from sqlalchemy import text
    bind = op.get_bind()
    result = bind.execute(
        text("SELECT constraint_name FROM information_schema.table_constraints "
             "WHERE constraint_name = :n"),
        {"n": nome}
    )
    return result.fetchone() is not None


def upgrade() -> None:

    # ── Giras: soft delete + updated_at ───────────────────────────────────────
    if not coluna_existe("giras", "deleted_at"):
        op.add_column("giras", sa.Column("deleted_at", sa.DateTime, nullable=True))

    if not coluna_existe("giras", "updated_at"):
        op.add_column("giras", sa.Column("updated_at", sa.DateTime, nullable=True))

    # ── Usuarios: updated_at ──────────────────────────────────────────────────
    if not coluna_existe("usuarios", "updated_at"):
        op.add_column("usuarios", sa.Column("updated_at", sa.DateTime, nullable=True))

    # ── Consulentes: updated_at + notas ──────────────────────────────────────
    if not coluna_existe("consulentes", "updated_at"):
        op.add_column("consulentes", sa.Column("updated_at", sa.DateTime, nullable=True))

    if not coluna_existe("consulentes", "notas"):
        op.add_column("consulentes", sa.Column("notas", sa.Text, nullable=True))

    # ── InscricaoGira: observacoes + updated_at ───────────────────────────────
    if not coluna_existe("inscricoes_gira", "observacoes"):
        op.add_column("inscricoes_gira", sa.Column("observacoes", sa.Text, nullable=True))

    if not coluna_existe("inscricoes_gira", "updated_at"):
        op.add_column("inscricoes_gira", sa.Column("updated_at", sa.DateTime, nullable=True))

    # ── Status lista_espera: adiciona valor ao enum existente ─────────────────
    # PostgreSQL exige ALTER TYPE para adicionar valor ao enum
    op.execute(
        "ALTER TYPE statusinscricaoenum ADD VALUE IF NOT EXISTS 'lista_espera'"
    )

    # ── Índices de performance ────────────────────────────────────────────────
    if not indice_existe("ix_giras_terreiro_data"):
        op.create_index("ix_giras_terreiro_data", "giras", ["terreiro_id", "data"])

    if not indice_existe("ix_giras_slug_publico"):
        op.create_index("ix_giras_slug_publico", "giras", ["slug_publico"])

    if not indice_existe("ix_inscricao_gira_status"):
        op.create_index("ix_inscricao_gira_status", "inscricoes_gira", ["gira_id", "status"])

    if not indice_existe("ix_inscricao_gira_posicao"):
        op.create_index("ix_inscricao_gira_posicao", "inscricoes_gira", ["gira_id", "posicao"])

    if not indice_existe("ix_consulentes_telefone"):
        op.create_index("ix_consulentes_telefone", "consulentes", ["telefone"])

    # ── Unique constraint: 1 inscrição ativa por consulente por gira ──────────
    # Só cria se não existir para ser idempotente
    if not constraint_existe("uq_inscricao_gira_consulente"):
        # Remove duplicatas antes de criar o constraint (segurança)
        op.execute("""
            DELETE FROM inscricoes_gira a
            USING inscricoes_gira b
            WHERE a.id > b.id
              AND a.gira_id = b.gira_id
              AND a.consulente_id = b.consulente_id
              AND a.consulente_id IS NOT NULL
        """)
        op.create_unique_constraint(
            "uq_inscricao_gira_consulente",
            "inscricoes_gira",
            ["gira_id", "consulente_id"],
        )


def downgrade() -> None:
    # Remove na ordem inversa
    if constraint_existe("uq_inscricao_gira_consulente"):
        op.drop_constraint("uq_inscricao_gira_consulente", "inscricoes_gira")

    for idx in [
        "ix_consulentes_telefone", "ix_inscricao_gira_posicao",
        "ix_inscricao_gira_status", "ix_giras_slug_publico",
        "ix_giras_terreiro_data",
    ]:
        if indice_existe(idx):
            op.drop_index(idx)

    for tabela, coluna in [
        ("inscricoes_gira", "updated_at"),
        ("inscricoes_gira", "observacoes"),
        ("consulentes", "notas"),
        ("consulentes", "updated_at"),
        ("usuarios", "updated_at"),
        ("giras", "updated_at"),
        ("giras", "deleted_at"),
    ]:
        if coluna_existe(tabela, coluna):
            op.drop_column(tabela, coluna)
