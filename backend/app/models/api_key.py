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
from datetime import datetime
from sqlalchemy import (
    Column, String, Boolean, DateTime, BigInteger, Text,
    ForeignKey, Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class ApiKey(Base):
    __tablename__ = "api_keys"

    # ── Identidade ─────────────────────────────────────────────────────────────
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    terreiro_id = Column(
        UUID(as_uuid=True),
        ForeignKey("terreiros.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
    )

    # ── Chave (nunca armazenar o valor real) ───────────────────────────────────
    # prefix: 'axf_XXXX' — permite identificar a chave sem expô-la
    prefix   = Column(String(10), nullable=False)
    # key_hash: SHA-256 hexdigest da chave completa
    key_hash = Column(String(64), nullable=False, unique=True)

    # ── Metadados ──────────────────────────────────────────────────────────────
    nome      = Column(String(100), nullable=False)
    descricao = Column(Text, nullable=True)

    # ── Permissões ─────────────────────────────────────────────────────────────
    # Lista de scopes: ["giras:read", "inscricoes:write", ...]
    scopes = Column(JSONB, nullable=False, default=list)

    # ── Controle de acesso ─────────────────────────────────────────────────────
    ativa      = Column(Boolean, nullable=False, default=True)
    expires_at = Column(DateTime, nullable=True)   # None = não expira

    # ── Auditoria de uso ───────────────────────────────────────────────────────
    last_used_at  = Column(DateTime, nullable=True)
    request_count = Column(BigInteger, nullable=False, default=0)

    # ── Timestamps ─────────────────────────────────────────────────────────────
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)

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
        return datetime.utcnow() > self.expires_at

    @property
    def valida(self) -> bool:
        """Chave está ativa e não expirada."""
        return self.ativa and not self.expirada