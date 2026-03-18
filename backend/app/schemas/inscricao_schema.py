"""
inscricao_schema.py — AxeFlow
Schemas Pydantic para inscrições em giras.
"""
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class InscricaoPublicaRequest(BaseModel):
    nome: str
    telefone: str


class InscricaoResponse(BaseModel):
    id: UUID
    posicao: int
    status: str
    created_at: datetime
    consulente_nome: Optional[str] = None
    consulente_telefone: Optional[str] = None
    # Exposto para o frontend identificar inscrições de membros em giras públicas
    membro_id: Optional[UUID] = None

    class Config:
        from_attributes = True


class PresencaUpdate(BaseModel):
    status: str  # compareceu | faltou
