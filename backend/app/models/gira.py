"""
gira.py — AxeFlow
Model de gira (evento espiritual do terreiro).
Suporta dois tipos de acesso: pública (consulentes externos) e fechada (só membros).
Soft delete via deleted_at: giras nunca são apagadas fisicamente do banco.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Date, Time, ForeignKey, Enum, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class StatusGiraEnum(str, enum.Enum):
    aberta    = "aberta"
    fechada   = "fechada"
    concluida = "concluida"


class AcessoGiraEnum(str, enum.Enum):
    publica = "publica"   # consulentes externos podem se inscrever via link
    fechada = "fechada"   # somente membros do terreiro


class Gira(Base):
    __tablename__ = "giras"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    terreiro_id          = Column(UUID(as_uuid=True), ForeignKey("terreiros.id"), nullable=False)
    titulo               = Column(String(255), nullable=False)
    tipo                 = Column(String(100))
    data                 = Column(Date, nullable=False)
    horario              = Column(Time, nullable=False)
    # Preenchido para giras públicas, NULL para fechadas (que não têm limite de vagas)
    limite_consulentes   = Column(Integer, nullable=True)
    # Preenchido para giras fechadas, NULL para públicas (que não têm limite de membros)
    limite_membros       = Column(Integer, nullable=True)
    abertura_lista       = Column(DateTime, nullable=True)
    fechamento_lista     = Column(DateTime, nullable=True)
    responsavel_lista_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"))
    status               = Column(Enum(StatusGiraEnum), default=StatusGiraEnum.aberta)
    acesso               = Column(Enum(AcessoGiraEnum), default=AcessoGiraEnum.publica)
    # Slug único gerado automaticamente para giras públicas; NULL para fechadas
    slug_publico         = Column(String(255), unique=True, nullable=True)
    created_at           = Column(DateTime, default=datetime.utcnow)
    updated_at           = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Soft delete: NULL = ativa, preenchido = "deletada"
    deleted_at           = Column(DateTime, nullable=True)

    terreiro          = relationship("Terreiro", back_populates="giras")
    responsavel_lista = relationship("Usuario", back_populates="giras_responsavel")
    # cascade garante que inscrições sejam deletadas quando a gira for deletada
    inscricoes        = relationship("InscricaoGira", back_populates="gira", cascade="all, delete-orphan")

    # Índices para queries mais frequentes
    __table_args__ = (
        # Listagem de giras de um terreiro por data (query principal do dashboard)
        Index("ix_giras_terreiro_data", "terreiro_id", "data"),
        # Lookup por slug (endpoint público)
        Index("ix_giras_slug_publico", "slug_publico"),
    )
