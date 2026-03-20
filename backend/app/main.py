"""
main.py — AxeFlow
Ponto de entrada da aplicação FastAPI.

ALTERAÇÃO: adotado padrão lifespan (contextmanager) em substituição
aos eventos on_event("startup") / on_event("shutdown"), que foram
deprecados no FastAPI 0.93+.

O lifespan garante que o scheduler de limpeza de audit_logs seja
iniciado na subida do processo e encerrado graciosamente no shutdown.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.database import Base, engine, get_db
from app.routers import (
    auth_router, gira_router, inscricao_router,
    public_router, membros_router, push_router, audit_router, contato_router, api_key_router
)

# Models importados para o Alembic autogenerate detectar as tabelas
from app.models.terreiro import Terreiro
from app.models.usuario import Usuario
from app.models.gira import Gira
from app.models.consulente import Consulente
from app.models.inscricao import InscricaoGira
from app.models.push_subscription import PushSubscription

from app.services.cleanup_service import start_scheduler, stop_scheduler

import logging

logger = logging.getLogger(__name__)


# ── Lifespan: startup + shutdown em um único lugar ────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gerencia o ciclo de vida do processo.
    Tudo antes do `yield` roda no startup; depois do `yield`, no shutdown.
    """
    # Startup
    start_scheduler()
    logger.info("[App] AxeFlow iniciado.")

    yield  # aplicação rodando

    # Shutdown
    stop_scheduler()
    logger.info("[App] AxeFlow encerrado.")


# ── Limiter global ─────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="AxeFlow",
    description="Sistema de gestão de giras para terreiros de Umbanda e Candomblé",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://axeflow.vercel.app",
        "https://axeflow-*.vercel.app",  # previews de PR
        "http://localhost:3000",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(gira_router.router)
app.include_router(inscricao_router.router)
app.include_router(public_router.router)
app.include_router(membros_router.router)
app.include_router(push_router.router)
app.include_router(audit_router.router)
app.include_router(contato_router.router)
app.include_router(api_key_router.router)

@app.api_route("/", methods=["GET", "HEAD"])
def root():
    return {"status": "ok", "app": "AxeFlow", "version": "1.0.0"}


@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    """Verificação de saúde completa — checa banco e serviços dependentes."""
    from sqlalchemy import text
    from app.core.database import SessionLocal
    from app.core.config import settings

    status = {
        "status": "healthy",
        "database": "ok",
        "email_service":  "configured" if settings.BREVO_API_KEY else "not_configured",
        "push_service":   "configured" if settings.VAPID_PRIVATE_KEY else "not_configured",
        "cleanup_scheduler": "running" if (
            # Importa aqui para evitar import circular
            __import__("app.services.cleanup_service", fromlist=["_scheduler"])._scheduler
            is not None
        ) else "stopped",
    }

    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
    except Exception as e:
        logger.error("[health] Banco indisponível: %s", e)
        status["database"] = "error"
        status["status"]   = "degraded"

    return status


@app.get("/metrics")
def metrics():
    """Métricas simples para monitoramento e debugging."""
    from app.core.database import SessionLocal
    from app.models.terreiro import Terreiro
    from app.models.gira import Gira
    from app.models.inscricao import InscricaoGira
    from app.models.consulente import Consulente
    from app.models.usuario import Usuario

    db = SessionLocal()
    try:
        return {
            "terreiros":         db.query(Terreiro).count(),
            "usuarios":          db.query(Usuario).filter(Usuario.ativo == True).count(),
            "giras_ativas":      db.query(Gira).filter(Gira.deleted_at.is_(None)).count(),
            "giras_total":       db.query(Gira).count(),
            "inscricoes_total":  db.query(InscricaoGira).count(),
            "consulentes_total": db.query(Consulente).count(),
        }
    finally:
        db.close()