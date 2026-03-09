import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    context    = Column(String(100), nullable=False, index=True)  # ex: 'login', 'criar_gira'
    status     = Column(Integer, nullable=True)                   # HTTP status code
    code       = Column(String(50), nullable=True)                # ex: ERR_NETWORK
    message    = Column(Text, nullable=True)
    url        = Column(Text, nullable=True)
    method     = Column(String(10), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
