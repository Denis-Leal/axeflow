"""
inscricao.py — AxeFlow (LEGADO)
Model original de inscrição — mantido durante período de transição.

CORREÇÃO: back_populates removido dos relacionamentos consulente e membro
para não colidir com os novos models:
  - Consulente.inscricoes → agora aponta para InscricaoConsulente
  - Usuario não tem par legado declarado

O relacionamento com Gira mantém back_populates pois Gira.inscricoes
ainda aponta para este model.

Será removido após a migration 0008 ser aplicada em produção.
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, Integer, DateTime, ForeignKey, Enum, Text,
    UniqueConstraint, Index, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class StatusInscricaoEnum(str, enum.Enum):
    confirmado   = "confirmado"   # inscricao ativa dentro do limite de vagas
    lista_espera = "lista_espera" # fila aguardando vaga
    compareceu   = "compareceu"   # marcado apos a gira acontecer
    faltou       = "faltou"       # marcado apos a gira acontecer
    cancelado    = "cancelado"    # desistencia (nao penaliza o score)


class InscricaoGira(Base):
    __tablename__ = "inscricoes_gira"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gira_id       = Column(UUID(as_uuid=True), ForeignKey("giras.id"), nullable=False)
    consulente_id = Column(UUID(as_uuid=True), ForeignKey("consulentes.id"), nullable=True)
    membro_id     = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)
    posicao       = Column(Integer, nullable=False)
    status        = Column(Enum(StatusInscricaoEnum), default=StatusInscricaoEnum.confirmado)
    observacoes   = Column(Text, nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Gira.inscricoes ainda aponta para este model: back_populates mantido.
    gira = relationship("Gira", back_populates="inscricoes", passive_deletes=True)

    # back_populates REMOVIDO: Consulente.inscricoes agora pertence ao novo
    # InscricaoConsulente. foreign_keys explicito evita ambiguidade.
    consulente = relationship("Consulente", foreign_keys=[consulente_id])
    membro     = relationship("Usuario",    foreign_keys=[membro_id])

    __table_args__ = (
        CheckConstraint(
            "(consulente_id IS NOT NULL AND membro_id IS NULL) OR "
            "(consulente_id IS NULL AND membro_id IS NOT NULL)",
            name="ck_inscricao_exactly_one_participant",
        ),
        UniqueConstraint("gira_id", "consulente_id", name="uq_inscricao_gira_consulente"),
        UniqueConstraint("gira_id", "membro_id",     name="uq_inscricao_gira_membro"),
        Index("ix_inscricao_gira_status",     "gira_id", "status"),
        Index("ix_inscricao_gira_posicao",    "gira_id", "posicao"),
        Index("ix_inscricao_gira_created_at", "gira_id", "created_at"),
    )