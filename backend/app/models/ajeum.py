"""
ajeum.py — AxeFlow
Models do sistema Ajeum: lista de itens que membros se comprometem a levar para a gira.

Estrutura:
  Ajeum        — cabeçalho (1:1 com Gira)
  AjeumItem    — cada item da lista (com soft delete)
  AjeumSelecao — seleção de um membro por um item (com optimistic locking)

Padrão do projeto seguido:
  - UUID como PK gerado no Python (não server-side)
  - relationships com back_populates explícito
  - enums como str enum (compatível com VARCHAR(50) no banco)
  - constraints refletidas no __table_args__ para que o Alembic autogenerate
    detecte divergências entre model e banco

IMPORTANTE — optimistic locking:
  A coluna `version` em AjeumSelecao é incrementada a cada UPDATE de status
  pelo serviço. O serviço valida que a version atual bate com a version lida
  antes de confirmar. Se não bater: 409. Ver ajeum_service.py.
"""
import uuid
import enum
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, DateTime, Text, Boolean,
    ForeignKey, CheckConstraint, UniqueConstraint, Index, event,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


# ── Enum de status da seleção ──────────────────────────────────────────────────

class StatusSelecaoEnum(str, enum.Enum):
    """
    Estados possíveis de uma seleção de item.

    Transições válidas (aplicadas pelo serviço, não pelo banco):
      selecionado  → confirmado    (admin confirma entrega após a gira)
      selecionado  → nao_entregue  (admin registra que membro não trouxe)
      selecionado  → cancelado     (membro desmarca antes da gira)
      cancelado    → selecionado   (membro re-seleciona, se ainda houver vaga)
      confirmado   → (nenhuma)     terminal
      nao_entregue → (nenhuma)     terminal

    O valor 'cancelado' difere de 'nao_entregue':
      cancelado    = membro avisou que não vai levar (intenção comunicada)
      nao_entregue = membro comprometeu-se e não cumpriu (impacta reputação)
    """
    selecionado  = "selecionado"
    confirmado   = "confirmado"
    nao_entregue = "nao_entregue"
    cancelado    = "cancelado"


# ── Conjunto de transições válidas ────────────────────────────────────────────
# Usado pelo serviço para validar antes de qualquer UPDATE.
# Centralizado aqui para evitar duplicação de lógica entre service e router.
TRANSICOES_VALIDAS: dict[StatusSelecaoEnum, set[StatusSelecaoEnum]] = {
    StatusSelecaoEnum.selecionado:  {
        StatusSelecaoEnum.confirmado,
        StatusSelecaoEnum.nao_entregue,
        StatusSelecaoEnum.cancelado,
    },
    StatusSelecaoEnum.cancelado: {
        StatusSelecaoEnum.selecionado,  # re-seleção permitida
    },
    StatusSelecaoEnum.confirmado:    set(),  # terminal
    StatusSelecaoEnum.nao_entregue:  set(),  # terminal
}


# ── Model: Ajeum ──────────────────────────────────────────────────────────────

class Ajeum(Base):
    """
    Cabeçalho da lista de itens de uma gira.
    Relação 1:1 com Gira, garantida pelo UNIQUE(gira_id) no banco.
    """
    __tablename__ = "ajeum"

    # ── Identidade ─────────────────────────────────────────────────────────────
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── Multi-tenant ───────────────────────────────────────────────────────────
    # Presente diretamente para isolamento sem JOIN obrigatório.
    # Preenchido pelo serviço a partir do usuário autenticado — nunca do payload.
    terreiro_id = Column(
        UUID(as_uuid=True),
        ForeignKey("terreiros.id"),
        nullable=False,
    )

    # ── Referências ────────────────────────────────────────────────────────────
    gira_id = Column(
        UUID(as_uuid=True),
        ForeignKey("giras.id"),
        nullable=False,
    )
    criado_por = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=False,
    )

    # ── Dados ──────────────────────────────────────────────────────────────────
    observacoes = Column(Text, nullable=True)

    # ── Timestamps ─────────────────────────────────────────────────────────────
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── Relationships ──────────────────────────────────────────────────────────
    # lazy="dynamic" não usado: preferimos queries explícitas no serviço
    terreiro    = relationship("Terreiro")
    gira        = relationship("Gira", back_populates="ajeum")
    criador     = relationship("Usuario", foreign_keys=[criado_por])
    itens       = relationship(
        "AjeumItem",
        back_populates="ajeum",
        # Não usar cascade="all, delete-orphan": deletes são explícitos (soft delete)
    )

    # ── Constraints e índices ──────────────────────────────────────────────────
    __table_args__ = (
        UniqueConstraint("gira_id", name="uq_ajeum_gira"),
        Index("ix_ajeum_terreiro_created", "terreiro_id", "created_at"),
    )


# ── Model: AjeumItem ──────────────────────────────────────────────────────────

class AjeumItem(Base):
    """
    Cada item da lista do Ajeum (ex: "Bacon", "Refrigerante 2L").

    Soft delete: deleted_at preenchido pelo serviço quando o admin remove o item.
    Queries de listagem filtram WHERE deleted_at IS NULL.
    Queries de histórico/reputação NÃO filtram deleted_at.

    O limite é validado no banco via CHECK constraint (>= 1).
    Reduzir limite abaixo do total de seleções ativas é rejeitado pelo serviço,
    não pelo banco — o banco não conhece o contexto atual de seleções.
    """
    __tablename__ = "ajeum_item"

    # ── Identidade ─────────────────────────────────────────────────────────────
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── Multi-tenant ───────────────────────────────────────────────────────────
    terreiro_id = Column(
        UUID(as_uuid=True),
        ForeignKey("terreiros.id"),
        nullable=False,
    )

    # ── Referência ao Ajeum pai ────────────────────────────────────────────────
    ajeum_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ajeum.id"),
        nullable=False,
    )

    # ── Dados ──────────────────────────────────────────────────────────────────
    descricao = Column(String(255), nullable=False)
    limite    = Column(Integer,     nullable=False)

    # ── Soft delete ────────────────────────────────────────────────────────────
    # NULL = ativo  |  preenchido = deletado
    deleted_at = Column(DateTime, nullable=True)

    # ── Timestamps ─────────────────────────────────────────────────────────────
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── Relationships ──────────────────────────────────────────────────────────
    ajeum    = relationship("Ajeum",   back_populates="itens")
    terreiro = relationship("Terreiro")
    selecoes = relationship(
        "AjeumSelecao",
        back_populates="item",
        # Sem cascade: seleções são históricas
    )

    # ── Constraints e índices ──────────────────────────────────────────────────
    __table_args__ = (
        CheckConstraint("limite >= 1", name="ck_ajeum_item_limite_positivo"),
        Index("ix_ajeum_item_ajeum",       "ajeum_id"),
        Index("ix_ajeum_item_ajeum_ativo",  "ajeum_id", "deleted_at"),
        Index("ix_ajeum_item_terreiro",     "terreiro_id"),
    )

    @property
    def ativo(self) -> bool:
        """Conveniência: True se o item não foi deletado."""
        return self.deleted_at is None


# ── Model: AjeumSelecao ───────────────────────────────────────────────────────

class AjeumSelecao(Base):
    """
    Representa a escolha de um membro por um item específico do Ajeum.

    Optimistic locking via `version`:
      - O serviço lê a seleção e captura a version atual
      - O UPDATE de status usa WHERE id = :id AND version = :version_lida
      - Se rowcount == 0: outro processo modificou → retorna 409
      - Se rowcount == 1: sucesso → incrementa version

    UNIQUE(item_id, membro_id):
      - Última barreira contra duplicata independente do código
      - Um membro com seleção cancelada deve fazer re-seleção via UPDATE,
        não novo INSERT — o serviço (ajeum_service.py) trata este caso
      - Dois requests simultâneos do mesmo membro: um INSERT vence,
        o outro recebe IntegrityError → serviço trata como idempotente

    Registros NUNCA são deletados fisicamente:
      - 'cancelado' = membro avisou que não vai levar
      - 'nao_entregue' = membro falhou sem avisar (impacta reputação)
      - Ambos são preservados para histórico e reputação futura
    """
    __tablename__ = "ajeum_selecao"

    # ── Identidade ─────────────────────────────────────────────────────────────
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── Multi-tenant ───────────────────────────────────────────────────────────
    terreiro_id = Column(
        UUID(as_uuid=True),
        ForeignKey("terreiros.id"),
        nullable=False,
    )

    # ── Referências ────────────────────────────────────────────────────────────
    item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ajeum_item.id"),  # sem CASCADE
        nullable=False,
    )
    membro_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=False,
    )

    # ── Estado ─────────────────────────────────────────────────────────────────
    status = Column(
        String(50),
        nullable=False,
        default=StatusSelecaoEnum.selecionado,
    )

    # ── Optimistic locking ─────────────────────────────────────────────────────
    # Começa em 1. Incrementado a cada UPDATE de status.
    # O serviço usa: UPDATE ... WHERE id = :id AND version = :version_lida
    version = Column(Integer, nullable=False, default=1)

    # ── Rastreabilidade da confirmação ─────────────────────────────────────────
    # Preenchidos apenas quando status → confirmado ou nao_entregue
    confirmado_por = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=True,
    )
    confirmado_em = Column(DateTime, nullable=True)

    # ── Timestamps ─────────────────────────────────────────────────────────────
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── Relationships ──────────────────────────────────────────────────────────
    item      = relationship("AjeumItem",  back_populates="selecoes")
    membro    = relationship("Usuario",    foreign_keys=[membro_id])
    confirmador = relationship("Usuario",  foreign_keys=[confirmado_por])
    terreiro  = relationship("Terreiro")

    # ── Constraints e índices ──────────────────────────────────────────────────
    __table_args__ = (
        # Barreira final contra seleção duplicada
        UniqueConstraint("item_id", "membro_id", name="uq_ajeum_selecao_item_membro"),

        # CHECK: status restrito a valores conhecidos
        CheckConstraint(
            "status IN ('selecionado', 'confirmado', 'nao_entregue', 'cancelado')",
            name="ck_ajeum_selecao_status",
        ),

        # CHECK: confirmação consistente — quem confirmou deve estar registrado
        CheckConstraint(
            "(status NOT IN ('confirmado', 'nao_entregue')) OR "
            "(confirmado_por IS NOT NULL AND confirmado_em IS NOT NULL)",
            name="ck_ajeum_selecao_confirmacao_consistente",
        ),

        # Índice para o FOR UPDATE na seleção (query mais crítica do sistema)
        Index("ix_ajeum_selecao_item_status",       "item_id",     "status"),
        # Índice para reputação futura por membro no terreiro
        Index("ix_ajeum_selecao_terreiro_membro",   "terreiro_id", "membro_id", "status"),
        # Índice para auditoria por item em ordem cronológica
        Index("ix_ajeum_selecao_item_created",      "item_id",     "created_at"),
        # Índice para tela de perfil do membro
        Index("ix_ajeum_selecao_membro",            "membro_id"),
    )