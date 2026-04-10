# app/models/device.py

from datetime import datetime
from unittest.mock import Base
from uuid import UUID
import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text


class Device(Base):
    __tablename__ = "devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(UUID, ForeignKey("usuarios.id"), nullable=False)
    terreiro_id = Column(UUID, ForeignKey("terreiros.id"), nullable=False)

    token = Column(Text, nullable=False, unique=True)

    platform = Column(String, nullable=False)  # web, android, ios
    provider = Column(String, nullable=False)  # fcm

    active = Column(Boolean, default=True)
    last_seen = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)