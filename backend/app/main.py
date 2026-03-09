from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import Base, engine
from app.routers import auth_router, gira_router, inscricao_router, public_router, membros_router, push_router, audit_router

# Registrar todos os models para o create_all criar as tabelas
from app.models.terreiro import Terreiro
from app.models.usuario import Usuario
from app.models.gira import Gira
from app.models.consulente import Consulente
from app.models.inscricao import InscricaoGira
from app.models.push_subscription import PushSubscription

import logging
logger = logging.getLogger(__name__)
# Migrations são gerenciadas pelo Alembic (rodado no Procfile antes do servidor subir)
# Não usar create_all aqui — evita conflitos com o schema controlado pelo Alembic


app = FastAPI(
    title="AxeFlow",
    description="Sistema de gestão de giras para terreiros",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    return {"status": "ok", "app": "AxeFlow"}

@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    return {"status": "healthy"}
