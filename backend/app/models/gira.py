"""
gira.py — AxeFlow
Model de gira (evento espiritual do terreiro).

ALTERAÇÃO: relacionamentos de inscrição atualizados para os novos models
separados. back_populates agora aponta para:
  - inscricoes_consulente (InscricaoConsulente) — giras públicas
  - inscricoes_membro     (InscricaoMembro)     — giras fechadas

temporariamente enquanto a tabela inscricoes_gira ainda existe.
Remover após a migration 0008 ser aplicada em produção.
"""
import uuid
from app.utils.datetime_utils import utcnow
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Date, Time, ForeignKey, Enum, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime, date, time
from app.core.database import Base
import enum
from typing import Optional


class StatusGiraEnum(str, enum.Enum):
    aberta    = "aberta"
    fechada   = "fechada"
    concluida = "concluida"


class AcessoGiraEnum(str, enum.Enum):
    publica = "publica"   # consulentes externos podem se inscrever via link
    fechada = "fechada"   # somente membros do terreiro


class Gira(Base):
    __tablename__ = "giras"

    id                   : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    terreiro_id          : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("terreiros.id"), nullable=False)
    titulo               : Mapped[str] = mapped_column(String(255), nullable=False)
    tipo                 : Mapped[str] = mapped_column(String(100))
    data                 : Mapped[date] = mapped_column(Date, nullable=False)
    horario              : Mapped[time] = mapped_column(Time, nullable=False)
    limite_consulentes   : Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    limite_membros       : Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    abertura_lista       : Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    fechamento_lista     : Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    responsavel_lista_id : Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id"))
    status               : Mapped[StatusGiraEnum] = mapped_column(Enum(StatusGiraEnum), default=StatusGiraEnum.aberta)
    acesso               : Mapped[AcessoGiraEnum] = mapped_column(Enum(AcessoGiraEnum), default=AcessoGiraEnum.publica)
    slug_publico         : Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    created_at           : Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at           : Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    deleted_at           : Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Flag de idempotência: True após finalizar_gira() processar o estoque.
    # SELECT FOR UPDATE nesta linha previne dupla finalização concorrente.
    estoque_processado   : Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    terreiro          = relationship("Terreiro", back_populates="giras")
    responsavel_lista = relationship("Usuario", back_populates="giras_responsavel")

    # ── Novos relacionamentos separados por domínio ───────────────────────────
    inscricoes_consulente = relationship(
        "InscricaoConsulente",
        back_populates="gira",
        cascade="all, delete-orphan",
    )
    inscricoes_membro = relationship(
        "InscricaoMembro",
        back_populates="gira",
        cascade="all, delete-orphan",
    )
    ajeum = relationship(
        "Ajeum", 
        back_populates="gira", 
        uselist=False,
    )

    __table_args__ = (
        Index("ix_giras_terreiro_data", "terreiro_id", "data"),
        Index("ix_giras_slug_publico",  "slug_publico"),
    )
    
    consumos_inventario = relationship(
       "GiraItemConsumption",
       back_populates=None,   # GiraItemConsumption não tem back_populates em Gira
       # SEM cascade: consumos são históricos e não devem ser deletados com a gira
   )