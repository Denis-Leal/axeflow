from pydantic import BaseModel, EmailStr, Field
from typing import Literal, Optional
from uuid import UUID
from datetime import datetime
from app.core.password_policy import NewPassword

class LoginRequest(BaseModel):
    email: EmailStr
    senha: str = Field(max_length=4096)
    terreiro_id: Optional[UUID] = None

class RegisterRequest(BaseModel):
    nome: str
    email: EmailStr
    senha: NewPassword
    telefone: Optional[str] = None
    terreiro_nome: str
    terreiro_cidade: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TerreiroLoginOption(BaseModel):
    id: UUID
    nome: str


class TerreiroSelectionResponse(BaseModel):
    requires_terreiro: Literal[True] = True
    terreiros: list[TerreiroLoginOption]

class UsuarioResponse(BaseModel):
    id: UUID
    nome: str
    email: str
    role: str
    terreiro_id: UUID
    terreiro_nome: Optional[str] = None

    class Config:
        from_attributes = True
