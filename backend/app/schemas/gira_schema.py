from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime, date, time

class GiraCreate(BaseModel):
    titulo: str
    tipo: Optional[str] = None
    data: date
    horario: time
    limite_consulentes: int
    abertura_lista: datetime
    fechamento_lista: datetime
    responsavel_lista_id: Optional[UUID] = None

class GiraUpdate(BaseModel):
    titulo: Optional[str] = None
    tipo: Optional[str] = None
    data: Optional[date] = None
    horario: Optional[time] = None
    limite_consulentes: Optional[int] = None
    abertura_lista: Optional[datetime] = None
    fechamento_lista: Optional[datetime] = None
    status: Optional[str] = None
    responsavel_lista_id: Optional[UUID] = None

class GiraResponse(BaseModel):
    id: UUID
    titulo: str
    tipo: Optional[str]
    data: date
    horario: time
    limite_consulentes: int
    abertura_lista: datetime
    fechamento_lista: datetime
    status: str
    slug_publico: str
    terreiro_id: UUID
    responsavel_lista_id: Optional[UUID] = None
    responsavel_lista_nome: Optional[str] = None
    total_inscritos: Optional[int] = 0
    created_at: datetime

    class Config:
        from_attributes = True
