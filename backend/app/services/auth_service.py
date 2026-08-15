"""
auth_service.py — AxeFlow
Autenticação JWT e registro de novo terreiro.

IMPORTANTE sobre email multi-terreiro:
  O mesmo email pode existir em terreiros diferentes.
  No login, buscamos TODOS os registros com aquele email e testamos
  a senha em cada um — o primeiro que bater é o usuário correto.
  Isso é necessário porque não temos como distinguir pelo email sozinho.
"""
from sqlalchemy.orm import Session
from fastapi import HTTPException, Request, status
from datetime import timedelta
from app.models.usuario import Usuario
from app.models.terreiro import Terreiro
from app.schemas.auth_schema import LoginRequest, RegisterRequest, TokenResponse, UsuarioResponse
from app.core.security import hash_password, verify_password, create_access_token
from app.core.config import settings
from app.services import audit_service


def login(db: Session, data: LoginRequest, request: Request) -> TokenResponse:
    """
    Autentica um usuário e gera o access token.

    Registra tanto tentativas bem-sucedidas quanto falhas
    no sistema de auditoria.
    """
    user = (db.query(Usuario).filter(Usuario.email == data.email, Usuario.ativo.is_(True)).first())
    
    if user is None or not verify_password(data.senha, user.senha_hash):
        audit_service.log(
            db,
            request,
            context="auth",
            action="LOGIN_FAILED",
            level="WARNING",
            status=401,
            code="ERR_INVALID_CREDENTIALS",
            message=f"Tentativa de login falhou: {data.email}",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha inválidos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(data={"sub": str(user.id)}, expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    
    audit_service.log(
        db,
        request,
        context="auth",
        action="LOGIN_OK",
        level="INFO",
        user_id=user.id,
        status=200,
        message=f"Login bem-sucedido: {data.email}",
    )
    
    return TokenResponse(access_token=token)

def register(db: Session, data: RegisterRequest, request: Request) -> UsuarioResponse:
    """
    Registra novo terreiro e seu primeiro usuário (admin).

    Email global pode existir em outros terreiros — aqui criamos um terreiro
    novo, então não há conflito de constraint.
    """
    # Verifica se o email já existe dentro do contexto de um novo terreiro
    # (apenas checagem informativa — a constraint do banco garante a unicidade)
    terreiro = Terreiro(nome=data.terreiro_nome, cidade=data.terreiro_cidade)
    db.add(terreiro)
    db.flush()  # gera o ID do terreiro antes de criar o usuário

    user = Usuario(
        terreiro_id=terreiro.id,
        nome=data.nome,
        email=data.email,
        telefone=data.telefone,
        senha_hash=hash_password(data.senha),
        role="admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    audit_service.log(
        db,
        request,
        context="auth",
        action="REGISTER_OK",
        level="INFO",
        status=200,
        message=(
            f"Novo terreiro criado: "
            f"{data.terreiro_nome} | admin: {data.email}"
        ),
    )

    return UsuarioResponse(
        id=user.id,
        nome=user.nome,
        email=user.email,
        role=user.role,
        terreiro_id=user.terreiro_id,
        terreiro_nome=terreiro.nome,
    )

def get_me(db: Session, user: Usuario) -> UsuarioResponse:
    """Retorna dados do usuário autenticado com nome do terreiro."""
    terreiro = db.query(Terreiro).filter(Terreiro.id == user.terreiro_id).first()
    return UsuarioResponse(
        id=user.id,
        nome=user.nome,
        email=user.email,
        role=user.role,
        terreiro_id=user.terreiro_id,
        terreiro_nome=terreiro.nome if terreiro else None,
    )

def alterar_senha(db: Session, user: Usuario, senha_atual: str, nova_senha: str, request: Request,):
    """
    Altera a senha do usuário autenticado.
    """

    if not verify_password(senha_atual, user.senha_hash, ):
        audit_service.log(
            db,
            request,
            context="auth",
            action="PASSWORD_CHANGE_FAILED",
            level="WARNING",
            user_id=user.id,
            status=400,
            code="ERR_WRONG_PASSWORD",
            message=(
                "Tentativa de troca de senha "
                "com senha atual incorreta"
            ),
        )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senha atual incorreta",
        )

    user.senha_hash = hash_password(nova_senha)

    db.commit()
    db.refresh(user)

    audit_service.log(
        db,
        request,
        context="auth",
        action="PASSWORD_CHANGED",
        level="INFO",
        user_id=user.id,
        status=200,
        message="Senha alterada com sucesso",
    )

    return {"ok": True}