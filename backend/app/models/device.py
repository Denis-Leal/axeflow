# app/models/device.py

from app.utils.datetime_utils import utcnow
from app.core.database import Base
from sqlalchemy.dialects.postgresql import UUID 
import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

class Device(Base):
    __tablename__ = "devices"

    id : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)
    terreiro_id : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("terreiros.id"), nullable=False)

    token : Mapped[str] = mapped_column(Text, nullable=False, unique=True)

    platform : Mapped[str] = mapped_column(String, nullable=False)  # web, android, ios
    provider : Mapped[str] = mapped_column(String, nullable=False)  # fcm

    active : Mapped[bool] = mapped_column(Boolean, default=True)
    last_seen : Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_at : Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)