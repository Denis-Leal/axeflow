"""
consulente.py — AxeFlow
Model de consulente externo que se inscreve em giras públicas.
Não possui conta no sistema — identificado por telefone normalizado (E.164).
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Consulente(Base):
    __tablename__ = "consulentes"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome           = Column(String(255), nullable=False)
    # Telefone sempre normalizado para E.164 sem '+': ex. 5511999999999
    telefone       = Column(String(20), unique=True, nullable=False)
    primeira_visita = Column(Boolean, default=True)
    # Campo livre para o terreiro anotar observações sobre o consulente
    notas          = Column(Text, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    inscricoes = relationship("InscricaoGira", back_populates="consulente")

    # Índice no telefone — coluna de busca frequente e chave de deduplicação
    __table_args__ = (
        Index("ix_consulentes_telefone", "telefone"),
    )
