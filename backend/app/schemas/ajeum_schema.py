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

from typing import Optional
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field, model_validator


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS DE ENTRADA
# ══════════════════════════════════════════════════════════════════════════════

class AjeumItemCreate(BaseModel):
    """Um item na criação do Ajeum."""
    descricao: str = Field(..., min_length=1, max_length=255)
    limite:    int = Field(..., ge=1, le=999, description="Mínimo 1, máximo 999")


class AjeumCreate(BaseModel):
    """Payload para criar um Ajeum com seus itens."""
    observacoes: Optional[str]        = Field(default=None, max_length=1000)
    itens:       list[AjeumItemCreate] = Field(..., min_length=1, max_length=50)


class AjeumItemEdit(BaseModel):
    """Payload para editar um item existente. Todos os campos são opcionais."""
    descricao: Optional[str] = Field(default=None, min_length=1, max_length=255)
    limite:    Optional[int] = Field(default=None, ge=1, le=999)

    @model_validator(mode="after")
    def ao_menos_um_campo(self) -> AjeumItemEdit:
        if self.descricao is None and self.limite is None:
            raise ValueError("Informe ao menos um campo para editar: descricao ou limite.")
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
    limite:      int
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