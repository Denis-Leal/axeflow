"""
password_reset_token.py — AxeFlow
Model de token de recuperação de senha.

Ciclo de vida do token:
  1. Criado com expires_at = now() + 1h e used_at = NULL
  2. Enviado como hash via email (o valor real nunca persiste)
  3. Validado: token_hash confere + expires_at no futuro + used_at IS NULL
  4. Após uso: used_at preenchido — token não pode ser reutilizado
  5. Limpeza periódica remove tokens expirados (pode ser feita pelo cleanup_service)
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    # ── Identidade ─────────────────────────────────────────────────────────────
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
    )
    terreiro_id = Column(
        UUID(as_uuid=True),
        ForeignKey("terreiros.id", ondelete="CASCADE"),
        nullable=False,
    )

    # ── Token (apenas o hash é persistido) ────────────────────────────────────
    token_hash = Column(String(64), nullable=False, unique=True)

    # ── Controle de validade ───────────────────────────────────────────────────
    expires_at = Column(DateTime, nullable=False)
    used_at    = Column(DateTime, nullable=True)  # None = ainda não usado

    # ── Timestamps ─────────────────────────────────────────────────────────────
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # ── Relacionamentos ────────────────────────────────────────────────────────
    usuario  = relationship("Usuario")
    terreiro = relationship("Terreiro")

    # ── Índices ────────────────────────────────────────────────────────────────
    __table_args__ = (
        Index("ix_prt_token_hash", "token_hash"),
        Index("ix_prt_expires_at", "expires_at"),
        Index("ix_prt_user_id",    "user_id"),
    )

    @property
    def valido(self) -> bool:
        """Token pode ser usado: não expirou e ainda não foi utilizado."""
        return self.used_at is None and datetime.utcnow() < self.expires_at

    @property
    def expirado(self) -> bool:
        return datetime.utcnow() >= self.expires_at