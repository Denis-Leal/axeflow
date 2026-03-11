import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, ForeignKey, Text, UniqueConstraint, Index, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.enums import StatusInscricaoEnum


class InscricaoGira(Base):
    __tablename__ = "inscricoes_gira"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    gira_id = Column(
        UUID(as_uuid=True),
        ForeignKey("giras.id", ondelete="CASCADE"),
        nullable=False
    )

    consulente_id = Column(
        UUID(as_uuid=True),
        ForeignKey("consulentes.id"),
        nullable=True
    )

    membro_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=True
    )

    posicao = Column(Integer, nullable=False)

    status = Column(
        Enum(
            StatusInscricaoEnum,
            name="status_inscricao_enum",
            create_constraint=True
        ),
        nullable=False,
        default=StatusInscricaoEnum.confirmado
    )

    observacoes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("gira_id", "consulente_id", name="uq_gira_consulente"),
        Index("ix_inscricoes_gira_status", "gira_id", "status"),
        Index("ix_inscricoes_gira_posicao", "gira_id", "posicao"),
    )

    gira = relationship("Gira", back_populates="inscricoes")
    consulente = relationship("Consulente", back_populates="inscricoes")