from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class PerfilPublicoUpdate(BaseModel):
    publico_ativo: bool = False
    slug_publico: Optional[str] = Field(default=None, max_length=120)
    descricao_publica: Optional[str] = Field(default=None, max_length=2000)
    telefone_publico: Optional[str] = Field(default=None, max_length=30)
    whatsapp_publico: Optional[str] = Field(default=None, max_length=30)
    instagram_publico: Optional[str] = Field(default=None, max_length=255)
    endereco_publico: bool = False
    endereco_linha: Optional[str] = Field(default=None, max_length=255)
    bairro: Optional[str] = Field(default=None, max_length=120)
    cidade: Optional[str] = Field(default=None, max_length=255)
    uf: Optional[str] = Field(default=None, max_length=2)
    cep: Optional[str] = Field(default=None, max_length=12)
    latitude: Optional[str] = Field(default=None, max_length=32)
    longitude: Optional[str] = Field(default=None, max_length=32)

    @field_validator("slug_publico")
    @classmethod
    def validar_slug(cls, value):
        if value is not None and value and not value.replace("-", "").isalnum():
            raise ValueError("Slug deve conter apenas letras, números e hífens")
        return value.lower().strip("-") if value else None


class PublicacaoCreate(BaseModel):
    titulo: str = Field(min_length=3, max_length=160)
    conteudo: str = Field(min_length=3, max_length=5000)
    categoria: str = Field(default="aviso", pattern="^(aviso|festa|doacao|noticia)$")
    publicado: bool = False
    expira_em: Optional[datetime] = None


class PublicacaoUpdate(BaseModel):
    titulo: Optional[str] = Field(default=None, min_length=3, max_length=160)
    conteudo: Optional[str] = Field(default=None, min_length=3, max_length=5000)
    categoria: Optional[str] = Field(default=None, pattern="^(aviso|festa|doacao|noticia)$")
    publicado: Optional[bool] = None
    expira_em: Optional[datetime] = None


class PublicacaoResponse(BaseModel):
    id: UUID
    titulo: str
    conteudo: str
    categoria: str
    publicado: bool
    publicado_em: Optional[datetime]
    expira_em: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True
