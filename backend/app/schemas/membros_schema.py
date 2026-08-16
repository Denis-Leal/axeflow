from typing import Optional
from pydantic import BaseModel, EmailStr


class MembroCreate(BaseModel):
    nome: str
    email: EmailStr
    senha: str
    telefone: Optional[str] = None
    role: str = "membro"