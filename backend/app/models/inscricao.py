import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum

class StatusInscricaoEnum(str, enum.Enum):
    confirmado = "confirmado"
    compareceu = "compareceu"
    faltou = "faltou"
    cancelado = "cancelado"

class InscricaoGira(Base):
    __tablename__ = "inscricoes_gira"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gira_id = Column(UUID(as_uuid=True), ForeignKey("giras.id"), nullable=False)
    consulente_id = Column(UUID(as_uuid=True), ForeignKey("consulentes.id"), nullable=True)  # NULL para giras fechadas
    membro_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)          # usado em giras fechadas
    posicao = Column(Integer, nullable=False)
    status = Column(Enum(StatusInscricaoEnum), default=StatusInscricaoEnum.confirmado)
    created_at = Column(DateTime, default=datetime.utcnow)

    gira = relationship("Gira", back_populates="inscricoes")
    consulente = relationship("Consulente", back_populates="inscricoes")
