"""
0015_inventory_system.py — AxeFlow

Cria todas as tabelas do sistema de inventário:

  inventory_owners      — proprietário do estoque (médium ou terreiro)
  inventory_items       — itens com categoria, threshold e custo unitário
  inventory_movements   — ledger append-only de movimentações
  gira_item_consumptions — consumos por médium por gira (pré-finalização)
  inventory_alerts       — alertas de estoque baixo
  gira_notifications     — notificações por evento de gira

Adiciona coluna em giras:
  estoque_processado (boolean) — flag de idempotência da finalização

DECISÕES DE SEGURANÇA:
  - Sem ON DELETE CASCADE em inventory_movements:
    movimentações são históricas e nunca devem ser apagadas automaticamente
  - Sem ON DELETE CASCADE em gira_item_consumptions:
    auditabilidade: mesmo gira deletada, consumo permanece para análise
  - CHECK quantity > 0 em movements e consumptions:
    garante que ledger nunca registra quantidade inválida
  - UNIQUE(type, reference_id) em inventory_owners:
    previne owner duplicado para o mesmo médium

ÍNDICES CRIADOS:
  Priorizados para as queries mais frequentes:
    1. listar itens por terreiro (listagem principal)
    2. calcular saldo (SUM de movimentações por item)
    3. buscar consumos por gira (finalização)
    4. alertas abertos por item

Revision ID: 0015_inventory_system
Revises: 0014_push_subscriptions_updated_at
Create Date: 2026-04-04
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0015_inventory_system"
down_revision: Union[str, None] = "0014_push_subscriptions_updated_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ── Helpers de idempotência ────────────────────────────────────────────────────

def _tabela_existe(nome: str) -> bool:
    from sqlalchemy import inspect
    return inspect(op.get_bind()).has_table(nome)


def _coluna_existe(tabela: str, coluna: str) -> bool:
    from sqlalchemy import text
    result = op.get_bind().execute(
        text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = :t AND column_name = :c"
        ),
        {"t": tabela, "c": coluna},
    )
    return result.fetchone() is not None


def _indice_existe(nome: str) -> bool:
    from sqlalchemy import text
    result = op.get_bind().execute(
        text("SELECT indexname FROM pg_indexes WHERE indexname = :n"),
        {"n": nome},
    )
    return result.fetchone() is not None


def _constraint_existe(nome: str) -> bool:
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
    # 1. COLUNA estoque_processado em giras
    #    Necessária antes das tabelas de inventory para que a FK funcione
    #    e para que o service possa marcar a gira como processada.
    # ═══════════════════════════════════════════════════════════════════════════
    if not _coluna_existe("giras", "estoque_processado"):
        op.add_column(
            "giras",
            sa.Column(
                "estoque_processado",
                sa.Boolean,
                nullable=False,
                server_default="false",  # giras existentes = não processadas
            ),
        )

    # ═══════════════════════════════════════════════════════════════════════════
    # 2. inventory_owners
    #    Owner pode ser MEDIUM (reference_id = usuario.id)
    #    ou TERREIRO (reference_id = terreiro.id).
    #    UNIQUE(type, reference_id) previne owner duplicado.
    # ═══════════════════════════════════════════════════════════════════════════
    if not _tabela_existe("inventory_owners"):
        op.create_table(
            "inventory_owners",
            sa.Column("id",           postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("type",         sa.String(20),  nullable=False),
            sa.Column("reference_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.CheckConstraint(
                "type IN ('MEDIUM', 'TERREIRO')",
                name="ck_inventory_owner_type",
            ),
            sa.UniqueConstraint("type", "reference_id", name="uq_inventory_owner_type_ref"),
        )
        op.create_index("ix_inventory_owner_reference", "inventory_owners", ["reference_id"])

    # ═══════════════════════════════════════════════════════════════════════════
    # 3. inventory_items
    #    Item de estoque. Saldo NÃO armazenado aqui — calculado via movements.
    #    deleted_at: soft delete mantém referências históricas em movements.
    # ═══════════════════════════════════════════════════════════════════════════
    if not _tabela_existe("inventory_items"):
        op.create_table(
            "inventory_items",
            sa.Column("id",                postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("terreiro_id",       postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("terreiros.id"), nullable=False),
            sa.Column("owner_id",          postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("inventory_owners.id"), nullable=False),
            sa.Column("name",              sa.String(255), nullable=False),
            sa.Column("category",          sa.String(50),  nullable=False),
            sa.Column("minimum_threshold", sa.Integer,     nullable=False, server_default="0"),
            # NUMERIC(10,2): até R$99.999.999,99 com 2 casas decimais
            sa.Column("unit_cost",         sa.Numeric(10, 2), nullable=True),
            sa.Column("created_at",        sa.DateTime, nullable=False,
                      server_default=sa.text("NOW()")),
            sa.Column("updated_at",        sa.DateTime, nullable=True),
            sa.Column("deleted_at",        sa.DateTime, nullable=True),
            sa.CheckConstraint(
                "category IN ('bebida','charuto','cigarro','cigarro_palha','pemba','vela','outros')",
                name="ck_inventory_item_category",
            ),
            sa.CheckConstraint(
                "minimum_threshold >= 0",
                name="ck_inventory_item_threshold_positive",
            ),
        )
        op.create_index("ix_inventory_item_terreiro",       "inventory_items", ["terreiro_id"])
        op.create_index("ix_inventory_item_owner",          "inventory_items", ["owner_id"])
        op.create_index("ix_inventory_item_terreiro_ativo", "inventory_items", ["terreiro_id", "deleted_at"])

    # ═══════════════════════════════════════════════════════════════════════════
    # 4. inventory_movements (LEDGER — append-only)
    #    Nunca fazer UPDATE ou DELETE nesta tabela.
    #    Saldo = SUM(IN + ADJUSTMENT) - SUM(OUT)
    # ═══════════════════════════════════════════════════════════════════════════
    if not _tabela_existe("inventory_movements"):
        op.create_table(
            "inventory_movements",
            sa.Column("id",                 postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("inventory_item_id",  postgresql.UUID(as_uuid=True),
                      # SEM CASCADE: movimentações são históricas e permanentes
                      sa.ForeignKey("inventory_items.id"), nullable=False),
            sa.Column("type",               sa.String(20), nullable=False),
            sa.Column("quantity",           sa.Integer,    nullable=False),
            sa.Column("gira_id",            postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("giras.id"), nullable=True),
            sa.Column("created_by",         postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("usuarios.id"), nullable=False),
            sa.Column("notes",              sa.String(500), nullable=True),
            sa.Column("created_at",         sa.DateTime, nullable=False,
                      server_default=sa.text("NOW()")),
            # Garante que quantidade é sempre positiva — sinal implícito no type
            sa.CheckConstraint("quantity > 0", name="ck_movement_quantity_positive"),
            sa.CheckConstraint(
                "type IN ('IN', 'OUT', 'ADJUSTMENT')",
                name="ck_movement_type",
            ),
        )
        # Índice crítico: cálculo de saldo usa este índice (SUM por item)
        op.create_index("ix_movement_item_created",  "inventory_movements", ["inventory_item_id", "created_at"])
        op.create_index("ix_movement_gira",          "inventory_movements", ["gira_id"])
        op.create_index("ix_movement_created_by",    "inventory_movements", ["created_by"])

    # ═══════════════════════════════════════════════════════════════════════════
    # 5. gira_item_consumptions
    #    Pré-movimentação: registra intenção de consumo antes da finalização.
    #    UNIQUE(gira_id, medium_id, inventory_item_id) previne duplicata.
    # ═══════════════════════════════════════════════════════════════════════════
    if not _tabela_existe("gira_item_consumptions"):
        op.create_table(
            "gira_item_consumptions",
            sa.Column("id",                 postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("terreiro_id",        postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("terreiros.id"), nullable=False),
            sa.Column("gira_id",            postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("giras.id"), nullable=False),
            sa.Column("medium_id",          postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("usuarios.id"), nullable=False),
            sa.Column("inventory_item_id",  postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("inventory_items.id"), nullable=False),
            sa.Column("source",             sa.String(20), nullable=False),
            sa.Column("quantity",           sa.Integer,    nullable=False),
            sa.Column("status",             sa.String(20), nullable=False,
                      server_default="PENDENTE"),
            # FK para movimentação gerada no fechamento (null até lá)
            sa.Column("movement_id",        postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("inventory_movements.id"), nullable=True),
            sa.Column("created_at",         sa.DateTime, nullable=False,
                      server_default=sa.text("NOW()")),
            sa.Column("updated_at",         sa.DateTime, nullable=True),
            # Constraints de domínio
            sa.CheckConstraint("quantity > 0", name="ck_consumption_quantity_positive"),
            sa.CheckConstraint(
                "source IN ('MEDIUM', 'TERREIRO')",
                name="ck_consumption_source",
            ),
            sa.CheckConstraint(
                "status IN ('PENDENTE', 'PROCESSADO', 'CANCELADO')",
                name="ck_consumption_status",
            ),
            # Previne consumo duplicado do mesmo médium+item na mesma gira
            sa.UniqueConstraint(
                "gira_id", "medium_id", "inventory_item_id",
                name="uq_consumption_gira_medium_item",
            ),
        )
        op.create_index("ix_consumption_gira",            "gira_item_consumptions", ["gira_id"])
        op.create_index("ix_consumption_medium",          "gira_item_consumptions", ["medium_id"])
        op.create_index("ix_consumption_terreiro_status", "gira_item_consumptions", ["terreiro_id", "status"])

    # ═══════════════════════════════════════════════════════════════════════════
    # 6. inventory_alerts
    #    Um alerta aberto por item ao mesmo tempo.
    #    Partial index em resolved_at IS NULL para lookup eficiente.
    # ═══════════════════════════════════════════════════════════════════════════
    if not _tabela_existe("inventory_alerts"):
        op.create_table(
            "inventory_alerts",
            sa.Column("id",                 postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("inventory_item_id",  postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("inventory_items.id"), nullable=False),
            sa.Column("triggered_at",       sa.DateTime, nullable=False,
                      server_default=sa.text("NOW()")),
            sa.Column("resolved_at",        sa.DateTime, nullable=True),
            sa.Column("last_notified_at",   sa.DateTime, nullable=True),
        )
        op.create_index("ix_alert_item_resolved", "inventory_alerts", ["inventory_item_id", "resolved_at"])

        # Partial index: apenas alertas abertos (resolved_at IS NULL)
        # Usado na verificação rápida de "tem alerta ativo para este item?"
        op.execute(
            "CREATE INDEX ix_alert_item_aberto "
            "ON inventory_alerts (inventory_item_id) "
            "WHERE resolved_at IS NULL"
        )

    # ═══════════════════════════════════════════════════════════════════════════
    # 7. gira_notifications
    #    UNIQUE(gira_id, user_id, type) previne notificação duplicada.
    # ═══════════════════════════════════════════════════════════════════════════
    if not _tabela_existe("gira_notifications"):
        op.create_table(
            "gira_notifications",
            sa.Column("id",         postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("gira_id",    postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("giras.id"), nullable=False),
            sa.Column("user_id",    postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("usuarios.id"), nullable=False),
            sa.Column("type",       sa.String(50), nullable=False),
            sa.Column("created_at", sa.DateTime, nullable=False,
                      server_default=sa.text("NOW()")),
            sa.Column("read_at",    sa.DateTime, nullable=True),
            sa.CheckConstraint(
                "type IN ('MISSING_CONSUMPTION')",
                name="ck_notification_type",
            ),
            sa.UniqueConstraint(
                "gira_id", "user_id", "type",
                name="uq_gira_notification_gira_user_type",
            ),
        )
        op.create_index("ix_notification_user_read", "gira_notifications", ["user_id", "read_at"])
        op.create_index("ix_notification_gira",      "gira_notifications", ["gira_id"])


def downgrade() -> None:
    """Remove na ordem inversa de dependência (respeita FKs)."""

    # Notificações (sem dependentes)
    if _tabela_existe("gira_notifications"):
        op.drop_table("gira_notifications")

    # Alertas (sem dependentes)
    if _tabela_existe("inventory_alerts"):
        op.execute("DROP INDEX IF EXISTS ix_alert_item_aberto")
        op.drop_table("inventory_alerts")

    # Consumos (referencia movements e items)
    if _tabela_existe("gira_item_consumptions"):
        op.drop_table("gira_item_consumptions")

    # Movimentações (referencia items)
    if _tabela_existe("inventory_movements"):
        op.drop_table("inventory_movements")

    # Itens (referencia owners)
    if _tabela_existe("inventory_items"):
        op.drop_table("inventory_items")

    # Owners (independente)
    if _tabela_existe("inventory_owners"):
        op.drop_table("inventory_owners")

    # Coluna na tabela giras
    if _coluna_existe("giras", "estoque_processado"):
        op.drop_column("giras", "estoque_processado")