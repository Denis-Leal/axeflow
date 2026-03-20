"""
gira.py — AxeFlow
Model de gira (evento espiritual do terreiro).

ALTERAÇÃO: relacionamentos de inscrição atualizados para os novos models
separados. back_populates agora aponta para:
  - inscricoes_consulente (InscricaoConsulente) — giras públicas
  - inscricoes_membro     (InscricaoMembro)     — giras fechadas

O relacionamento legado `inscricoes` (InscricaoGira) é mantido
temporariamente enquanto a tabela inscricoes_gira ainda existe.
Remover após a migration 0008 ser aplicada em produção.
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
    limite_consulentes   = Column(Integer, nullable=True)
    limite_membros       = Column(Integer, nullable=True)
    abertura_lista       = Column(DateTime, nullable=True)
    fechamento_lista     = Column(DateTime, nullable=True)
    responsavel_lista_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"))
    status               = Column(Enum(StatusGiraEnum), default=StatusGiraEnum.aberta)
    acesso               = Column(Enum(AcessoGiraEnum), default=AcessoGiraEnum.publica)
    slug_publico         = Column(String(255), unique=True, nullable=True)
    created_at           = Column(DateTime, default=datetime.utcnow)
    updated_at           = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at           = Column(DateTime, nullable=True)

    terreiro          = relationship("Terreiro", back_populates="giras")
    responsavel_lista = relationship("Usuario", back_populates="giras_responsavel")

    # ── Relacionamentos legados (inscricoes_gira) ─────────────────────────────
    # Mantido enquanto a tabela inscricoes_gira ainda existir.
    # Remover após aplicar a migration 0008 em produção.
    inscricoes = relationship(
        "InscricaoGira",
        back_populates="gira",
        cascade="all, delete-orphan",
    )

    # ── Novos relacionamentos separados por domínio ───────────────────────────
    inscricoes_consulente = relationship(
        "InscricaoConsulente",
        back_populates="gira",
        cascade="all, delete-orphan",
    )
    inscricoes_membro = relationship(
        "InscricaoMembro",
        back_populates="gira",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_giras_terreiro_data", "terreiro_id", "data"),
        Index("ix_giras_slug_publico",  "slug_publico"),
    )