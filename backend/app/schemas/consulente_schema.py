from pydantic import BaseModel, Field
from typing import Optional

class ConsulenteCreateSchema(BaseModel):
    nome: str = Field(..., min_length=1, max_length=255)
    telefone: Optional[str] = None
    notas: Optional[str] = None
    primeira_visita: Optional[bool] = True
    source: Optional[str] = "cadastro_manual"

class ConsulentePutSchema(BaseModel):
    nome: Optional[str] = None
    telefone: Optional[str] = None
    notas: Optional[str] = None
    source: Optional[str] = None

class NotasConsulenteUpdate(BaseModel):
    notas: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Observações internas do terreiro sobre o consulente",
    )
