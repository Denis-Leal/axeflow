# backend/migrations/versions/0012_sync_inscricoes_legado.py
"""
0012_sync_inscricoes_legado.py — AxeFlow

Sincroniza dados de inscricoes_gira → inscricoes_consulente e
inscricoes_gira → inscricoes_membro para registros criados APÓS
a migration 0007_separar_inscricoes.

Esta migration é IDEMPOTENTE via ON CONFLICT DO NOTHING.
Pode ser executada múltiplas vezes sem efeito colateral.

NÃO remove nem altera inscricoes_gira — apenas copia dados ausentes.
NÃO altera código da aplicação — apenas sincroniza o banco.

Estratégia:
  - Copia em lotes de 500 para não segurar lock por muito tempo
  - Usa ON CONFLICT DO NOTHING para segurança em reexecução
  - Valida contagens antes e depois
  - Registra divergências em _migration_baseline

Revision ID: 0012_sync_inscricoes_legado
Revises: 0011_password_reset_tokens
Create Date: 2026-03-21
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
import logging
import warnings

logger = logging.getLogger(__name__)

revision: str = "0012_sync_inscricoes_legado"
down_revision: Union[str, None] = "0011_password_reset_tokens"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _contar_pendentes(bind) -> dict:
    """
    Conta registros de inscricoes_gira que ainda não existem
    nas novas tabelas. Usado para validação antes/depois.
    """
    # Consulentes sem correspondente em inscricoes_consulente
    r_consulentes = bind.execute(text("""
        SELECT COUNT(*) FROM inscricoes_gira ig
        WHERE ig.consulente_id IS NOT NULL
          AND ig.membro_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM inscricoes_consulente ic
            WHERE ic.gira_id = ig.gira_id
              AND ic.consulente_id = ig.consulente_id
          )
    """)).scalar()

    # Membros sem correspondente em inscricoes_membro
    r_membros = bind.execute(text("""
        SELECT COUNT(*) FROM inscricoes_gira ig
        WHERE ig.membro_id IS NOT NULL
          AND ig.consulente_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM inscricoes_membro im
            WHERE im.gira_id = ig.gira_id
              AND im.membro_id = ig.membro_id
          )
    """)).scalar()

    return {
        "consulentes_pendentes": r_consulentes,
        "membros_pendentes": r_membros,
    }


def upgrade() -> None:
    bind = op.get_bind()

    # ── Validação inicial ────────────────────────────────────────────────────
    pendentes_antes = _contar_pendentes(bind)
    logger.info(
        "[0012] Pendentes antes da sync: consulentes=%d membros=%d",
        pendentes_antes["consulentes_pendentes"],
        pendentes_antes["membros_pendentes"],
    )

    # ── Sincronizar inscricoes_consulente em lotes ────────────────────────────
    # ON CONFLICT DO NOTHING: seguro para reexecução
    # O status é copiado como texto — o enum aceita os valores existentes
    # COALESCE em created_at: garante NOT NULL mesmo para registros antigos
    total_consulentes = 0
    while True:
        result = bind.execute(text("""
            INSERT INTO inscricoes_consulente
                (id, gira_id, consulente_id, posicao, status, observacoes,
                 created_at, updated_at)
            SELECT
                ig.id,
                ig.gira_id,
                ig.consulente_id,
                ig.posicao,
                ig.status::text,
                ig.observacoes,
                COALESCE(ig.created_at, NOW()),
                ig.updated_at
            FROM inscricoes_gira ig
            WHERE ig.consulente_id IS NOT NULL
              AND ig.membro_id IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM inscricoes_consulente ic
                WHERE ic.gira_id = ig.gira_id
                  AND ic.consulente_id = ig.consulente_id
              )
            LIMIT 500
            ON CONFLICT (gira_id, consulente_id) DO NOTHING
        """))

        lote = result.rowcount
        total_consulentes += lote

        # Para quando não há mais registros a inserir
        if lote < 500:
            break

    logger.info("[0012] Consulentes sincronizados: %d", total_consulentes)

    # ── Sincronizar inscricoes_membro em lotes ────────────────────────────────
    total_membros = 0
    while True:
        result = bind.execute(text("""
            INSERT INTO inscricoes_membro
                (id, gira_id, membro_id, posicao, status,
                 created_at, updated_at)
            SELECT
                ig.id,
                ig.gira_id,
                ig.membro_id,
                ig.posicao,
                ig.status::text,
                COALESCE(ig.created_at, NOW()),
                ig.updated_at
            FROM inscricoes_gira ig
            WHERE ig.membro_id IS NOT NULL
              AND ig.consulente_id IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM inscricoes_membro im
                WHERE im.gira_id = ig.gira_id
                  AND im.membro_id = ig.membro_id
              )
            LIMIT 500
            ON CONFLICT (gira_id, membro_id) DO NOTHING
        """))

        lote = result.rowcount
        total_membros += lote

        if lote < 500:
            break

    logger.info("[0012] Membros sincronizados: %d", total_membros)

    # ── Validação pós-sync ───────────────────────────────────────────────────
    pendentes_depois = _contar_pendentes(bind)

    if pendentes_depois["consulentes_pendentes"] > 0:
        # Registros com ambos NULL ou ambos preenchidos — foram
        # removidos pela 0006, mas podem ter sido inseridos com bug.
        # Não bloqueia a migration, mas registra o aviso.
        warnings.warn(
            f"[0012] ATENÇÃO: {pendentes_depois['consulentes_pendentes']} "
            "registros de consulentes não puderam ser sincronizados. "
            "Verifique registros com constraint violada em inscricoes_gira.",
            stacklevel=2,
        )

    if pendentes_depois["membros_pendentes"] > 0:
        warnings.warn(
            f"[0012] ATENÇÃO: {pendentes_depois['membros_pendentes']} "
            "registros de membros não puderam ser sincronizados.",
            stacklevel=2,
        )

    # ── Atualizar baseline ───────────────────────────────────────────────────
    # Registra resultado da sync para auditoria futura
    try:
        bind.execute(text("""
            INSERT INTO _migration_baseline (
                capturado_em,
                ig_consulentes, ig_membros,
                ic_total, im_total,
                ig_confirmados, ig_fila,
                ig_compareceu, ig_faltou
            )
            SELECT
                NOW(),
                (SELECT COUNT(*) FROM inscricoes_gira WHERE consulente_id IS NOT NULL),
                (SELECT COUNT(*) FROM inscricoes_gira WHERE membro_id IS NOT NULL),
                (SELECT COUNT(*) FROM inscricoes_consulente),
                (SELECT COUNT(*) FROM inscricoes_membro),
                (SELECT COUNT(*) FROM inscricoes_gira WHERE status = 'confirmado' AND consulente_id IS NOT NULL),
                (SELECT COUNT(*) FROM inscricoes_gira WHERE status = 'lista_espera'),
                (SELECT COUNT(*) FROM inscricoes_gira WHERE status = 'compareceu'),
                (SELECT COUNT(*) FROM inscricoes_gira WHERE status = 'faltou')
        """))
    except Exception:
        # _migration_baseline pode não existir se a Etapa 0 foi pulada.
        # Não bloqueia a migration.
        pass


def downgrade() -> None:
    # NÃO remove dados da nova tabela no downgrade.
    # O downgrade desta migration é SEGURO: apenas apaga dados que foram
    # copiados — a tabela original (inscricoes_gira) continua intacta.
    # Para fazer rollback real, restaure o backup da Etapa 0.
    logger.info(
        "[0012] downgrade chamado — nenhuma ação executada. "
        "Os dados copiados para inscricoes_consulente e inscricoes_membro "
        "são mantidos. Restaure o backup se necessário."
    )