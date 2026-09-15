from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class FormaPagamentoCreate(BaseModel):
    nome: str = Field(
        ...,
        min_length=1,
        max_length=100,
    )
    ativo: bool = True


class FormaPagamentoUpdate(BaseModel):
    nome: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    ativo: Optional[bool] = None


class FormaPagamentoResponse(BaseModel):
    id: UUID
    terreiro_id: UUID
    nome: str
    ativo: bool
    created_at: datetime
    updated_at: Optional[datetime]
    created_by: Optional[UUID]

    class Config:
        from_attributes = True


class ContaReceberCreate(BaseModel):
    agendamento_id: UUID
    data_vencimento: Optional[datetime] = None


class ContaReceberResponse(BaseModel):
    id: UUID
    terreiro_id: UUID
    agendamento_id: UUID
    consulente_id: UUID
    descricao: str
    valor: Decimal
    status: str
    data_vencimento: Optional[datetime]
    data_pagamento: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    created_by: Optional[UUID]

    class Config:
        from_attributes = True


class PagamentoCreate(BaseModel):
    forma_pagamento_id: UUID

    valor: Decimal = Field(
        ...,
        gt=0,
        max_digits=12,
        decimal_places=2,
    )

    data_pagamento: Optional[datetime] = None

    observacoes: Optional[str] = Field(
        default=None,
        max_length=2000,
    )


class PagamentoResponse(BaseModel):
    id: UUID
    terreiro_id: UUID
    conta_receber_id: UUID
    forma_pagamento_id: UUID
    valor: Decimal
    data_pagamento: datetime
    observacoes: Optional[str]
    created_at: datetime
    created_by: Optional[UUID]

    recibo_id: Optional[UUID] = None
    recibo_numero: Optional[str] = None

    class Config:
        from_attributes = True


class ReciboResponse(BaseModel):
    id: UUID
    terreiro_id: UUID
    pagamento_id: UUID
    numero: str
    emitido_em: datetime
    created_at: datetime
    created_by: Optional[UUID]

    class Config:
        from_attributes = True