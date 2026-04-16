"""
consulente.py — AxeFlow
Model de consulente externo que se inscreve em giras públicas.

ALTERAÇÃO: adicionado relacionamento `inscricoes` apontando para
InscricaoConsulente (novo model separado). O back_populates espelhado
em inscricao_consulente.py.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Consulente(Base):
    __tablename__ = "consulentes"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome            = Column(String(255), nullable=False)
    # Telefone sempre normalizado para E.164 sem '+': ex. 5511999999999
    telefone        = Column(String(20),  nullable=False)
    primeira_visita = Column(Boolean, default=True)
    notas           = Column(Text, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by      = Column(UUID(as_uuid=True), nullable=True)  # ID do usuário que criou o registro
    source          = Column(String(255), nullable=True)  # Ex: "link_publico", "cadastro_manual"

    # Relacionamento com o novo model separado de inscrição de consulentes
    inscricoes = relationship("InscricaoConsulente", back_populates="consulente")

    __table_args__ = (
        Index("ix_consulentes_telefone", "telefone"),
    )