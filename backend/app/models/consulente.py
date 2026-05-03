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
from sqlalchemy.orm import relationship
from app.core.database import Base


class Consulente(Base):
    __tablename__ = "consulentes"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome            = Column(String(255), nullable=False)
    terreiro_id     = Column(UUID(as_uuid=True), ForeignKey("terreiros.id"), nullable=False)
    # Telefone sempre normalizado para E.164 sem '+': ex. 5511999999999
    telefone        = Column(String(20),  nullable=True)
    primeira_visita = Column(Boolean, default=True)
    notas           = Column(Text, nullable=True)
    created_at      = Column(DateTime(timezone=True), default=utcnow)
    updated_at      = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    created_by      = Column(UUID(as_uuid=True), nullable=True)  # ID do usuário que criou o registro
    source          = Column(String(255), nullable=True)  # Ex: "link_publico", "cadastro_manual"

    terreiro        = relationship("Terreiro", back_populates="consulente")
    # Relacionamento com o novo model separado de inscrição de consulentes
    inscricoes      = relationship("InscricaoConsulente", back_populates="consulente")
    deleted_at      = Column(DateTime(timezone=True), nullable=True)
    __table_args__ = (
    Index(
        "ux_consulente_telefone_ativo",
        "telefone",
        "terreiro_id",
        unique=True,
        postgresql_where=text("deleted_at IS NULL")
    ),
)