from typing import Optional
from pydantic import BaseModel, EmailStr


class MembroCreate(BaseModel):
    nome: str
    email: EmailStr
    senha: Optional[str] = None
    telefone: Optional[str] = None
    role: str = "membro"
