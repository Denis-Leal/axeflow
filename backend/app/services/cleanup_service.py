"""
cleanup_service.py — AxeFlow
Job de limpeza periódica de dados de auditoria.

Estratégia: APScheduler rodando dentro do processo FastAPI.
Não requer Celery, Redis ou cron externo — adequado para o plano
free do Render onde não há workers separados.

Retenção padrão: 90 dias (configurável via env AUDIT_LOG_RETENTION_DAYS).
O job roda uma vez por dia às 03:00 UTC para evitar carga em horário de pico.
"""
import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import text

from app.core.database import SessionLocal
from app.core.config import settings

logger = logging.getLogger(__name__)

# Instância global do scheduler — iniciada uma única vez no lifespan do app
_scheduler: BackgroundScheduler | None = None


def _purge_audit_logs() -> None:
    """
    Remove registros de audit_log mais antigos que AUDIT_LOG_RETENTION_DAYS.

    Usa DELETE com LIMIT para evitar lock longo em tabelas grandes.
    Repete em lotes de 5000 até não restar mais nada a remover.
    """
    retention_days = settings.AUDIT_LOG_RETENTION_DAYS
    cutoff = datetime.utcnow() - timedelta(days=retention_days)
    total_removidos = 0

    db = SessionLocal()
    try:
        # Lotes pequenos evitam lock prolongado e permitem que outras
        # queries continuem durante a limpeza
        while True:
            result = db.execute(
                text("""
                    DELETE FROM audit_logs
                    WHERE id IN (
                        SELECT id FROM audit_logs
                        WHERE created_at < :cutoff
                        LIMIT 5000
                    )
                """),
                {"cutoff": cutoff},
            )
            db.commit()

            removidos_neste_lote = result.rowcount
            total_removidos += removidos_neste_lote

            # Para quando não há mais registros a remover
            if removidos_neste_lote < 5000:
                break

        if total_removidos > 0:
            logger.info(
                "[Cleanup] audit_logs: %d registro(s) removido(s) (retenção: %d dias, corte: %s)",
                total_removidos,
                retention_days,
                cutoff.date().isoformat(),
            )
        else:
            logger.debug("[Cleanup] audit_logs: nenhum registro a remover.")

    except Exception as exc:
        db.rollback()
        logger.error("[Cleanup] Erro ao purgar audit_logs: %s", exc)
    finally:
        db.close()


def start_scheduler() -> None:
    """
    Inicia o scheduler em background.
    Chamado uma única vez no lifespan do FastAPI (main.py).
    """
    global _scheduler

    if _scheduler is not None:
        logger.warning("[Cleanup] Scheduler já iniciado — ignorando chamada duplicada.")
        return

    _scheduler = BackgroundScheduler(timezone="UTC")

    # Executa diariamente às 03:00 UTC — horário de baixo tráfego
    _scheduler.add_job(
        func=_purge_audit_logs,
        trigger=CronTrigger(hour=3, minute=0),
        id="purge_audit_logs",
        name="Limpeza periódica de audit_logs",
        replace_existing=True,
        # misfire_grace_time: se o processo estava dormindo no horário agendado
        # (comum no plano free do Render), executa assim que acordar
        misfire_grace_time=3600,
    )

    _scheduler.start()
    logger.info(
        "[Cleanup] Scheduler iniciado — audit_logs purgados diariamente às 03:00 UTC "
        "(retenção: %d dias)",
        settings.AUDIT_LOG_RETENTION_DAYS,
    )


def stop_scheduler() -> None:
    """
    Para o scheduler graciosamente.
    Chamado no shutdown do FastAPI (main.py lifespan).
    """
    global _scheduler

    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("[Cleanup] Scheduler encerrado.")
    _scheduler = None