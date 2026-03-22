"""
0012_ajeum.py — AxeFlow

Cria as três tabelas do sistema Ajeum (lista de itens para giras):

  ajeum            — cabeçalho da lista, 1:1 com gira
  ajeum_item       — cada item da lista, com limite e soft delete
  ajeum_selecao    — seleção de um membro por um item, com
                     optimistic locking (version) e histórico completo

Decisões de design documentadas:
  - terreiro_id em TODAS as tabelas: isolamento multi-tenant sem JOIN obrigatório
  - deleted_at em ajeum_item: soft delete para preservar histórico de reputação
  - version em ajeum_selecao: optimistic locking na confirmação pelo admin
  - UNIQUE(item_id, membro_id): última barreira contra seleção duplicada
  - SEM ON DELETE CASCADE: deletes acidentais não apagam histórico silenciosamente
  - Índices nomeados explicitamente: facilita DROP em downgrade e diagnóstico

Revision ID: 0012_ajeum
Revises: 0011_password_reset_tokens
Create Date: 2026-03-21
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0012_ajeum"
down_revision: Union[str, None] = "0011_password_reset_tokens"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ── Helpers de idempotência ────────────────────────────────────────────────────

def _tabela_existe(nome: str) -> bool:
    """Verifica existência da tabela para tornar o upgrade idempotente."""
    from sqlalchemy import inspect
    return inspect(op.get_bind()).has_table(nome)


def _indice_existe(nome: str) -> bool:
    """Verifica existência do índice pelo nome antes de criar/dropar."""
    from sqlalchemy import text
    result = op.get_bind().execute(
        text("SELECT indexname FROM pg_indexes WHERE indexname = :n"),
        {"n": nome},
    )
    return result.fetchone() is not None


def _constraint_existe(nome: str) -> bool:
    """Verifica existência de constraint pelo nome."""
    from sqlalchemy import text
    result = op.get_bind().execute(
        text(
            "SELECT constraint_name FROM information_schema.table_constraints "
            "WHERE constraint_name = :n"
        ),
        {"n": nome},
    )
    return result.fetchone() is not None


def upgrade() -> None:

    # ═══════════════════════════════════════════════════════════════════════════
    # TABELA 1: ajeum
    # Cabeçalho da lista de itens. Relação 1:1 com giras.
    # O UNIQUE(gira_id) é constraint no banco — não apenas índice —
    # para que inserts concorrentes falhem com IntegrityError limpo.
    # ═══════════════════════════════════════════════════════════════════════════
    if not _tabela_existe("ajeum"):
        op.create_table(
            "ajeum",

            # ── Identidade ────────────────────────────────────────────────────
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                # default gerado no Python (model), não no banco,
                # para consistência com o restante do projeto
            ),

            # ── Multi-tenant ──────────────────────────────────────────────────
            # terreiro_id direto (não apenas via join com giras) para que
            # qualquer query possa filtrar isolamento sem JOIN obrigatório
            sa.Column(
                "terreiro_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("terreiros.id"),  # sem CASCADE: delete explícito
                nullable=False,
            ),

            # ── Referência à gira ─────────────────────────────────────────────
            sa.Column(
                "gira_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("giras.id"),      # sem CASCADE: delete explícito
                nullable=False,
            ),

            # ── Rastreabilidade ───────────────────────────────────────────────
            sa.Column(
                "criado_por",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("usuarios.id"),
                nullable=False,
            ),
            sa.Column(
                "observacoes",
                sa.Text,
                nullable=True,   # campo livre para o admin descrever o contexto
            ),

            # ── Timestamps ────────────────────────────────────────────────────
            sa.Column(
                "created_at",
                sa.DateTime,
                nullable=False,
                server_default=sa.text("NOW()"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime,
                nullable=True,
            ),

            # ── Constraint: uma gira, um Ajeum ────────────────────────────────
            # Definida aqui (não apenas como índice único) para que a violação
            # gere ConstraintViolation com nome descritivo, não apenas UniqueViolation genérico
            sa.UniqueConstraint("gira_id", name="uq_ajeum_gira"),
        )

        # Índice de listagem por terreiro ordenada por data
        op.create_index("ix_ajeum_terreiro_created", "ajeum", ["terreiro_id", "created_at"])

    # ═══════════════════════════════════════════════════════════════════════════
    # TABELA 2: ajeum_item
    # Cada item da lista (ex: "Bacon", "Refrigerante").
    # Soft delete via deleted_at: itens removidos preservam seleções históricas.
    # ═══════════════════════════════════════════════════════════════════════════
    if not _tabela_existe("ajeum_item"):
        op.create_table(
            "ajeum_item",

            # ── Identidade ────────────────────────────────────────────────────
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),

            # ── Multi-tenant ──────────────────────────────────────────────────
            sa.Column(
                "terreiro_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("terreiros.id"),
                nullable=False,
            ),

            # ── Referência ao Ajeum pai ───────────────────────────────────────
            sa.Column(
                "ajeum_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("ajeum.id"),  # sem CASCADE intencional
                nullable=False,
            ),

            # ── Dados do item ─────────────────────────────────────────────────
            sa.Column(
                "descricao",
                sa.String(255),
                nullable=False,
            ),
            sa.Column(
                "limite",
                sa.Integer,
                nullable=False,
                # CHECK garante que nunca existe item com limite 0 ou negativo
                # mesmo que a validação Python seja bypassada
            ),

            # ── Soft delete ───────────────────────────────────────────────────
            # NULL = ativo, preenchido = deletado.
            # Queries de listagem sempre filtram WHERE deleted_at IS NULL.
            # Queries de histórico/reputação IGNORAM este filtro.
            sa.Column("deleted_at", sa.DateTime, nullable=True),

            # ── Timestamps ────────────────────────────────────────────────────
            sa.Column(
                "created_at",
                sa.DateTime,
                nullable=False,
                server_default=sa.text("NOW()"),
            ),
            sa.Column("updated_at", sa.DateTime, nullable=True),

            # ── CHECK constraint: limite mínimo ───────────────────────────────
            sa.CheckConstraint("limite >= 1", name="ck_ajeum_item_limite_positivo"),
        )

        # Índice principal: busca de itens por Ajeum (query mais frequente)
        op.create_index("ix_ajeum_item_ajeum", "ajeum_item", ["ajeum_id"])

        # Índice composto para listagem ativa: ajeum_id + deleted_at
        # O PostgreSQL usa este índice quando filtramos WHERE deleted_at IS NULL
        op.create_index(
            "ix_ajeum_item_ajeum_ativo",
            "ajeum_item",
            ["ajeum_id", "deleted_at"],
        )

        # Índice por terreiro para queries de inventário futuro
        op.create_index("ix_ajeum_item_terreiro", "ajeum_item", ["terreiro_id"])

    # ═══════════════════════════════════════════════════════════════════════════
    # TABELA 3: ajeum_selecao
    # Seleção de um membro por um item específico.
    #
    # Decisões críticas:
    #   - version (optimistic locking): evita que dois admins sobrescrevam
    #     confirmação simultânea silenciosamente
    #   - UNIQUE(item_id, membro_id): barreira final no banco contra duplicata,
    #     independente de qualquer bug no código
    #   - SEM delete CASCADE: seleções são históricas, nunca apagadas
    #   - status como VARCHAR(50) igual ao padrão do projeto (não ENUM PostgreSQL)
    #     para facilitar ADD VALUE em migrations futuras sem lock de tabela
    # ═══════════════════════════════════════════════════════════════════════════
    if not _tabela_existe("ajeum_selecao"):
        op.create_table(
            "ajeum_selecao",

            # ── Identidade ────────────────────────────────────────────────────
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),

            # ── Multi-tenant ──────────────────────────────────────────────────
            sa.Column(
                "terreiro_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("terreiros.id"),
                nullable=False,
            ),

            # ── Referências ───────────────────────────────────────────────────
            sa.Column(
                "item_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("ajeum_item.id"),  # sem CASCADE
                nullable=False,
            ),
            sa.Column(
                "membro_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("usuarios.id"),
                nullable=False,
            ),

            # ── Estado da seleção ─────────────────────────────────────────────
            # VARCHAR(50) igual ao padrão do projeto (não ENUM PostgreSQL)
            # Valores válidos: selecionado | confirmado | nao_entregue | cancelado
            sa.Column(
                "status",
                sa.String(50),
                nullable=False,
                server_default="selecionado",
            ),

            # ── Optimistic locking ────────────────────────────────────────────
            # Incrementado a cada UPDATE de status.
            # O serviço envia a version que leu; se não bater, retorna 409.
            # Previne que dois admins sobrescrevam confirmação simultaneamente.
            sa.Column(
                "version",
                sa.Integer,
                nullable=False,
                server_default="1",
            ),

            # ── Confirmação pelo admin ────────────────────────────────────────
            # Preenchidos apenas quando status muda para confirmado/nao_entregue
            sa.Column(
                "confirmado_por",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("usuarios.id"),
                nullable=True,
            ),
            sa.Column("confirmado_em", sa.DateTime, nullable=True),

            # ── Timestamps ────────────────────────────────────────────────────
            sa.Column(
                "created_at",
                sa.DateTime,
                nullable=False,
                server_default=sa.text("NOW()"),
            ),
            sa.Column("updated_at", sa.DateTime, nullable=True),

            # ── Constraint de unicidade: última barreira contra duplicata ─────
            # Dois requests simultâneos do mesmo membro no mesmo item:
            # um insere com sucesso, o outro recebe IntegrityError → 409 limpo.
            # Abrange seleções canceladas também: o serviço deve fazer upsert,
            # não insert cego.
            sa.UniqueConstraint(
                "item_id",
                "membro_id",
                name="uq_ajeum_selecao_item_membro",
            ),

            # ── CHECK constraint: status válido ───────────────────────────────
            sa.CheckConstraint(
                "status IN ('selecionado', 'confirmado', 'nao_entregue', 'cancelado')",
                name="ck_ajeum_selecao_status",
            ),

            # ── CHECK constraint: confirmação consistente ─────────────────────
            # Se status é confirmado/nao_entregue, confirmado_por deve existir.
            # Evita registros finalizados sem rastreabilidade de quem confirmou.
            sa.CheckConstraint(
                "(status NOT IN ('confirmado', 'nao_entregue')) OR "
                "(confirmado_por IS NOT NULL AND confirmado_em IS NOT NULL)",
                name="ck_ajeum_selecao_confirmacao_consistente",
            ),
        )

        # ── Índices de ajeum_selecao ──────────────────────────────────────────

        # Índice crítico para o FOR UPDATE na seleção:
        # SELECT ... WHERE item_id = :id AND status != 'cancelado' FOR UPDATE
        # Sem este índice, o lock faz full scan na tabela inteira.
        op.create_index(
            "ix_ajeum_selecao_item_status",
            "ajeum_selecao",
            ["item_id", "status"],
        )

        # Índice para query de reputação futura:
        # "todas as seleções do membro X no terreiro Y"
        # Sem este índice, ranking de membros é full scan global.
        op.create_index(
            "ix_ajeum_selecao_terreiro_membro",
            "ajeum_selecao",
            ["terreiro_id", "membro_id", "status"],
        )

        # Índice para auditoria por item (quem selecionou, em que ordem)
        op.create_index(
            "ix_ajeum_selecao_item_created",
            "ajeum_selecao",
            ["item_id", "created_at"],
        )

        # Índice para busca de seleções de um membro específico (tela de perfil)
        op.create_index(
            "ix_ajeum_selecao_membro",
            "ajeum_selecao",
            ["membro_id"],
        )


def downgrade() -> None:
    """
    Downgrade seguro: remove na ordem inversa de dependência.
    Verifica existência antes de dropar para ser idempotente.
    """

    # ajeum_selecao primeiro (depende de ajeum_item)
    if _tabela_existe("ajeum_selecao"):
        for idx in [
            "ix_ajeum_selecao_membro",
            "ix_ajeum_selecao_item_created",
            "ix_ajeum_selecao_terreiro_membro",
            "ix_ajeum_selecao_item_status",
        ]:
            if _indice_existe(idx):
                op.drop_index(idx, table_name="ajeum_selecao")
        op.drop_table("ajeum_selecao")

    # ajeum_item segundo (depende de ajeum)
    if _tabela_existe("ajeum_item"):
        for idx in [
            "ix_ajeum_item_terreiro",
            "ix_ajeum_item_ajeum_ativo",
            "ix_ajeum_item_ajeum",
        ]:
            if _indice_existe(idx):
                op.drop_index(idx, table_name="ajeum_item")
        op.drop_table("ajeum_item")

    # ajeum por último
    if _tabela_existe("ajeum"):
        if _indice_existe("ix_ajeum_terreiro_created"):
            op.drop_index("ix_ajeum_terreiro_created", table_name="ajeum")
        op.drop_table("ajeum")