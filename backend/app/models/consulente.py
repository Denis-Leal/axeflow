"""
consulente.py — AxeFlow
Model de consulente externo que se inscreve em giras públicas.

ALTERAÇÃO: adicionado relacionamento `inscricoes` apontando para
InscricaoConsulente (novo model separado). O back_populates espelhado
em inscricao_consulente.py.
"""
import uuid
from app.utils.datetime_utils import utcnow
from sqlalchemy import Column, ForeignKey, String, Boolean, DateTime, Text, Index, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.core.database import Base
from datetime import datetime

class Consulente(Base):
    __tablename__ = "consulentes"

    id              : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome            : Mapped[str] = mapped_column(String(255), nullable=False)
    terreiro_id     : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("terreiros.id"), nullable=False)
    # Telefone sempre normalizado para E.164 sem '+': ex. 5511999999999
    telefone        : Mapped[str] = mapped_column(String(20),  nullable=True)
    primeira_visita : Mapped[bool] = mapped_column(Boolean, default=True)
    notas           : Mapped[str] = mapped_column(Text, nullable=True)
    created_at      : Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at      : Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    created_by      : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=True)  # ID do usuário que criou o registro
    source          : Mapped[str] = mapped_column(String(255), nullable=True)  # Ex: "link_publico", "cadastro_manual"

    terreiro        = relationship("Terreiro", back_populates="consulente")
    # Relacionamento com o novo model separado de inscrição de consulentes
    inscricoes      = relationship("InscricaoConsulente", back_populates="consulente")
    deleted_at      : Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    __table_args__ = (
    Index(
        "ux_consulente_telefone_ativo",
        "telefone",
        "terreiro_id",
        unique=True,
        postgresql_where=text("deleted_at IS NULL")
    ),
)