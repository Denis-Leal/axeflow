from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from datetime import timedelta
from app.models.usuario import Usuario
from app.models.terreiro import Terreiro
from app.schemas.auth_schema import LoginRequest, RegisterRequest, TokenResponse, UsuarioResponse
from app.core.security import hash_password, verify_password, create_access_token
from app.core.config import settings

def login(db: Session, data: LoginRequest) -> TokenResponse:
    user = db.query(Usuario).filter(Usuario.email == data.email, Usuario.ativo == True).first()
    if not user or not verify_password(data.senha, user.senha_hash):
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
    existing = db.query(Usuario).filter(Usuario.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")

    terreiro = Terreiro(nome=data.terreiro_nome, cidade=data.terreiro_cidade)
    db.add(terreiro)
    db.flush()

    user = Usuario(
        terreiro_id=terreiro.id,
        nome=data.nome,
        email=data.email,
        telefone=data.telefone,
        senha_hash=hash_password(data.senha),
        role="admin"
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
        terreiro_nome=terreiro.nome
    )

def get_me(db: Session, user: Usuario) -> UsuarioResponse:
    terreiro = db.query(Terreiro).filter(Terreiro.id == user.terreiro_id).first()
    return UsuarioResponse(
        id=user.id,
        nome=user.nome,
        email=user.email,
        role=user.role,
        terreiro_id=user.terreiro_id,
        terreiro_nome=terreiro.nome if terreiro else None
    )
