"""
inventory_owner.py — AxeFlow
Proprietário de estoque: pode ser um médium (usuário) ou o terreiro.

Decisão de modelagem:
  - Tabela separada em vez de union-type direto nos itens porque:
    a) permite adicionar futuramente outros tipos de owner sem alterar InventoryItem
    b) centraliza a lógica de quem pode ver/modificar o quê
    c) facilita JOIN em relatórios de custo (quem gastou quanto)

  - reference_id é nullable para o caso TERREIRO (o terreiro é identificado
    pelo terreiro_id nos itens, não por referência aqui)

  - UNIQUE(type, reference_id) previne dois owners do tipo MEDIUM para o
    mesmo usuário no mesmo terreiro (gerenciado pela camada de serviço)
"""
import uuid
import enum
from sqlalchemy import Column, String, Enum, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class OwnerTypeEnum(str, enum.Enum):
    MEDIUM    = "MEDIUM"    # médium específico (reference_id = usuario.id)
    TERREIRO  = "TERREIRO"  # estoque coletivo do terreiro


class InventoryOwner(Base):
    __tablename__ = "inventory_owners"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Tipo do dono: MEDIUM ou TERREIRO
    type         = Column(Enum(OwnerTypeEnum), nullable=False)

    # Para MEDIUM: id do Usuario; para TERREIRO: id do Terreiro
    reference_id = Column(UUID(as_uuid=True), nullable=True)

    # Relacionamentos reversos (usados em queries analíticas)
    items = relationship("InventoryItem", back_populates="owner")

    __table_args__ = (
        # Previne owner duplicado para o mesmo médium/terreiro
        UniqueConstraint("type", "reference_id", name="uq_inventory_owner_type_ref"),
        Index("ix_inventory_owner_reference", "reference_id"),
    )