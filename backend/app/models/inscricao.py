import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, ForeignKey, Enum, Text, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum

class StatusInscricaoEnum(str, enum.Enum):
    confirmado   = "confirmado"
    lista_espera = "lista_espera"   # vaga esgotada — entrou na fila de espera
    compareceu   = "compareceu"
    faltou       = "faltou"
    cancelado    = "cancelado"

class InscricaoGira(Base):
    __tablename__ = "inscricoes_gira"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gira_id       = Column(UUID(as_uuid=True), ForeignKey("giras.id"), nullable=False)
    consulente_id = Column(UUID(as_uuid=True), ForeignKey("consulentes.id"), nullable=True)
    membro_id     = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)
    posicao       = Column(Integer, nullable=False)
    status        = Column(Enum(StatusInscricaoEnum), default=StatusInscricaoEnum.confirmado)
    observacoes   = Column(Text, nullable=True)   # anotações sobre a inscrição
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        # Um consulente só pode ter uma inscrição ativa por gira
        UniqueConstraint("gira_id", "consulente_id", name="uq_gira_consulente"),
        # Índices de performance
        Index("ix_inscricoes_gira_status",    "gira_id", "status"),
        Index("ix_inscricoes_gira_posicao",   "gira_id", "posicao"),
    )

    gira      = relationship("Gira", back_populates="inscricoes", passive_deletes=True)
    consulente = relationship("Consulente", back_populates="inscricoes")
