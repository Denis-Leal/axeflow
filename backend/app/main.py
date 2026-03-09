from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import Base, engine
from app.routers import auth_router, gira_router, inscricao_router, public_router, membros_router, push_router

# Import all models to register them
from app.models import terreiro, usuario, gira, consulente, inscricao

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Terreiro SaaS",
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

@app.get("/")
def root():
    return {"status": "ok", "app": "Terreiro SaaS"}

@app.get("/health")
def health():
    return {"status": "healthy"}
