"""
0006_inscricao_constraints.py — AxeFlow

Corrige problemas estruturais críticos na tabela inscricoes_gira:

1. CHECK constraint de exclusividade de participante
   - Garante que consulente_id XOR membro_id está preenchido
   - Sem isso o banco aceita ambos NULL ou ambos preenchidos

2. UniqueConstraint para membro_id
   - Previne inscrição duplicada de membro em gira fechada
   - Equivalente ao que já existe para consulente_id

3. Índice em (gira_id, created_at)
   - Suporte a ordenação por chegada (fonte autoritativa em concorrência)
   - Complementa ix_inscricao_gira_posicao sem substituí-lo

Revision ID: 0006_inscricao_constraints
Revises: 0005_push_to_terreiro
Create Date: 2026-03-20
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "0006_inscricao_constraints"
down_revision: Union[str, None] = "0005_push_to_terreiro"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _constraint_existe(nome: str) -> bool:
    """Verifica se a constraint já existe — necessário apenas para idempotência aqui."""
    from sqlalchemy import text
    bind = op.get_bind()
    result = bind.execute(
        text(
            "SELECT constraint_name FROM information_schema.table_constraints "
            "WHERE constraint_name = :n"
        ),
        {"n": nome},
    )
    return result.fetchone() is not None


def _indice_existe(nome: str) -> bool:
    from sqlalchemy import text
    bind = op.get_bind()
    result = bind.execute(
        text("SELECT indexname FROM pg_indexes WHERE indexname = :n"),
        {"n": nome},
    )
    return result.fetchone() is not None


def upgrade() -> None:
    # ── 1. Limpar dados inválidos antes de adicionar constraints ─────────────
    # Remove registros que violam a exclusividade (ambos NULL ou ambos preenchidos)
    # Em produção com dados reais, inspecionar antes de rodar.
    op.execute("""
        DELETE FROM inscricoes_gira
        WHERE consulente_id IS NULL AND membro_id IS NULL
    """)
    op.execute("""
        DELETE FROM inscricoes_gira
        WHERE consulente_id IS NOT NULL AND membro_id IS NOT NULL
    """)

    # ── 2. CHECK constraint: exatamente um participante ──────────────────────
    if not _constraint_existe("ck_inscricao_exactly_one_participant"):
        op.create_check_constraint(
            "ck_inscricao_exactly_one_participant",
            "inscricoes_gira",
            "(consulente_id IS NOT NULL AND membro_id IS NULL) OR "
            "(consulente_id IS NULL AND membro_id IS NOT NULL)",
        )

    # ── 3. UniqueConstraint para membro_id ───────────────────────────────────
    # Remove duplicatas de membro antes de criar a constraint
    op.execute("""
        DELETE FROM inscricoes_gira a
        USING inscricoes_gira b
        WHERE a.id > b.id
          AND a.gira_id = b.gira_id
          AND a.membro_id = b.membro_id
          AND a.membro_id IS NOT NULL
    """)
    if not _constraint_existe("uq_inscricao_gira_membro"):
        op.create_unique_constraint(
            "uq_inscricao_gira_membro",
            "inscricoes_gira",
            ["gira_id", "membro_id"],
        )

    # ── 4. Índice em (gira_id, created_at) ───────────────────────────────────
    if not _indice_existe("ix_inscricao_gira_created_at"):
        op.create_index(
            "ix_inscricao_gira_created_at",
            "inscricoes_gira",
            ["gira_id", "created_at"],
        )


def downgrade() -> None:
    if _indice_existe("ix_inscricao_gira_created_at"):
        op.drop_index("ix_inscricao_gira_created_at", table_name="inscricoes_gira")

    if _constraint_existe("uq_inscricao_gira_membro"):
        op.drop_constraint("uq_inscricao_gira_membro", "inscricoes_gira", type_="unique")

    if _constraint_existe("ck_inscricao_exactly_one_participant"):
        op.drop_constraint(
            "ck_inscricao_exactly_one_participant",
            "inscricoes_gira",
            type_="check",
        )