import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Consulente(Base):
    __tablename__ = "consulentes"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    terreiro_id     = Column(UUID(as_uuid=True),ForeignKey("terreiros.id", ondelete="CASCADE"),nullable=False)
    nome            = Column(String(255), nullable=False)
    telefone        = Column(String(20), nullable=False)
    primeira_visita = Column(Boolean, default=True)
    notas           = Column(Text)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True),server_default=func.now(),onupdate=func.now())
    __table_args__  = (UniqueConstraint("terreiro_id", "telefone"),)
    terreiro        = relationship("Terreiro", back_populates="consulentes")
    inscricoes      = relationship("InscricaoGira", back_populates="consulente")