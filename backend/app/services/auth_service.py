"""Autenticação multi-tenant, cadastro e alteração autenticada de senha."""
from datetime import timedelta
import secrets

from fastapi import HTTPException, Request, status
from sqlalchemy import func, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.password_policy import require_new_password
from app.core.security import create_access_token, hash_password, verify_password
from app.models.terreiro import Terreiro
from app.models.usuario import Usuario
from app.schemas.auth_schema import (
    LoginRequest, RegisterRequest, TerreiroLoginOption, TerreiroSelectionResponse,
    TokenResponse, UsuarioResponse,
)
from app.services import audit_service
from app.services.password_token_service import invalidate_user_tokens


# O caminho sem conta também executa bcrypt para reduzir diferenças de tempo.
DUMMY_PASSWORD_HASH = hash_password(secrets.token_urlsafe(32))


def _password_matches(password: str, password_hash: str) -> bool:
    try:
        return verify_password(password, password_hash)
    except (ValueError, TypeError):
        return False


def login(db: Session, data: LoginRequest, request: Request) -> TokenResponse | TerreiroSelectionResponse:
    email = str(data.email).strip().lower()
    candidates = db.query(Usuario).filter(
        func.lower(func.trim(Usuario.email)) == email,
        Usuario.ativo.is_(True),
    )
    if data.terreiro_id is not None:
        candidates = candidates.filter(Usuario.terreiro_id == data.terreiro_id)
    users = candidates.all()
    if not users:
        _password_matches(data.senha, DUMMY_PASSWORD_HASH)
    matches = [user for user in users if _password_matches(data.senha, user.senha_hash)]
    if not matches:
        audit_service.log(
            db, request, context="auth", action="LOGIN_FAILED", level="WARNING",
            status=401, code="ERR_INVALID_CREDENTIALS", message="Credenciais inválidas",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha inválidos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if len(matches) > 1:
        tenant_ids = {user.terreiro_id for user in matches}
        if data.terreiro_id is not None or len(tenant_ids) != len(matches):
            raise HTTPException(status_code=401, detail="Email ou senha inválidos")
        tenants = db.query(Terreiro).filter(Terreiro.id.in_(tenant_ids)).order_by(Terreiro.nome).all()
        return TerreiroSelectionResponse(terreiros=[
            TerreiroLoginOption(id=tenant.id, nome=tenant.nome) for tenant in tenants
        ])

    user = matches[0]
    token = create_access_token(
        data={"sub": str(user.id), "ver": user.token_version},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    audit_service.log(
        db, request, context="auth", action="LOGIN_OK", level="INFO",
        user_id=user.id, status=200, message="Login bem-sucedido",
    )
    return TokenResponse(access_token=token)


def register(db: Session, data: RegisterRequest, request: Request) -> UsuarioResponse:
    require_new_password(data.senha)
    terreiro = Terreiro(nome=data.terreiro_nome, cidade=data.terreiro_cidade)
    db.add(terreiro)
    db.flush()
    user = Usuario(
        terreiro_id=terreiro.id,
        nome=data.nome,
        email=str(data.email).strip().lower(),
        telefone=data.telefone,
        senha_hash=hash_password(data.senha),
        role="admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    audit_service.log(
        db, request, context="auth", action="REGISTER_OK", level="INFO",
        user_id=user.id, status=200, message="Novo terreiro e administrador cadastrados",
    )
    return UsuarioResponse(
        id=user.id, nome=user.nome, email=user.email, role=user.role,
        terreiro_id=user.terreiro_id, terreiro_nome=terreiro.nome,
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


def alterar_senha(db: Session, user: Usuario, senha_atual: str, nova_senha: str, request: Request):
    require_new_password(nova_senha)
    expected_version = user.token_version
    locked_user = db.query(Usuario).filter(
        Usuario.id == user.id, Usuario.ativo.is_(True),
    ).populate_existing().with_for_update().first()
    if locked_user is None or locked_user.token_version != expected_version:
        raise HTTPException(status_code=401, detail="Sessão inválida. Faça login novamente.")
    if not _password_matches(senha_atual, locked_user.senha_hash):
        audit_service.log(
            db, request, context="auth", action="PASSWORD_CHANGE_FAILED", level="WARNING",
            user_id=user.id, status=400, code="ERR_WRONG_PASSWORD", message="Senha atual incorreta",
        )
        raise HTTPException(status_code=400, detail="Senha atual incorreta")

    db.execute(update(Usuario).where(Usuario.id == locked_user.id).values(
        senha_hash=hash_password(nova_senha),
        token_version=Usuario.token_version + 1,
    ), execution_options={"synchronize_session": False})
    invalidate_user_tokens(db, locked_user.id)
    db.commit()
    db.refresh(locked_user)
    audit_service.log(
        db, request, context="auth", action="PASSWORD_CHANGED", level="INFO",
        user_id=locked_user.id, status=200, message="Senha alterada e sessões revogadas",
    )
    return {"ok": True}
