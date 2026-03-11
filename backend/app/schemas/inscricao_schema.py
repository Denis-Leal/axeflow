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

    consulente_nome: Optional[str]

    consulente_telefone: Optional[str]

    observacoes: Optional[str]

    class Config:
        from_attributes = True


class PresencaUpdate(BaseModel):

    status: str


class ObservacaoUpdate(BaseModel):

    observacoes: str