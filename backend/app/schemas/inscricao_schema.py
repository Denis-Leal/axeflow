"""
inscricao_schema.py — AxeFlow
Schemas Pydantic para inscrições em giras.

ALTERAÇÃO:
  - InscricaoPublicaRequest: campo `primeira_visita` opcional (bool)
    Permite que o consulente informe no formulário público se é a primeira vez.
    A validação final é feita no serviço com duas camadas:
      1. Checkbox do usuário (declarativo)
      2. Busca pelo telefone no banco (autoritativo)
"""
from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class InscricaoPublicaRequest(BaseModel):
    nome: str
    telefone: str
    # Campo declarativo: o próprio consulente informa se é a primeira vez.
    # Usado como fallback quando o telefone ainda não existe no banco.
    primeira_visita: Optional[bool] = Field(
        default=None,
        description="O consulente marcou que é a primeira vez no terreiro",
    )
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
    usuario_id: Optional[UUID] = None
    source: str

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