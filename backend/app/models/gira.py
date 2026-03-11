import uuid
from sqlalchemy import Column, String, Integer, DateTime, Date, Time, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Gira(Base):
    __tablename__ = "giras"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    terreiro_id = Column(
        UUID(as_uuid=True),
        ForeignKey("terreiros.id", ondelete="CASCADE"),
        nullable=False
    )

    titulo = Column(String(255), nullable=False)

    tipo = Column(String(100))

    data = Column(Date, nullable=False)

    horario = Column(Time, nullable=False)

    limite_consulentes = Column(Integer, nullable=False)

    abertura_lista = Column(DateTime(timezone=True))

    fechamento_lista = Column(DateTime(timezone=True))

    responsavel_lista_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL")
    )

    status = Column(String(20), default="aberta")

    acesso = Column(String(20), default="publica")

    slug_publico = Column(String(255), unique=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_giras_terreiro_data", "terreiro_id", "data"),
    )

    terreiro = relationship("Terreiro", back_populates="giras")

    responsavel_lista = relationship("Usuario", back_populates="giras_responsavel")

    inscricoes = relationship(
        "InscricaoGira",
        back_populates="gira",
        cascade="all, delete-orphan"
    )