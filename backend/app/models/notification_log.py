# app/models/notification_log.py

from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from app.utils.datetime_utils import utcnow
import uuid
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    device_id : Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey("devices.id"))
    user_id : Mapped[uuid.UUID] = mapped_column(UUID, nullable=False)

    payload_hash : Mapped[str] = mapped_column(String, nullable=False)
    success : Mapped[bool] = mapped_column(Boolean, default=False)

    created_at : Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)