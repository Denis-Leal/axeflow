# app/models/notification_log.py

from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from datetime import datetime
import uuid
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    device_id = Column(UUID, ForeignKey("devices.id"))
    user_id = Column(UUID, nullable=False)

    payload_hash = Column(String, nullable=False)
    success = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)