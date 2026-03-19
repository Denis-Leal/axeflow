"""
inscricao_schema.py — AxeFlow
Schemas Pydantic para inscrições em giras.

ADIÇÃO:
  - InscricaoPublicaRequest: campo `observacoes` opcional
    (ex: "veio com acompanhante", "urgente", "pedido específico")
  - InscricaoResponse: expõe `observacoes` para o painel admin
"""
from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class InscricaoPublicaRequest(BaseModel):
    nome: str
    telefone: str
    # Campo livre preenchido pelo próprio consulente no link público (opcional)
    observacoes: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Informações adicionais do consulente (ex: veio com acompanhante)",
    )


class InscricaoResponse(BaseModel):
    id: UUID
    posicao: int
    status: str
    created_at: datetime
    consulente_nome: Optional[str] = None
    consulente_telefone: Optional[str] = None
    # Exposto para o painel admin visualizar anotações do consulente
    observacoes: Optional[str] = None

    class Config:
        from_attributes = True


class PresencaUpdate(BaseModel):
    status: str  # compareceu | faltou


class ConsulentePatchRequest(BaseModel):
    """Payload para o admin atualizar as notas do consulente."""
    notas: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Observações internas do terreiro sobre o consulente",
    )