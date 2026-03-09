from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import Base, engine
from app.routers import auth_router, gira_router, inscricao_router, public_router, membros_router, push_router, audit_router, audit_router

# Import all models — ordem importa para o create_all registrar tudo
from app.models.terreiro import Terreiro
from app.models.usuario import Usuario
from app.models.gira import Gira
from app.models.consulente import Consulente
from app.models.inscricao import InscricaoGira
from app.models.push_subscription import PushSubscription  # ← garante criação da tabela
from app.models.audit_log import AuditLog                  # ← log de auditoria

import logging
logger = logging.getLogger(__name__)

# Cria todas as tabelas que ainda não existem (seguro — não apaga dados)
try:
    Base.metadata.create_all(bind=engine)
    logger.info("[DB] Tabelas verificadas/criadas com sucesso")
except Exception as e:
    logger.error(f"[DB] Erro ao criar tabelas: {e}")

app = FastAPI(
    title="AxeFlow",
    description="Sistema de gestão de giras para terreiros",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # deve ser False quando allow_origins=["*"]
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

@app.get("/")
def root():
    return {"status": "ok", "app": "AxeFlow"}

@app.get("/health")
def health():
    return {"status": "healthy"}
