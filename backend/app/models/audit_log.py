import uuid
from sqlalchemy import Column, String, Integer, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    context = Column(String(100), nullable=False, index=True)

    status = Column(Integer)

    code = Column(String(50))

    message = Column(Text)

    url = Column(Text)

    method = Column(String(10))

    user_agent = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())