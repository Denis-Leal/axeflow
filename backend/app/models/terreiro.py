import uuid
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Terreiro(Base):
    __tablename__ = "terreiros"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome = Column(String(255), nullable=False)
    cidade = Column(String(255), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    usuarios = relationship("Usuario", back_populates="terreiro")
    giras = relationship("Gira", back_populates="terreiro")
    consulentes = relationship("Consulente", back_populates="terreiro")