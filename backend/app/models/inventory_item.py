"""
inventory_item.py — AxeFlow
Item de estoque: pertence a um InventoryOwner (médium ou terreiro).

Decisão crítica — saldo NÃO é armazenado aqui:
  O saldo é sempre calculado a partir de InventoryMovement (ledger pattern).
  Isso garante auditabilidade total e elimina o risco de divergência entre
  saldo armazenado e movimentações registradas.

  Custo de consulta: O(n) sobre movimentações por item. Para escala,
  adicionar uma view materializada ou snapshot diário (futuro).

terreiro_id denormalizado:
  Seguindo o padrão do projeto — permite filtrar todos os itens de um
  terreiro sem JOIN em inventory_owners. Crítico para isolamento multi-tenant.
"""
import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Integer, Numeric, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy import Enum as SAEnum
from app.core.database import Base


class ItemCategoryEnum(str, enum.Enum):
    bebida          = "bebida"
    charuto         = "charuto"
    cigarro         = "cigarro"
    cigarro_palha   = "cigarro_palha"
    pemba           = "pemba"
    vela            = "vela"
    outros          = "outros"


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Isolamento multi-tenant (denormalizado para queries diretas sem JOIN)
    terreiro_id         = Column(UUID(as_uuid=True), ForeignKey("terreiros.id"), nullable=False)

    # Proprietário: médium ou terreiro
    owner_id            = Column(UUID(as_uuid=True), ForeignKey("inventory_owners.id"), nullable=False)

    name                = Column(String(255), nullable=False)
    category            = Column(SAEnum(ItemCategoryEnum), nullable=False)

    # Threshold para alerta de estoque baixo (0 = sem alerta)
    minimum_threshold   = Column(Integer, nullable=False, default=0)

    # Custo unitário: preparado para futuro cálculo de custo por gira
    # NUMERIC(10, 2) → até R$ 99.999.999,99 com 2 casas decimais
    unit_cost           = Column(Numeric(10, 2), nullable=True)

    created_at          = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # deleted_at: soft delete mantém histórico de movimentações
    deleted_at          = Column(DateTime, nullable=True)

    # Relacionamentos
    owner               = relationship("InventoryOwner", back_populates="items")
    movements           = relationship("InventoryMovement", back_populates="item")
    consumptions        = relationship("GiraItemConsumption", back_populates="item")
    alerts              = relationship("InventoryAlert", back_populates="item")

    __table_args__ = (
        # Busca de itens por terreiro (query mais frequente)
        Index("ix_inventory_item_terreiro", "terreiro_id"),
        # Busca de itens por owner (médium gerenciando seu estoque)
        Index("ix_inventory_item_owner", "owner_id"),
        # Itens ativos por terreiro (filtro padrão em listagens)
        Index("ix_inventory_item_terreiro_ativo", "terreiro_id", "deleted_at"),
    )

    @property
    def ativo(self) -> bool:
        """Conveniência: True se não foi soft-deletado."""
        return self.deleted_at is None