import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class Consulente(Base):
    __tablename__ = "consulentes"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome          = Column(String(255), nullable=False)
    telefone      = Column(String(20), unique=True, nullable=False, index=True)  # normalizado E.164
    primeira_visita = Column(Boolean, default=True)
    notas         = Column(Text, nullable=True)   # observações livres sobre o consulente
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    inscricoes = relationship("InscricaoGira", back_populates="consulente")
