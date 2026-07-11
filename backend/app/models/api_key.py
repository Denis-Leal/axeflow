"""
api_key.py — AxeFlow
Model de chave de API para integrações externas.

Segurança:
  - key_hash armazena SHA-256 da chave completa (irreversível)
  - prefix armazena os primeiros chars para identificação visual
  - O valor real da chave é gerado uma única vez e nunca persiste no banco
  - terreiro_id garante isolamento multi-tenant em todas as queries

Formato da chave gerada:
  axf_<32 bytes hex aleatórios>
  Exemplo: axf_a3f7b2c1d4e5f6789abcdef0123456789abcdef0123456789abcdef01234567
"""
import uuid
from app.utils.datetime_utils import utcnow
from sqlalchemy import (
    Column, String, Boolean, DateTime, BigInteger, Text,
    ForeignKey, Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.core.database import Base
from datetime import datetime

class ApiKey(Base):
    __tablename__ = "api_keys"

    # ── Identidade ─────────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    terreiro_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("terreiros.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
    )

    # ── Chave (nunca armazenar o valor real) ───────────────────────────────────
    # prefix: 'axf_XXXX' — permite identificar a chave sem expô-la
    prefix  : Mapped[str] = mapped_column(String(10), nullable=False)
    # key_hash: SHA-256 hexdigest da chave completa
    key_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)

    # ── Metadados ──────────────────────────────────────────────────────────────
    nome      : Mapped[str] = mapped_column(String(100), nullable=False)
    descricao : Mapped[str] = mapped_column(Text, nullable=True)

    # ── Permissões ─────────────────────────────────────────────────────────────
    # Lista de scopes: ["giras:read", "inscricoes:write", ...]
    scopes : Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    # ── Controle de acesso ─────────────────────────────────────────────────────
    ativa      : Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    expires_at : Mapped[datetime] = mapped_column(DateTime, nullable=True)   # None = não expira

    # ── Auditoria de uso ───────────────────────────────────────────────────────
    last_used_at  : Mapped[datetime] = mapped_column(DateTime, nullable=True)
    request_count : Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)

    # ── Timestamps ─────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    revoked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Relacionamentos ────────────────────────────────────────────────────────
    terreiro = relationship("Terreiro")
    usuario  = relationship("Usuario")

    # ── Índices ────────────────────────────────────────────────────────────────
    __table_args__ = (
        Index("ix_api_keys_key_hash", "key_hash"),
        Index("ix_api_keys_terreiro", "terreiro_id"),
        Index("ix_api_keys_ativa",    "terreiro_id", "ativa"),
    )

    @property
    def expirada(self) -> bool:
        """Retorna True se a chave já passou da data de expiração."""
        if self.expires_at is None:
            return False
        return utcnow() > self.expires_at

    @property
    def valida(self) -> bool:
        """Chave está ativa e não expirada."""
        return self.ativa and not self.expirada