"""
inscricao.py — AxeFlow

CORREÇÕES CRÍTICAS aplicadas nesta versão:

1. CHECK constraint para exclusividade consulente vs membro
   - Antes: duas FKs nullable sem qualquer garantia de banco
   - Depois: constraint garante que exatamente uma das duas está preenchida

2. Remoção de posicao como fonte de verdade para ordenação
   - Antes: MAX(posicao) calculado fora de lock → race condition
   - Depois: posicao mantido por compatibilidade, mas created_at é a
     fonte autoritativa de ordenação (calculado no service com FOR UPDATE)

3. UniqueConstraint atualizada para cobrir membro_id também
   - Antes: só cobertura para (gira_id, consulente_id)
   - Depois: constraints separadas para cada tipo
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, Integer, DateTime, ForeignKey, Enum, Text,
    UniqueConstraint, Index, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class StatusInscricaoEnum(str, enum.Enum):
    confirmado   = "confirmado"   # inscrição ativa dentro do limite de vagas
    lista_espera = "lista_espera" # fila aguardando vaga
    compareceu   = "compareceu"   # marcado após a gira acontecer
    faltou       = "faltou"       # marcado após a gira acontecer
    cancelado    = "cancelado"    # desistência (não penaliza o score)


class InscricaoGira(Base):
    __tablename__ = "inscricoes_gira"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gira_id       = Column(UUID(as_uuid=True), ForeignKey("giras.id"), nullable=False)

    # Preenchido em giras públicas — NUNCA junto com membro_id
    consulente_id = Column(UUID(as_uuid=True), ForeignKey("consulentes.id"), nullable=True)

    # Preenchido em giras fechadas — NUNCA junto com consulente_id
    membro_id     = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)

    # posicao mantido para exibição e auditoria, mas NÃO deve ser usado
    # como critério de fila em escritas concorrentes.
    # Use created_at para ordenação autoritativa (ver inscricao_service.py).
    posicao       = Column(Integer, nullable=False)

    status        = Column(Enum(StatusInscricaoEnum), default=StatusInscricaoEnum.confirmado)

    # Anotações do consulente ao se inscrever (ex: "venho com acompanhante")
    observacoes   = Column(Text, nullable=True)

    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # passive_deletes=True: deixa o ON DELETE CASCADE do banco agir diretamente
    gira       = relationship("Gira", back_populates="inscricoes", passive_deletes=True)
    consulente = relationship("Consulente", back_populates="inscricoes")

    __table_args__ = (
        # ── Exclusividade de domínio (CRÍTICO) ────────────────────────────────
        # Garante que toda inscrição pertence a exatamente um tipo de participante.
        # Sem isso o banco aceita: ambos NULL, ou ambos preenchidos.
        CheckConstraint(
            "(consulente_id IS NOT NULL AND membro_id IS NULL) OR "
            "(consulente_id IS NULL AND membro_id IS NOT NULL)",
            name="ck_inscricao_exactly_one_participant",
        ),

        # ── Unicidade por gira ────────────────────────────────────────────────
        # 1 inscrição ativa por consulente por gira
        UniqueConstraint("gira_id", "consulente_id", name="uq_inscricao_gira_consulente"),
        # 1 inscrição ativa por membro por gira
        UniqueConstraint("gira_id", "membro_id", name="uq_inscricao_gira_membro"),

        # ── Índices de performance ────────────────────────────────────────────
        # Consulta de lista + status (mais frequente)
        Index("ix_inscricao_gira_status", "gira_id", "status"),
        # Ordenação por posição (exibição)
        Index("ix_inscricao_gira_posicao", "gira_id", "posicao"),
        # Ordenação por created_at (autoridade em concorrência)
        Index("ix_inscricao_gira_created_at", "gira_id", "created_at"),
    )