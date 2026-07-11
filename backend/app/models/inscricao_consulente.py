
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
from app.utils.datetime_utils import utcnow
from sqlalchemy import Integer, DateTime, ForeignKey, Enum, String, Text, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime
from app.core.database import Base
from app.utils.enuns import StatusInscricaoEnum


class InscricaoConsulente(Base):
    __tablename__ = "inscricoes_consulente"

    id            : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gira_id       : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("giras.id", ondelete="CASCADE"), nullable=False)
    consulente_id : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("consulentes.id"), nullable=False)
    usuario_id    : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)

    # posicao: usado para exibição e auditoria.
    # Fonte autoritativa para ordenação em concorrência: created_at.
    posicao     : Mapped[int] = mapped_column(Integer, nullable=False)

    status      : Mapped[StatusInscricaoEnum] = mapped_column(Enum(StatusInscricaoEnum), default=StatusInscricaoEnum.confirmado, nullable=False)
    observacoes : Mapped[str] = mapped_column(Text, nullable=True)  # anotação do consulente ao se inscrever

    created_at : Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at : Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    deleted_at : Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    source          : Mapped[str] = mapped_column(String(255), nullable=True)  # Ex: "link_publico", "cadastro_manual"

    gira       = relationship("Gira", back_populates="inscricoes_consulente", passive_deletes=True)
    consulente = relationship("Consulente", back_populates="inscricoes")
    usuario = relationship("Usuario", back_populates="inscricoes_consulente")

    __table_args__ = (
        # 1 inscrição por consulente por gira (canceladas incluídas — controle via status)
        UniqueConstraint("gira_id", "consulente_id", name="uq_inscricao_consulente_gira"),
        # Lista + status (query mais frequente)
        Index("ix_inscricao_consulente_status", "gira_id", "status"),
        # Ordenação por posição (exibição)
        Index("ix_inscricao_consulente_posicao", "gira_id", "posicao"),
        # Ordenação autoritativa em concorrência
        Index("ix_inscricao_consulente_created_at", "gira_id", "created_at"),
        # Ordenação por id usuario
        Index("ix_inscricao_consulente_usuario", "usuario_id")
    )