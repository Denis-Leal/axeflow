"""
inventory_movement.py — AxeFlow
Ledger de movimentações: a fonte de verdade do estoque.

Por que ledger (append-only)?
  - Auditabilidade: toda entrada/saída é rastreável com responsável e contexto
  - Sem divergência: saldo = SUM(IN) - SUM(OUT), sem campo desatualizado
  - Concorrência segura: INSERT é atômico, UPDATE de saldo não é
  - Permite reconstituição histórica (estoque em qualquer data passada)

ADJUSTMENT:
  Usado para correções manuais (contagem física diferente do calculado).
  Quantidade sempre positiva. O sinal é determinado pelo tipo:
    IN       → +quantity (entrada: compra, doação, devolução)
    OUT      → -quantity (saída: consumo na gira, descarte)
    ADJUSTMENT → +/-quantity via signed_quantity (ver service)

  Para simplificar: ADJUSTMENT com quantity positivo = entrada,
  ADJUSTMENT com quantity zero = reset (incomum, evitar).
  A convenção de sinal é documentada e validada no service.

gira_id nullable:
  Movimentações manuais (compras, ajustes) não têm gira associada.
  Movimentações geradas pelo fechamento da gira têm gira_id preenchido.
"""
import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, ForeignKey, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy import Enum as SAEnum, String
from app.core.database import Base


class MovementTypeEnum(str, enum.Enum):
    IN         = "IN"          # entrada (compra, doação)
    OUT        = "OUT"         # saída (consumo, descarte)
    ADJUSTMENT = "ADJUSTMENT"  # correção manual de inventário


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Item que foi movimentado
    inventory_item_id   = Column(
        UUID(as_uuid=True),
        ForeignKey("inventory_items.id"),
        nullable=False,
    )

    # Tipo de movimentação
    type                = Column(SAEnum(MovementTypeEnum), nullable=False)

    # Quantidade: SEMPRE positiva (sinal implícito no type)
    # CHECK constraint no banco para garantir invariante
    quantity            = Column(Integer, nullable=False)

    # Contexto: gira que gerou o consumo (null = movimentação manual)
    gira_id             = Column(
        UUID(as_uuid=True),
        ForeignKey("giras.id"),
        nullable=True,
    )

    # Quem registrou a movimentação (auditoria)
    created_by          = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=False,
    )

    # Nota opcional para ajustes manuais (ex: "contagem física: 5 unidades")
    notes               = Column(String(500), nullable=True)

    created_at          = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relacionamentos
    item        = relationship("InventoryItem", back_populates="movements")
    gira        = relationship("Gira")
    criador     = relationship("Usuario", foreign_keys=[created_by])

    __table_args__ = (
        # Garante que quantidade nunca é zero ou negativa — sinal está no type
        CheckConstraint("quantity > 0", name="ck_movement_quantity_positive"),

        # Índice primário: histórico de movimentações de um item (cálculo de saldo)
        Index("ix_movement_item_created", "inventory_item_id", "created_at"),

        # Índice para listar movimentações de uma gira específica
        Index("ix_movement_gira", "gira_id"),

        # Índice para auditoria por usuário
        Index("ix_movement_created_by", "created_by"),
    )