import uuid
from app.utils.datetime_utils import utcnow
from sqlalchemy import Column, String, DateTime, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime
from typing import Optional
from app.core.database import Base

class Terreiro(Base):
    __tablename__ = "terreiros"

    id : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome : Mapped[str] = mapped_column(String(255), nullable=False)
    cidade : Mapped[str] = mapped_column(String(255), nullable=False)
    # Dados opt-in do Portal Público. Um terreiro continua privado por padrão.
    publico_ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    slug_publico: Mapped[Optional[str]] = mapped_column(String(120), unique=True, nullable=True)
    descricao_publica: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    telefone_publico: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    whatsapp_publico: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    instagram_publico: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    endereco_publico: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    endereco_linha: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    bairro: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    uf: Mapped[Optional[str]] = mapped_column(String(2), nullable=True)
    cep: Mapped[Optional[str]] = mapped_column(String(12), nullable=True)
    latitude: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    longitude: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    created_at : Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    usuarios = relationship("Usuario", back_populates="terreiro")
    giras = relationship("Gira", back_populates="terreiro")
    consulente = relationship("Consulente", back_populates="terreiro")
    atendimento_tipos = relationship("AtendimentoTipo", back_populates="terreiro")
    agendamentos = relationship("Agendamento", back_populates="terreiro")
    publicacoes = relationship("PublicacaoTerreiro", back_populates="terreiro", cascade="all, delete-orphan")
