import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.utils.datetime_utils import utcnow


class StatusContaReceberEnum(str, enum.Enum):
    pendente = "pendente"
    parcial = "parcial"
    pago = "pago"
    cancelado = "cancelado"


class FormaPagamento(Base):
    __tablename__ = "formas_pagamento"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    terreiro_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("terreiros.id"),
        nullable=False,
    )

    nome: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    ativo: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        nullable=False,
    )

    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )

    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=True,
    )

    terreiro = relationship("Terreiro")
    criador = relationship("Usuario", foreign_keys=[created_by])

    pagamentos = relationship(
        "Pagamento",
        back_populates="forma_pagamento",
    )

    __table_args__ = (
        Index(
            "ix_forma_pagamento_terreiro",
            "terreiro_id",
        ),
        Index(
            "ix_forma_pagamento_terreiro_ativo",
            "terreiro_id",
            "ativo",
        ),
    )


class ContaReceber(Base):
    __tablename__ = "contas_receber"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    terreiro_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("terreiros.id"),
        nullable=False,
    )

    agendamento_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agendamentos.id"),
        nullable=False,
        unique=True,
    )

    consulente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("consulentes.id"),
        nullable=False,
    )

    descricao: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    valor: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    status: Mapped[StatusContaReceberEnum] = mapped_column(
        SAEnum(
            StatusContaReceberEnum,
            name="status_conta_receber_enum",
        ),
        nullable=False,
        default=StatusContaReceberEnum.pendente,
    )

    data_vencimento: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    data_pagamento: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        nullable=False,
    )

    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )

    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=True,
    )

    terreiro = relationship("Terreiro")
    agendamento = relationship("Agendamento")
    consulente = relationship("Consulente")
    criador = relationship("Usuario", foreign_keys=[created_by])

    pagamentos = relationship(
        "Pagamento",
        back_populates="conta_receber",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index(
            "ix_conta_receber_terreiro",
            "terreiro_id",
        ),
        Index(
            "ix_conta_receber_terreiro_status",
            "terreiro_id",
            "status",
        ),
        Index(
            "ix_conta_receber_consulente",
            "consulente_id",
        ),
        Index(
            "ix_conta_receber_agendamento",
            "agendamento_id",
        ),
    )


class Pagamento(Base):
    __tablename__ = "pagamentos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    terreiro_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("terreiros.id"),
        nullable=False,
    )

    conta_receber_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contas_receber.id"),
        nullable=False,
    )

    forma_pagamento_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("formas_pagamento.id"),
        nullable=False,
    )

    valor: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    data_pagamento: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    observacoes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        nullable=False,
    )

    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=True,
    )

    terreiro = relationship("Terreiro")
    conta_receber = relationship(
        "ContaReceber",
        back_populates="pagamentos",
    )
    forma_pagamento = relationship(
        "FormaPagamento",
        back_populates="pagamentos",
    )
    criador = relationship("Usuario", foreign_keys=[created_by])

    recibo = relationship(
        "Recibo",
        back_populates="pagamento",
        uselist=False,
    )

    __table_args__ = (
        Index(
            "ix_pagamento_terreiro",
            "terreiro_id",
        ),
        Index(
            "ix_pagamento_conta_receber",
            "conta_receber_id",
        ),
        Index(
            "ix_pagamento_forma",
            "forma_pagamento_id",
        ),
        Index(
            "ix_pagamento_data",
            "terreiro_id",
            "data_pagamento",
        ),
    )


class Recibo(Base):
    __tablename__ = "recibos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    terreiro_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("terreiros.id"),
        nullable=False,
    )

    pagamento_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pagamentos.id"),
        nullable=False,
        unique=True,
    )

    numero: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    emitido_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        nullable=False,
    )

    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=True,
    )

    terreiro = relationship("Terreiro")
    pagamento = relationship(
        "Pagamento",
        back_populates="recibo",
    )
    criador = relationship("Usuario", foreign_keys=[created_by])

    __table_args__ = (
        Index(
            "ix_recibo_terreiro",
            "terreiro_id",
        ),
        Index(
            "ix_recibo_pagamento",
            "pagamento_id",
        ),
    )