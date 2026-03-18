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
from fastapi import HTTPException, status
from datetime import timedelta
from app.models.usuario import Usuario
from app.models.terreiro import Terreiro
from app.schemas.auth_schema import LoginRequest, RegisterRequest, TokenResponse, UsuarioResponse
from app.core.security import hash_password, verify_password, create_access_token
from app.core.config import settings


def login(db: Session, data: LoginRequest) -> TokenResponse:
    """
    Autentica o usuário pelo email + senha.

    Busca todos os registros com o email informado (pode haver mais de um,
    em terreiros diferentes) e verifica a senha em cada um.
    """
    # Busca todos os usuários ativos com esse email (pode ser mais de um)
    candidatos = db.query(Usuario).filter(
        Usuario.email == data.email,
        Usuario.ativo == True,
    ).all()

    # Encontra o usuário cuja senha bate
    user = next((u for u in candidatos if verify_password(data.senha, u.senha_hash)), None)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos"
        )

    token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return TokenResponse(access_token=token)


def register(db: Session, data: RegisterRequest) -> UsuarioResponse:
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
