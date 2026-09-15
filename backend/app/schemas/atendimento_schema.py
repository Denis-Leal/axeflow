from datetime import date, datetime, time
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class AtendimentoTipoCreate(BaseModel):
    nome: str = Field(..., min_length=1, max_length=255)
    descricao: Optional[str] = Field(default=None, max_length=2000)
    valor: Decimal = Field(..., gt=0, max_digits=12, decimal_places=2)
    tipo_cobranca: str = Field(..., pattern="^(servico|hora)$")
    ativo: bool = True


class AtendimentoTipoUpdate(BaseModel):
    nome: Optional[str] = Field(default=None, min_length=1, max_length=255)
    descricao: Optional[str] = Field(default=None, max_length=2000)
    valor: Optional[Decimal] = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    tipo_cobranca: Optional[str] = Field(default=None, pattern="^(servico|hora)$")
    ativo: Optional[bool] = None

    @model_validator(mode="after")
    def ao_menos_um_campo(self) -> "AtendimentoTipoUpdate":
        if not self.model_fields_set:
            raise ValueError("Informe ao menos um campo para atualizar.")
        return self


class AtendimentoTipoResponse(BaseModel):
    id: UUID
    terreiro_id: UUID
    nome: str
    descricao: Optional[str]
    valor: Decimal
    tipo_cobranca: str
    ativo: bool
    created_at: datetime
    updated_at: Optional[datetime]
    created_by: Optional[UUID]
    total_agendamentos: int = 0

    class Config:
        from_attributes = True


class AgendamentoCreate(BaseModel):
    consulente_id: UUID
    atendimento_tipo_id: UUID
    data: date
    hora_inicio: time
    hora_fim: Optional[time] = None
    observacoes: Optional[str] = Field(default=None, max_length=2000)


class AgendamentoUpdate(BaseModel):
    consulente_id: Optional[UUID] = None
    atendimento_tipo_id: Optional[UUID] = None
    data: Optional[date] = None
    hora_inicio: Optional[time] = None
    hora_fim: Optional[time] = None
    observacoes: Optional[str] = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def ao_menos_um_campo(self) -> "AgendamentoUpdate":
        if not self.model_fields_set:
            raise ValueError("Informe ao menos um campo para atualizar.")
        return self


class AgendamentoStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(agendado|concluido|cancelado)$")


class ConsulenteResumo(BaseModel):
    id: UUID
    nome: str
    telefone: Optional[str] = None

    class Config:
        from_attributes = True


class AtendimentoTipoResumo(BaseModel):
    id: UUID
    nome: str
    valor: Decimal
    tipo_cobranca: str
    ativo: bool

    class Config:
        from_attributes = True


class AgendamentoResponse(BaseModel):
    id: UUID
    terreiro_id: UUID
    consulente_id: UUID
    atendimento_tipo_id: UUID
    inicio: datetime
    fim: datetime
    valor: Decimal
    status: str
    observacoes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    created_by: Optional[UUID]
    consulente: Optional[ConsulenteResumo] = None
    atendimento_tipo: Optional[AtendimentoTipoResumo] = None
    duracao_horas: Optional[Decimal] = None

    class Config:
        from_attributes = True
