"""
ajeum_schema.py — AxeFlow
Schemas Pydantic para validação de entrada e serialização de saída do Ajeum.

Separação clara entre:
  - schemas de entrada (Create/Edit/Request): validam o que o cliente envia
  - schemas de saída (Response): definem o que o cliente recebe

Validações de negócio que dependem do banco (ex: limite < seleções ativas)
são feitas no serviço, não aqui. Aqui ficam apenas validações de formato e domínio.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.utils.enuns import UnidadeMedidaEnum
from pydantic import BaseModel, Field, model_validator


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS DE ENTRADA
# ══════════════════════════════════════════════════════════════════════════════

class AjeumItemCreate(BaseModel):
    """Um item na criação do Ajeum."""
    descricao: str = Field(..., min_length=1, max_length=255)
    quantidade_necessaria: Decimal = Field(..., ge=1, le=999, description="Mínimo 1, máximo 999")
    unidade: UnidadeMedidaEnum = Field(..., description="Unidade de medida do item.")


class AjeumCreate(BaseModel):
    """Payload para criar um Ajeum com seus itens."""
    observacoes: Optional[str]        = Field(default=None, max_length=1000)
    itens:       list[AjeumItemCreate] = Field(..., min_length=1, max_length=50)

class AjeumSelecaoCreate(BaseModel):
    """Payload para criar uma seleção de item do Ajeum."""
    quantidade: Decimal = Field(..., gt=0, description="Quantidade desejada do item. Deve ser maior que zero.")

class AjeumItemEdit(BaseModel):
    """Payload para editar um item existente. Todos os campos são opcionais."""
    descricao: Optional[str] = Field(default=None, min_length=1, max_length=255)
    quantidade_necessaria:    Optional[Decimal] = Field(default=None, ge=1, le=999)
    unidade: Optional[UnidadeMedidaEnum] = Field(default=None, description="Unidade de medida do item.")

    @model_validator(mode="after")
    def ao_menos_um_campo(self) -> AjeumItemEdit:
        if self.descricao is None and self.quantidade_necessaria is None and self.unidade is None:
            raise ValueError("Informe ao menos um campo para editar: descricao, quantidade_necessaria ou unidade.")
        return self


class ConfirmarSelecaoRequest(BaseModel):
    """
    Payload para o admin confirmar ou registrar não-entrega.

    A `version` é obrigatória e implementa o optimistic locking:
    o frontend envia a version que leu ao carregar a tela.
    Se outro admin já modificou (version diferente), retorna 409.
    """
    novo_status: str = Field(
        ...,
        pattern="^(confirmado|nao_entregue)$",
        description="Apenas 'confirmado' ou 'nao_entregue' são aceitos aqui.",
    )
    version: int = Field(
        ...,
        ge=1,
        description="Version lida ao carregar a tela. Necessária para optimistic locking.",
    )


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS DE SAÍDA
# ══════════════════════════════════════════════════════════════════════════════

class AjeumSelecaoResponse(BaseModel):
    id:             UUID
    item_id:        UUID
    membro_id:      UUID
    status:         str
    version:        int
    confirmado_por: Optional[UUID]
    confirmado_em:  Optional[datetime]
    created_at:     datetime
    updated_at:     Optional[datetime]

    class Config:
        from_attributes = True


class AjeumItemResponse(BaseModel):
    id:          UUID
    descricao:   str
    quantidade_necessaria: Decimal
    unidade:     UnidadeMedidaEnum
    created_at:  datetime

    class Config:
        from_attributes = True


class AjeumResponse(BaseModel):
    id:          UUID
    gira_id:     UUID
    observacoes: Optional[str]
    created_at:  datetime

    class Config:
        from_attributes = True