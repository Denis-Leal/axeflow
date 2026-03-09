import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Date, Time, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum

class StatusGiraEnum(str, enum.Enum):
    aberta = "aberta"
    fechada = "fechada"
    concluida = "concluida"

class AcessoGiraEnum(str, enum.Enum):
    publica = "publica"    # consulentes externos podem se inscrever
    fechada = "fechada"    # somente membros do terreiro

class Gira(Base):
    __tablename__ = "giras"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    terreiro_id = Column(UUID(as_uuid=True), ForeignKey("terreiros.id"), nullable=False)
    titulo = Column(String(255), nullable=False)
    tipo = Column(String(100))
    data = Column(Date, nullable=False)
    horario = Column(Time, nullable=False)
    limite_consulentes = Column(Integer, nullable=False)
    abertura_lista = Column(DateTime, nullable=False)
    fechamento_lista = Column(DateTime, nullable=False)
    responsavel_lista_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"))
    status = Column(Enum(StatusGiraEnum), default=StatusGiraEnum.aberta)
    acesso = Column(Enum(AcessoGiraEnum), default=AcessoGiraEnum.publica)
    slug_publico = Column(String(255), unique=True, nullable=True)  # NULL para giras fechadas
    created_at = Column(DateTime, default=datetime.utcnow)

    terreiro = relationship("Terreiro", back_populates="giras")
    responsavel_lista = relationship("Usuario", back_populates="giras_responsavel")
    inscricoes = relationship("InscricaoGira", back_populates="gira", cascade="all, delete-orphan")
