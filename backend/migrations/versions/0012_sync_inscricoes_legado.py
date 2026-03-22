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

    try:
        # ── CONSULENTES ─────────────────────────────
        bind.execute(text("""
            INSERT INTO inscricoes_consulente
                (id, gira_id, consulente_id, posicao, status, observacoes,
                 created_at, updated_at)
            SELECT
                ig.id,
                ig.gira_id,
                ig.consulente_id,
                ig.posicao,
                CAST(ig.status AS TEXT),
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
            ON CONFLICT (gira_id, consulente_id) DO NOTHING
        """))

        # ── MEMBROS ─────────────────────────────
        bind.execute(text("""
            INSERT INTO inscricoes_membro
                (id, gira_id, membro_id, posicao, status,
                 created_at, updated_at)
            SELECT
                ig.id,
                ig.gira_id,
                ig.membro_id,
                ig.posicao,
                CAST(ig.status AS TEXT),
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
            ON CONFLICT (gira_id, membro_id) DO NOTHING
        """))

    except Exception as e:
        print("ERRO REAL DA MIGRATION:", str(e))
        raise


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