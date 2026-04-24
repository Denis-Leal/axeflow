from pydantic import BaseModel
from typing import Optional

class ConsulentePutSchema(BaseModel):
    nome: Optional[str] = None
    telefone: Optional[str] = None
    notas: Optional[str] = None
    source: Optional[str] = None