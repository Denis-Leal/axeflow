
"""
inscricao_consulente.py — AxeFlow
Inscrição de consulente externo em gira pública.

Separado de InscricaoMembro para eliminar o anti-pattern de duas FKs
mutuamente exclusivas na mesma tabela. Cada tabela tem um domínio claro,
índices menores e queries mais simples.

Ciclo de status:
  confirmado   → compareceu | faltou | cancelado
  lista_espera → confirmado (quando vaga abre) | cancelado
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, ForeignKey, Enum, Text, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.inscricao_status import StatusInscricaoEnum


class InscricaoConsulente(Base):
    __tablename__ = "inscricoes_consulente"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gira_id       = Column(UUID(as_uuid=True), ForeignKey("giras.id", ondelete="CASCADE"), nullable=False)
    consulente_id = Column(UUID(as_uuid=True), ForeignKey("consulentes.id"), nullable=False)

    # posicao: usado para exibição e auditoria.
    # Fonte autoritativa para ordenação em concorrência: created_at.
    posicao     = Column(Integer, nullable=False)

    status      = Column(Enum(StatusInscricaoEnum), default=StatusInscricaoEnum.confirmado, nullable=False)
    observacoes = Column(Text, nullable=True)  # anotação do consulente ao se inscrever

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    gira       = relationship("Gira", back_populates="inscricoes_consulente", passive_deletes=True)
    consulente = relationship("Consulente", back_populates="inscricoes")

    __table_args__ = (
        # 1 inscrição por consulente por gira (canceladas incluídas — controle via status)
        UniqueConstraint("gira_id", "consulente_id", name="uq_inscricao_consulente_gira"),
        # Lista + status (query mais frequente)
        Index("ix_inscricao_consulente_status", "gira_id", "status"),
        # Ordenação por posição (exibição)
        Index("ix_inscricao_consulente_posicao", "gira_id", "posicao"),
        # Ordenação autoritativa em concorrência
        Index("ix_inscricao_consulente_created_at", "gira_id", "created_at"),
    )