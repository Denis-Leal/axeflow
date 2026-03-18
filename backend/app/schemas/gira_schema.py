from pydantic import BaseModel, model_validator
from typing import Optional
from uuid import UUID
from datetime import datetime, date, time

class GiraCreate(BaseModel):
    titulo: str
    tipo: Optional[str] = None
    acesso: str = "publica"           # publica | fechada
    data: date
    horario: time
    limite_consulentes: int
    limite_membros: Optional[int] = None  # apenas para giras fechadas
    abertura_lista: Optional[datetime] = None   # não obrigatório para giras fechadas
    fechamento_lista: Optional[datetime] = None
    responsavel_lista_id: Optional[UUID] = None

class GiraUpdate(BaseModel):
    titulo: Optional[str] = None
    tipo: Optional[str] = None
    acesso: Optional[str] = None
    data: Optional[date] = None
    horario: Optional[time] = None
    limite_consulentes: Optional[int] = None
    limite_membros: Optional[int] = None
    abertura_lista: Optional[datetime] = None
    fechamento_lista: Optional[datetime] = None
    status: Optional[str] = None
    responsavel_lista_id: Optional[UUID] = None
    
    @model_validator(mode="after")
    def validar_consistencia(self):
        # só valida se acesso está sendo alterado
        if self.acesso == "fechada":
            if self.limite_membros is None:
                raise ValueError("Gira fechada precisa de limite_membros")

        if self.acesso == "publica":
            if self.limite_consulentes is None:
                raise ValueError("Gira pública precisa de limite_consulentes")

        return self

class GiraResponse(BaseModel):
    id: UUID
    titulo: str
    tipo: Optional[str]
    acesso: str = "publica"
    data: date
    horario: time
    limite_consulentes: int
    limite_membros: Optional[int] = None
    abertura_lista: Optional[datetime] = None
    fechamento_lista: Optional[datetime] = None
    status: str
    slug_publico: Optional[str] = None
    terreiro_id: UUID
    responsavel_lista_id: Optional[UUID] = None
    responsavel_lista_nome: Optional[str] = None
    total_inscritos: Optional[int] = 0
    created_at: datetime

    class Config:
        from_attributes = True
