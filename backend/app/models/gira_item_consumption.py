"""
gira_item_consumption.py — AxeFlow
Consumo de item por médium em uma gira.

Ciclo de vida:
  1. Médium registra consumo durante/após a gira (status: PENDENTE)
  2. Admin finaliza a gira
  3. Service converte consumos em InventoryMovement (OUT)
  4. Consumo marcado como PROCESSADO

Por que separar consumo de movimentação?
  - Permite editar/cancelar consumo ANTES da finalização
  - Movimentação é imutável (ledger append-only)
  - Consumo pode ser rejeitado/validado antes de afetar o estoque
  - Histórico de quem consumiu o quê por gira, independente do estoque

source (MEDIUM vs TERREIRO):
  Define de qual estoque será debitado no fechamento.
  Validado no service: item deve pertencer ao owner correspondente.
  Ex: source=MEDIUM → inventory_item deve ter owner do tipo MEDIUM
      com reference_id = medium_id

UNIQUE(gira_id, medium_id, inventory_item_id):
  Um médium só pode registrar um consumo por item por gira.
  Para aumentar, ele edita a quantidade — não insere de novo.
"""
import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, ForeignKey, CheckConstraint, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy import Enum as SAEnum
from app.core.database import Base


class ConsumptionSourceEnum(str, enum.Enum):
    MEDIUM   = "MEDIUM"   # débito do estoque do médium
    TERREIRO = "TERREIRO" # débito do estoque do terreiro


class ConsumptionStatusEnum(str, enum.Enum):
    PENDENTE    = "PENDENTE"    # aguardando finalização da gira
    PROCESSADO  = "PROCESSADO"  # convertido em InventoryMovement
    CANCELADO   = "CANCELADO"   # cancelado antes da finalização


class GiraItemConsumption(Base):
    __tablename__ = "gira_item_consumptions"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Isolamento multi-tenant
    terreiro_id         = Column(UUID(as_uuid=True), ForeignKey("terreiros.id"), nullable=False)

    # Gira em que o consumo ocorreu
    gira_id             = Column(UUID(as_uuid=True), ForeignKey("giras.id"), nullable=False)

    # Médium que consumiu o item
    medium_id           = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)

    # Item consumido
    inventory_item_id   = Column(
        UUID(as_uuid=True),
        ForeignKey("inventory_items.id"),
        nullable=False,
    )

    # De qual estoque será debitado no fechamento
    source              = Column(SAEnum(ConsumptionSourceEnum), nullable=False)

    # Quantidade consumida (sempre positiva)
    quantity            = Column(Integer, nullable=False)

    # Estado do consumo no fluxo
    status              = Column(
        SAEnum(ConsumptionStatusEnum),
        nullable=False,
        default=ConsumptionStatusEnum.PENDENTE,
    )

    # Referência à movimentação gerada no fechamento (rastreabilidade bidirecional)
    movement_id         = Column(
        UUID(as_uuid=True),
        ForeignKey("inventory_movements.id"),
        nullable=True,  # null até ser processado
    )

    created_at          = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relacionamentos
    gira        = relationship("Gira")
    medium      = relationship("Usuario", foreign_keys=[medium_id])
    item        = relationship("InventoryItem", back_populates="consumptions")
    movement    = relationship("InventoryMovement", foreign_keys=[movement_id])

    __table_args__ = (
        # Um médium não pode duplicar consumo do mesmo item na mesma gira
        # (ele edita a quantidade existente)
        UniqueConstraint(
            "gira_id", "medium_id", "inventory_item_id",
            name="uq_consumption_gira_medium_item",
        ),

        # Quantidade sempre positiva
        CheckConstraint("quantity > 0", name="ck_consumption_quantity_positive"),

        # Queries por gira (listagem de consumos para finalização)
        Index("ix_consumption_gira", "gira_id"),

        # Queries por médium (histórico de consumo)
        Index("ix_consumption_medium", "medium_id"),

        # Filtragem de pendentes por terreiro (job de finalização)
        Index("ix_consumption_terreiro_status", "terreiro_id", "status"),
    )