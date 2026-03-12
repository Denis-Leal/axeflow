"""
inscricao.py — AxeFlow
Model de inscrição de um consulente ou membro em uma gira.

Para giras públicas: consulente_id preenchido, membro_id NULL.
Para giras fechadas: membro_id preenchido, consulente_id NULL.

Ciclo de status:
  confirmado   → compareceu | faltou | cancelado
  lista_espera → confirmado (quando vaga abre) | cancelado
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, Integer, DateTime, ForeignKey, Enum, Text,
    UniqueConstraint, Index, String
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class StatusInscricaoEnum(str, enum.Enum):
    confirmado   = "confirmado"   # inscrição ativa dentro do limite de vagas
    lista_espera = "lista_espera" # fila aguardando vaga
    compareceu   = "compareceu"   # marcado após a gira acontecer
    faltou       = "faltou"       # marcado após a gira acontecer
    cancelado    = "cancelado"    # desistência (não penaliza o score)


class InscricaoGira(Base):
    __tablename__ = "inscricoes_gira"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gira_id        = Column(UUID(as_uuid=True), ForeignKey("giras.id"), nullable=False)
    # Preenchido em giras públicas
    consulente_id  = Column(UUID(as_uuid=True), ForeignKey("consulentes.id"), nullable=True)
    # Preenchido em giras fechadas
    membro_id      = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)
    posicao        = Column(Integer, nullable=False)
    status         = Column(String(20), default=StatusInscricaoEnum.confirmado.value, nullable=False)
    # Campo livre para anotações da gira (ex: "veio com acompanhante", "urgente")
    observacoes    = Column(Text, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # passive_deletes=True: deixa o ON DELETE CASCADE do banco agir diretamente
    gira       = relationship("Gira", back_populates="inscricoes", passive_deletes=True)
    consulente = relationship("Consulente", back_populates="inscricoes")

    __table_args__ = (
        # Garante 1 inscrição ativa por consulente por gira (impede duplicatas silenciosas)
        UniqueConstraint("gira_id", "consulente_id", name="uq_inscricao_gira_consulente"),
        # Índice composto para consultas de lista + status (query mais comum)
        Index("ix_inscricao_gira_status", "gira_id", "status"),
        # Índice para ordenação por posição na fila
        Index("ix_inscricao_gira_posicao", "gira_id", "posicao"),
    )
