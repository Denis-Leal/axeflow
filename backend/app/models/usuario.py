import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    terreiro_id = Column(
        UUID(as_uuid=True),
        ForeignKey("terreiros.id", ondelete="CASCADE"),
        nullable=False
    )

    nome = Column(String(255), nullable=False)
    telefone = Column(String(20))
    email = Column(String(255), unique=True, nullable=False)
    senha_hash = Column(String(255), nullable=False)

    role = Column(String(20), default="membro")

    ativo = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    terreiro = relationship("Terreiro", back_populates="usuarios")

    giras_responsavel = relationship("Gira", back_populates="responsavel_lista")