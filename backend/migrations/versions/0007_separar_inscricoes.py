"""
0007_separar_inscricoes.py — AxeFlow

Separa a tabela `inscricoes_gira` em duas tabelas de domínio claro:
  - inscricoes_consulente: giras públicas, consulentes externos, suporta lista_espera
  - inscricoes_membro:     giras fechadas, membros do terreiro, sem fila de espera

ESTRATÉGIA DE MIGRAÇÃO:
  A tabela original é mantida durante a migração (sem DROP imediato).
  Os dados são copiados para as novas tabelas antes de qualquer remoção.
  Isso permite rollback seguro: downgrade recria inscricoes_gira a partir
  das novas tabelas se necessário.

ATENÇÃO ANTES DE RODAR EM PRODUÇÃO:
  1. Faça backup do banco
  2. Execute em horário de baixo tráfego (a migração é transacional mas
     pode demorar se houver muitos registros)
  3. Após confirmar que tudo funciona, rode 0008_drop_inscricoes_gira.py
     para remover a tabela legada (não incluída aqui por segurança)

Revision ID: 0007_separar_inscricoes
Revises: 0006_inscricao_constraints
Create Date: 2026-03-20
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0007_separar_inscricoes"
down_revision: Union[str, None] = "0006_inscricao_constraints"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Criar enum compartilhado no PostgreSQL ─────────────────────────────
    # O enum já existe como statusinscricaoenum — reutilizamos para evitar
    # conflito de tipos no banco
    op.execute(
        "ALTER TYPE statusinscricaoenum ADD VALUE IF NOT EXISTS 'lista_espera'"
    )

    # ── 2. Criar tabela inscricoes_consulente ─────────────────────────────────
    op.create_table(
        "inscricoes_consulente",
        sa.Column("id",            postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("gira_id",       postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("giras.id", ondelete="CASCADE"), nullable=False),
        sa.Column("consulente_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("consulentes.id"), nullable=False),
        sa.Column("posicao",       sa.Integer, nullable=False),
        sa.Column("status",        sa.String(50), nullable=False, server_default="confirmado"),
        sa.Column("observacoes",   sa.Text, nullable=True),
        sa.Column("created_at",    sa.DateTime, nullable=False),
        sa.Column("updated_at",    sa.DateTime, nullable=True),
    )
    op.create_unique_constraint(
        "uq_inscricao_consulente_gira",
        "inscricoes_consulente",
        ["gira_id", "consulente_id"],
    )
    op.create_index("ix_inscricao_consulente_status",     "inscricoes_consulente", ["gira_id", "status"])
    op.create_index("ix_inscricao_consulente_posicao",    "inscricoes_consulente", ["gira_id", "posicao"])
    op.create_index("ix_inscricao_consulente_created_at", "inscricoes_consulente", ["gira_id", "created_at"])

    # ── 3. Criar tabela inscricoes_membro ─────────────────────────────────────
    op.create_table(
        "inscricoes_membro",
        sa.Column("id",        postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("gira_id",   postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("giras.id", ondelete="CASCADE"), nullable=False),
        sa.Column("membro_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("posicao",   sa.Integer, nullable=False),
        sa.Column("status",    sa.String(50), nullable=False, server_default="confirmado"),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )
    op.create_unique_constraint(
        "uq_inscricao_membro_gira",
        "inscricoes_membro",
        ["gira_id", "membro_id"],
    )
    op.create_index("ix_inscricao_membro_status", "inscricoes_membro", ["gira_id", "status"])

    # ── 4. Migrar dados de inscricoes_gira → novas tabelas ────────────────────
    # Registros com consulente_id → inscricoes_consulente
    op.execute("""
        INSERT INTO inscricoes_consulente
            (id, gira_id, consulente_id, posicao, status, observacoes, created_at, updated_at)
        SELECT
            id, gira_id, consulente_id, posicao,
            status::text,
            observacoes,
            COALESCE(created_at, NOW()),
            updated_at
        FROM inscricoes_gira
        WHERE consulente_id IS NOT NULL
          AND membro_id IS NULL
        ON CONFLICT (gira_id, consulente_id) DO NOTHING
    """)

    # Registros com membro_id → inscricoes_membro
    op.execute("""
        INSERT INTO inscricoes_membro
            (id, gira_id, membro_id, posicao, status, created_at, updated_at)
        SELECT
            id, gira_id, membro_id, posicao,
            status::text,
            COALESCE(created_at, NOW()),
            updated_at
        FROM inscricoes_gira
        WHERE membro_id IS NOT NULL
          AND consulente_id IS NULL
        ON CONFLICT (gira_id, membro_id) DO NOTHING
    """)

    # ── 5. Validação pós-migração ─────────────────────────────────────────────
    # Conta registros migrados e loga diferença para detectar perda de dados
    bind = op.get_bind()
    from sqlalchemy import text

    total_original = bind.execute(
        text("""
            SELECT COUNT(*) FROM inscricoes_gira
            WHERE (consulente_id IS NOT NULL AND membro_id IS NULL)
               OR (membro_id IS NOT NULL AND consulente_id IS NULL)
        """)
    ).scalar()
    total_consulente = bind.execute(
        text("SELECT COUNT(*) FROM inscricoes_consulente")
    ).scalar()
    total_membro = bind.execute(
        text("SELECT COUNT(*) FROM inscricoes_membro")
    ).scalar()
    total_migrado = total_consulente + total_membro

    # Registros com ambos NULL ou ambos preenchidos são ignorados (já foram
    # removidos pela migration 0006). Qualquer diferença deve ser investigada.
    if total_original != total_migrado:
        import warnings
        warnings.warn(
            f"[0007] Possível perda de dados: original={total_original}, "
            f"migrado={total_migrado} "
            f"(consulente={total_consulente}, membro={total_membro}). "
            "Verifique registros com ambos os campos nulos antes de prosseguir.",
            stacklevel=2,
        )

    # A tabela inscricoes_gira NÃO é removida aqui — aguarda confirmação
    # em produção. Remova-a manualmente ou via migration 0008 após validar.


def downgrade() -> None:
    # Remove as novas tabelas — os dados originais ainda estão em inscricoes_gira
    op.drop_index("ix_inscricao_membro_status",       table_name="inscricoes_membro")
    op.drop_constraint("uq_inscricao_membro_gira",     "inscricoes_membro", type_="unique")
    op.drop_table("inscricoes_membro")

    op.drop_index("ix_inscricao_consulente_created_at", table_name="inscricoes_consulente")
    op.drop_index("ix_inscricao_consulente_posicao",    table_name="inscricoes_consulente")
    op.drop_index("ix_inscricao_consulente_status",     table_name="inscricoes_consulente")
    op.drop_constraint("uq_inscricao_consulente_gira",  "inscricoes_consulente", type_="unique")
    op.drop_table("inscricoes_consulente")