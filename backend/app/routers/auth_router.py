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
    try:
        result = auth_service.login(db, data)

        # Busca o usuário para obter o user_id no log
        from app.models.usuario import Usuario as U
        user = db.query(U).filter(U.email == data.email, U.ativo == True).first()

        audit_service.log(
            db, request,
            context = "auth",
            action  = "LOGIN_OK",
            level   = "INFO",
            user_id = user.id if user else None,
            status  = 200,
            message = f"Login bem-sucedido: {data.email}",
        )
        return result

    except HTTPException as exc:
        audit_service.log(
            db, request,
            context = "auth",
            action  = "LOGIN_FAILED",
            level   = "WARNING",
            status  = exc.status_code,
            code    = "ERR_INVALID_CREDENTIALS",
            message = f"Tentativa de login falhou: {data.email}",
        )
        raise


@router.post("/register", response_model=UsuarioResponse)
def register(data: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    result = auth_service.register(db, data)

    audit_service.log(
        db, request,
        context = "auth",
        action  = "REGISTER_OK",
        level   = "INFO",
        status  = 200,
        message = f"Novo terreiro criado: {data.terreiro_nome} | admin: {data.email}",
    )
    return result


@router.get("/me", response_model=UsuarioResponse)
def me(user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    return auth_service.get_me(db, user)


@router.patch("/senha")
def alterar_senha(
    data: AlterarSenhaRequest,
    request: Request,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Altera a senha do usuário autenticado."""
    if not verify_password(data.senha_atual, user.senha_hash):
        audit_service.log(
            db, request,
            context = "auth",
            action  = "PASSWORD_CHANGE_FAILED",
            level   = "WARNING",
            user_id = user.id,
            status  = 400,
            code    = "ERR_WRONG_PASSWORD",
            message = "Tentativa de troca de senha com senha atual incorreta",
        )
        raise HTTPException(status_code=400, detail="Senha atual incorreta")

    user.senha_hash = hash_password(data.nova_senha)
    db.commit()

    audit_service.log(
        db, request,
        context = "auth",
        action  = "PASSWORD_CHANGED",
        level   = "INFO",
        user_id = user.id,
        status  = 200,
        message = "Senha alterada com sucesso",
    )
    return {"ok": True}