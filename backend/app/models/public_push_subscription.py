import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.utils.datetime_utils import utcnow


class PublicPushSubscription(Base):
    """FCM registrations made by anonymous visitors of the public portal."""
    __tablename__ = "public_push_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token: Mapped[str] = mapped_column(Text, nullable=False)
    # NULL means the explicitly opted-in global public feed.
    terreiro_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("terreiros.id", ondelete="CASCADE"), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    __table_args__ = (Index("ix_public_push_subscriptions_terreiro_active", "terreiro_id", "active"),)
