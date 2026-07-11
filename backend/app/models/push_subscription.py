import uuid
from app.utils.datetime_utils import utcnow
from sqlalchemy import Column, ForeignKey, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id         : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    endpoint   : Mapped[Text] = mapped_column(Text, unique=True, nullable=False, index=True)
    p256dh     : Mapped[Text] = mapped_column(Text, nullable=False)   # chave pública do browser
    auth       : Mapped[Text] = mapped_column(Text, nullable=False)   # segredo de autenticação
    created_at : Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at : Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user_id : Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey("usuarios.id"), nullable=False)
    terreiro_id : Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey("terreiros.id"), nullable=False)
