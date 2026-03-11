from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime, date, time


class GiraCreate(BaseModel):

    titulo: str
    tipo: Optional[str]
    acesso: str = "publica"
    data: date
    horario: time
    limite_consulentes: int
    abertura_lista: Optional[datetime]
    fechamento_lista: Optional[datetime]
    responsavel_lista_id: Optional[UUID]


class GiraUpdate(BaseModel):
    titulo: Optional[str]
    tipo: Optional[str]
    acesso: Optional[str]
    data: Optional[date]
    horario: Optional[time]
    limite_consulentes: Optional[int]
    abertura_lista: Optional[datetime]
    fechamento_lista: Optional[datetime]
    status: Optional[str]
    responsavel_lista_id: Optional[UUID]
    
class GiraResponse(BaseModel):

    id: UUID
    titulo: str
    tipo: Optional[str]
    acesso: str
    data: date
    horario: time
    limite_consulentes: int
    abertura_lista: Optional[datetime]
    fechamento_lista: Optional[datetime]
    status: str
    slug_publico: Optional[str]
    terreiro_id: UUID
    responsavel_lista_id: Optional[UUID]
    responsavel_lista_nome: Optional[str]
    total_inscritos: Optional[int]
    created_at: datetime
    class Config:
        from_attributes = True