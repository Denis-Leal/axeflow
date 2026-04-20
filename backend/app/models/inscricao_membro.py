"""
inscricao_membro.py — AxeFlow
Inscrição/confirmação de membro do terreiro em gira fechada.

Separado de InscricaoConsulente para domínio claro: membros confirmam
presença própria, não entram em fila de espera, e não têm score de
confiabilidade (são do terreiro — contexto completamente diferente).

Status simplificado (sem lista_espera — membros não ficam em fila):
  confirmado → compareceu | faltou | cancelado
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, ForeignKey, Enum, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.utils.enuns import StatusInscricaoEnum


class InscricaoMembro(Base):
    __tablename__ = "inscricoes_membro"

    id        = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gira_id   = Column(UUID(as_uuid=True), ForeignKey("giras.id", ondelete="CASCADE"), nullable=False)
    membro_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)

    # posicao mantido por consistência e exibição (não usado para fila)
    posicao = Column(Integer, nullable=False)

    status = Column(Enum(StatusInscricaoEnum), default=StatusInscricaoEnum.confirmado, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    gira   = relationship("Gira", back_populates="inscricoes_membro", passive_deletes=True)
    membro = relationship("Usuario", back_populates="inscricoes_membro")

    __table_args__ = (
        # 1 confirmação por membro por gira
        UniqueConstraint("gira_id", "membro_id", name="uq_inscricao_membro_gira"),
        # Consulta de presença por gira + status
        Index("ix_inscricao_membro_status", "gira_id", "status"),
    )