"""
auth_router.py — AxeFlow
Endpoints de autenticação com auditoria completa.

Eventos registrados:
  LOGIN_OK       — login bem-sucedido (INFO)
  LOGIN_FAILED   — credenciais inválidas (WARNING)
  REGISTER_OK    — novo terreiro criado (INFO)
  PASSWORD_CHANGED — senha alterada (INFO)
"""
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, hash_password, verify_password
from app.schemas.auth_schema import LoginRequest, RegisterRequest, TokenResponse, UsuarioResponse
from app.services import auth_service
from app.services import audit_service
from app.models.usuario import Usuario
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])


class AlterarSenhaRequest(BaseModel):
    senha_atual: str
    nova_senha: str


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Autentica o usuário e registra o resultado da tentativa no audit log.
    """
    return auth_service.login(db=db, data=data, request=request)


@router.post("/register", response_model=UsuarioResponse)
def register(data: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    """
    Cria um novo terreiro e seu usuário administrador.
    """
    return auth_service.register(db=db, data=data, request=request)


@router.get("/me", response_model=UsuarioResponse)
def me(user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    return auth_service.get_me(db=db, user=user)


@router.patch("/senha")
def alterar_senha(
    data: AlterarSenhaRequest,
    request: Request,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Altera a senha do usuário autenticado.
    """
    return auth_service.alterar_senha(
        db=db,
        user=user,
        senha_atual=data.senha_atual,
        nova_senha=data.nova_senha,
        request=request,
    )