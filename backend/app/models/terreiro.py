import uuid
from app.utils.datetime_utils import utcnow
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime
from app.core.database import Base

class Terreiro(Base):
    __tablename__ = "terreiros"

    id : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome : Mapped[str] = mapped_column(String(255), nullable=False)
    cidade : Mapped[str] = mapped_column(String(255), nullable=False)
    created_at : Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    usuarios = relationship("Usuario", back_populates="terreiro")
    giras = relationship("Gira", back_populates="terreiro")
    consulente = relationship("Consulente", back_populates="terreiro")
