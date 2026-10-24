import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, Boolean, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.utils.datetime_utils import utcnow


class PublicacaoTerreiro(Base):
    __tablename__ = "publicacoes_terreiro"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    terreiro_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("terreiros.id", ondelete="CASCADE"), nullable=False)
    titulo: Mapped[str] = mapped_column(String(160), nullable=False)
    conteudo: Mapped[str] = mapped_column(Text, nullable=False)
    categoria: Mapped[str] = mapped_column(String(30), nullable=False, default="aviso")
    publicado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    publicado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expira_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    terreiro = relationship("Terreiro", back_populates="publicacoes")

    __table_args__ = (Index("ix_publicacoes_terreiro_publicado", "terreiro_id", "publicado", "publicado_em"),)
