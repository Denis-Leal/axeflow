from pydantic import BaseModel, Field
from typing import Optional

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