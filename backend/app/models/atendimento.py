import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Index, Numeric, String, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.utils.datetime_utils import utcnow


class TipoCobrancaAtendimentoEnum(str, enum.Enum):
    servico = "servico"
    hora = "hora"


class StatusAgendamentoEnum(str, enum.Enum):
    agendado = "agendado"
    concluido = "concluido"
    cancelado = "cancelado"


class AtendimentoTipo(Base):
    __tablename__ = "atendimento_tipos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    terreiro_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("terreiros.id"), nullable=False)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    descricao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    valor: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    tipo_cobranca: Mapped[TipoCobrancaAtendimentoEnum] = mapped_column(
        SAEnum(TipoCobrancaAtendimentoEnum, name="tipo_cobranca_atendimento_enum"),
        nullable=False,
    )
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)

    terreiro = relationship("Terreiro", back_populates="atendimento_tipos")
    criador = relationship("Usuario", foreign_keys=[created_by])
    agendamentos = relationship("Agendamento", back_populates="atendimento_tipo")

    __table_args__ = (
        Index("ix_atendimento_tipo_terreiro", "terreiro_id"),
        Index("ix_atendimento_tipo_terreiro_ativo", "terreiro_id", "ativo"),
    )


class Agendamento(Base):
    __tablename__ = "agendamentos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    terreiro_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("terreiros.id"), nullable=False)
    consulente_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("consulentes.id"), nullable=False)
    atendimento_tipo_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("atendimento_tipos.id"), nullable=False)
    inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fim: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    valor: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[StatusAgendamentoEnum] = mapped_column(
        SAEnum(StatusAgendamentoEnum, name="status_agendamento_enum"),
        nullable=False,
        default=StatusAgendamentoEnum.agendado,
    )
    observacoes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)

    terreiro = relationship("Terreiro", back_populates="agendamentos")
    consulente = relationship("Consulente", back_populates="agendamentos")
    atendimento_tipo = relationship("AtendimentoTipo", back_populates="agendamentos")
    criador = relationship("Usuario", foreign_keys=[created_by])

    __table_args__ = (
        Index("ix_agendamento_terreiro_inicio", "terreiro_id", "inicio"),
        Index("ix_agendamento_terreiro_status", "terreiro_id", "status"),
        Index("ix_agendamento_consulente", "consulente_id"),
        Index("ix_agendamento_atendimento_tipo", "atendimento_tipo_id"),
    )
