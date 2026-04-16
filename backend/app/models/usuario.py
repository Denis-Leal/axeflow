"""
usuario.py — AxeFlow
Model de usuário do sistema (admin, operador ou membro do terreiro).

ALTERAÇÃO: adicionado relacionamento `inscricoes_membro` para o novo
model InscricaoMembro. O back_populates espelhado em inscricao_membro.py.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UniqueConstraint
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
    email       = Column(String(255), nullable=False)
    senha_hash  = Column(String(255), nullable=False)
    role        = Column(String(50), default=RoleEnum.membro)
    ativo       = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    terreiro          = relationship("Terreiro", back_populates="usuarios")
    giras_responsavel = relationship("Gira", back_populates="responsavel_lista")

    # Relacionamento com o novo model separado de inscrição de membros
    inscricoes_membro = relationship("InscricaoMembro", back_populates="membro")
    
    inscricoes_consulente = relationship("InscricaoConsulente", back_populates="usuario")

    __table_args__ = (
        UniqueConstraint("email", "terreiro_id", name="uq_usuario_email_terreiro"),
    )