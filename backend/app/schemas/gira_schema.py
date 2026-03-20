"""
gira_schema.py — AxeFlow
Schemas Pydantic para criação, atualização e resposta de giras.

ALTERAÇÃO:
  - GiraUpdateResponse: novo schema para o PUT /giras/{id}.
      Estende GiraResponse adicionando `promovidos_fila`, que contém
      a lista de consulentes promovidos da lista de espera quando o
      limite de vagas aumenta. O frontend usa essa lista para abrir
      os WhatsApps em sequência.
"""
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
    limite_membros: Optional[int] = None
    abertura_lista: Optional[datetime] = None
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


class PromovdoFila(BaseModel):
    """Dados de um consulente promovido da lista de espera."""
    nome:     str
    telefone: str
    posicao:  int


class GiraUpdateResponse(GiraResponse):
    """
    Resposta do PUT /giras/{id}.

    Estende GiraResponse com `promovidos_fila`: lista de consulentes
    que foram promovidos automaticamente da lista de espera porque o
    limite de vagas aumentou. Lista vazia quando não houve promoções.

    O frontend (editar/[id].js) usa essa lista para abrir os WhatsApps
    em sequência notificando cada promovido.
    """
    promovidos_fila: list[PromovdoFila] = []