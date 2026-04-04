"""
inventory_schema.py — AxeFlow
Schemas Pydantic para o sistema de inventário.

Separação clara:
  - *Create / *Update: validação de entrada (o que o cliente envia)
  - *Response: serialização de saída (o que o cliente recebe)

Saldo não é um campo armazenado — é calculado e injetado na resposta
pelo service. Por isso InventoryItemResponse tem `current_stock` opcional.
"""
from __future__ import annotations
from typing import Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator


# ══════════════════════════════════════════════════════════════════════════════
# INVENTORY OWNER
# ══════════════════════════════════════════════════════════════════════════════

class InventoryOwnerCreate(BaseModel):
    """Criação de owner — geralmente feita automaticamente pelo service."""
    type:         str           = Field(..., pattern="^(MEDIUM|TERREIRO)$")
    reference_id: Optional[UUID] = None

    @model_validator(mode="after")
    def validar_reference(self) -> InventoryOwnerCreate:
        if self.type == "MEDIUM" and self.reference_id is None:
            raise ValueError("MEDIUM requer reference_id (id do usuário)")
        return self


class InventoryOwnerResponse(BaseModel):
    id:           UUID
    type:         str
    reference_id: Optional[UUID]

    class Config:
        from_attributes = True


# ══════════════════════════════════════════════════════════════════════════════
# INVENTORY ITEM
# ══════════════════════════════════════════════════════════════════════════════

class InventoryItemCreate(BaseModel):
    name:               str      = Field(..., min_length=1, max_length=255)
    category:           str      = Field(..., description="bebida|charuto|cigarro|cigarro_palha|pemba|vela|outros")
    minimum_threshold:  int      = Field(default=0, ge=0)
    unit_cost:          Optional[Decimal] = Field(default=None, ge=0)

    # Para itens do TERREIRO: não precisa de owner_id (service deriva)
    # Para itens de MÉDIUM: service usa o usuário autenticado como owner
    # Não expor owner_id diretamente na API — controlado pelo service + RBAC


class InventoryItemUpdate(BaseModel):
    """Todos os campos opcionais — PATCH parcial."""
    name:               Optional[str]     = Field(default=None, min_length=1, max_length=255)
    category:           Optional[str]     = None
    minimum_threshold:  Optional[int]     = Field(default=None, ge=0)
    unit_cost:          Optional[Decimal] = Field(default=None, ge=0)

    @model_validator(mode="after")
    def ao_menos_um_campo(self) -> InventoryItemUpdate:
        if all(v is None for v in [self.name, self.category, self.minimum_threshold, self.unit_cost]):
            raise ValueError("Informe ao menos um campo para atualizar.")
        return self


class InventoryItemResponse(BaseModel):
    id:                 UUID
    terreiro_id:        UUID
    owner_id:           UUID
    name:               str
    category:           str
    minimum_threshold:  int
    unit_cost:          Optional[Decimal]
    created_at:         datetime

    # Calculado pelo service — não armazenado no banco
    current_stock:      Optional[int]   = None

    # Flag de alerta calculada pelo service
    low_stock:          Optional[bool]  = None

    class Config:
        from_attributes = True


# ══════════════════════════════════════════════════════════════════════════════
# INVENTORY MOVEMENT
# ══════════════════════════════════════════════════════════════════════════════

class InventoryMovementCreate(BaseModel):
    """Movimentação manual (admin): entrada, saída ou ajuste."""
    type:     str = Field(..., pattern="^(IN|OUT|ADJUSTMENT)$")
    quantity: int = Field(..., ge=1)
    notes:    Optional[str] = Field(default=None, max_length=500)


class InventoryMovementResponse(BaseModel):
    id:                 UUID
    inventory_item_id:  UUID
    type:               str
    quantity:           int
    gira_id:            Optional[UUID]
    created_by:         UUID
    notes:              Optional[str]
    created_at:         datetime

    class Config:
        from_attributes = True


# ══════════════════════════════════════════════════════════════════════════════
# GIRA ITEM CONSUMPTION
# ══════════════════════════════════════════════════════════════════════════════

class GiraConsumptionCreate(BaseModel):
    """Registro de consumo por médium em uma gira."""
    inventory_item_id: UUID
    source:            str  = Field(..., pattern="^(MEDIUM|TERREIRO)$")
    quantity:          int  = Field(..., ge=1)


class GiraConsumptionUpdate(BaseModel):
    """Edição de consumo antes da finalização."""
    quantity: int = Field(..., ge=1)


class GiraConsumptionResponse(BaseModel):
    id:                 UUID
    gira_id:            UUID
    medium_id:          UUID
    inventory_item_id:  UUID
    source:             str
    quantity:           int
    status:             str
    created_at:         datetime

    # Enriquecidos pelo service para exibição
    item_name:          Optional[str] = None
    medium_nome:        Optional[str] = None

    class Config:
        from_attributes = True


# ══════════════════════════════════════════════════════════════════════════════
# FINALIZAÇÃO DA GIRA
# ══════════════════════════════════════════════════════════════════════════════

class GiraFinalizarResponse(BaseModel):
    """Resposta do endpoint de finalização."""
    ok:                     bool
    gira_id:                UUID
    consumos_processados:   int
    movimentacoes_geradas:  int
    mediums_sem_consumo:    list[str]   # nomes dos médiuns que não registraram
    notificacoes_criadas:   int


# ══════════════════════════════════════════════════════════════════════════════
# ESTOQUE
# ══════════════════════════════════════════════════════════════════════════════

class StockResponse(BaseModel):
    """Saldo calculado em tempo real para um item."""
    inventory_item_id:  UUID
    item_name:          str
    current_stock:      int
    minimum_threshold:  int
    low_stock:          bool
    unit_cost:          Optional[Decimal]

    # Custo total do estoque atual (futuro: unit_cost * current_stock)
    stock_value:        Optional[Decimal] = None