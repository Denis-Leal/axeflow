"""
main.py — AxeFlow
Ponto de entrada da aplicação FastAPI.

Configurações:
  - CORS restrito às origens do Vercel e localhost
  - Migrations gerenciadas pelo Alembic (roda antes do servidor no Procfile)
  - Rate limiting global via slowapi
  - /health com verificação de serviços externos
  - /metrics com contadores do banco para monitoramento
"""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.core.database import Base, engine, get_db
from app.routers import (
    auth_router, gira_router, inscricao_router,
    public_router, membros_router, push_router, audit_router,
)

# Importar models para o Alembic autogerar migrations
from app.models.terreiro import Terreiro
from app.models.usuario import Usuario
from app.models.gira import Gira
from app.models.consulente import Consulente
from app.models.inscricao import InscricaoGira
from app.models.push_subscription import PushSubscription

import logging
logger = logging.getLogger(__name__)

# ── Limiter global ─────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="AxeFlow",
    description="Sistema de gestão de giras para terreiros de Umbanda e Candomblé",
    version="1.0.0",
)

# Registrar handler de rate limit (retorna 429 com mensagem amigável)
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


@app.api_route("/", methods=["GET", "HEAD"])
def root():
    return {"status": "ok", "app": "AxeFlow", "version": "1.0.0"}


@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    """
    Verificação de saúde completa — checa banco e serviços dependentes.
    Útil para monitoramento no Render e health checks de CI.
    """
    from sqlalchemy import text
    from app.core.database import SessionLocal
    from app.core.config import settings

    status = {
        "status": "healthy",
        "database": "ok",
        "email_service": "configured" if settings.BREVO_API_KEY else "not_configured",
        "push_service": "configured" if settings.VAPID_PRIVATE_KEY else "not_configured",
    }

    # Testar conectividade com o banco
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
    except Exception as e:
        logger.error("[health] Banco indisponível: %s", e)
        status["database"] = "error"
        status["status"] = "degraded"

    return status


@app.get("/metrics")
def metrics():
    """
    Métricas simples do sistema para monitoramento e debugging.
    Não expõe dados sensíveis — apenas contadores agregados.
    """
    from app.core.database import SessionLocal
    from app.models.terreiro import Terreiro
    from app.models.gira import Gira
    from app.models.inscricao import InscricaoGira
    from app.models.consulente import Consulente
    from app.models.usuario import Usuario

    db = SessionLocal()
    try:
        return {
            "terreiros":          db.query(Terreiro).count(),
            "usuarios":           db.query(Usuario).filter(Usuario.ativo == True).count(),
            "giras_ativas":       db.query(Gira).filter(Gira.deleted_at.is_(None)).count(),
            "giras_total":        db.query(Gira).count(),  # inclui soft deleted
            "inscricoes_total":   db.query(InscricaoGira).count(),
            "consulentes_total":  db.query(Consulente).count(),
        }
    finally:
        db.close()
