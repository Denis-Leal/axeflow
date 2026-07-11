"""
inventory_alert.py / gira_notification.py — AxeFlow
Estruturas de alerta e notificação.

InventoryAlert:
  Alerta de estoque baixo. Segue padrão de "one active alert per item":
  - Se estoque <= minimum_threshold → cria alerta (se não existir aberto)
  - Se estoque subir acima do threshold → resolve o alerta (resolved_at)
  - Se cair de novo → cria um NOVO alerta (ciclo reinicia)

  last_notified_at previne spam: notifica no máximo 1x por período configurável.

GiraNotification:
  Notificação por tipo de evento relacionado a uma gira.
  Apenas estrutura por enquanto — push será integrado em etapa futura.

  MISSING_CONSUMPTION: médium participou da gira mas não registrou consumo.
  Gerado automaticamente no fechamento da gira.

  read_at: null = não lida, preenchida = lida.
"""
import uuid
import enum
from app.utils.datetime_utils import utcnow
from sqlalchemy import Column, DateTime, ForeignKey, Index, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime
from sqlalchemy import Enum as SAEnum, String
from app.core.database import Base


# ── InventoryAlert ────────────────────────────────────────────────────────────

class InventoryAlert(Base):
    __tablename__ = "inventory_alerts"

    id                  : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Item que disparou o alerta
    inventory_item_id   : Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inventory_items.id"),
        nullable=False,
    )

    triggered_at        : Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    # Null = alerta ainda aberto; preenchido = estoque recuperou
    resolved_at         : Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Última vez que uma notificação foi enviada (controle anti-spam)
    last_notified_at    : Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relacionamento
    item = relationship("InventoryItem", back_populates="alerts")

    __table_args__ = (
        # Apenas um alerta aberto por item ao mesmo tempo
        # (resolved_at IS NULL é a condição, mas não dá pra indexar null de forma
        #  elegante sem partial index — criamos no Alembic manualmente)
        Index("ix_alert_item_resolved", "inventory_item_id", "resolved_at"),
    )

    @property
    def aberto(self) -> bool:
        """Alerta ainda não resolvido."""
        return self.resolved_at is None


# ── GiraNotification ──────────────────────────────────────────────────────────

class NotificationTypeEnum(str, enum.Enum):
    MISSING_CONSUMPTION = "MISSING_CONSUMPTION"  # médium sem consumo registrado


class GiraNotification(Base):
    __tablename__ = "gira_notifications"

    id          : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Gira que originou a notificação
    gira_id     : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("giras.id"), nullable=False)

    # Usuário que deve receber a notificação
    user_id     : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)

    type        : Mapped[NotificationTypeEnum] = mapped_column(SAEnum(NotificationTypeEnum), nullable=False)

    created_at  : Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    # Null = não lida; preenchida = lida pelo usuário
    read_at     : Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relacionamentos
    gira    = relationship("Gira")
    usuario = relationship("Usuario", foreign_keys=[user_id])

    __table_args__ = (
        # Previne notificação duplicada do mesmo tipo para o mesmo usuário na mesma gira
        UniqueConstraint(
            "gira_id", "user_id", "type",
            name="uq_gira_notification_gira_user_type",
        ),

        # Notificações não lidas de um usuário (tela de notificações)
        Index("ix_notification_user_read", "user_id", "read_at"),

        # Notificações por gira (admin verificando quem não registrou)
        Index("ix_notification_gira", "gira_id"),
    )

    @property
    def lida(self) -> bool:
        return self.read_at is not None