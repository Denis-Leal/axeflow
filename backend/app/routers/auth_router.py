from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.auth_schema import LoginRequest, RegisterRequest, TokenResponse, UsuarioResponse
from app.services import auth_service
from app.models.usuario import Usuario

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    return auth_service.login(db, data)

@router.post("/register", response_model=UsuarioResponse)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    return auth_service.register(db, data)

@router.get("/me", response_model=UsuarioResponse)
def me(user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    return auth_service.get_me(db, user)
