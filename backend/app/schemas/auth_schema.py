from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime

class LoginRequest(BaseModel):
    email: EmailStr
    senha: str

class RegisterRequest(BaseModel):
    nome: str
    email: EmailStr
    senha: str
    telefone: Optional[str] = None
    terreiro_nome: str
    terreiro_cidade: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UsuarioResponse(BaseModel):
    id: UUID
    nome: str
    email: str
    role: str
    terreiro_id: UUID
    terreiro_nome: Optional[str] = None

    class Config:
        from_attributes = True
