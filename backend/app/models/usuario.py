"""
usuario.py — AxeFlow
Model de usuário do sistema (admin, operador ou membro do terreiro).
Usuários inativos (ativo=False) não conseguem autenticar.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class RoleEnum(str, enum.Enum):
    admin    = "admin"     # gestão completa do terreiro
    operador = "operador"  # cria/edita giras, convida membros
    membro   = "membro"    # confirma própria presença


class Usuario(Base):
    __tablename__ = "usuarios"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    terreiro_id = Column(UUID(as_uuid=True), ForeignKey("terreiros.id"), nullable=False)
    nome        = Column(String(255), nullable=False)
    telefone    = Column(String(20))
    email       = Column(String(255), unique=True, nullable=False)
    senha_hash  = Column(String(255), nullable=False)
    role        = Column(Enum(RoleEnum), default=RoleEnum.membro)
    ativo       = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    terreiro          = relationship("Terreiro", back_populates="usuarios")
    giras_responsavel = relationship("Gira", back_populates="responsavel_lista")
