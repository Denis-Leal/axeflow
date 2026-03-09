from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID
from app.core.database import get_db
from app.core.security import get_current_user, hash_password
from app.models.usuario import Usuario
from app.schemas.auth_schema import UsuarioResponse

router = APIRouter(prefix="/membros", tags=["membros"])

class MembroCreate(BaseModel):
    nome: str
    email: EmailStr
    senha: str
    telefone: Optional[str] = None
    role: str = "membro"

@router.get("")
def list_membros(user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    membros = db.query(Usuario).filter(Usuario.terreiro_id == user.terreiro_id).all()
    return [
        {
            "id": str(m.id),
            "nome": m.nome,
            "email": m.email,
            "telefone": m.telefone,
            "role": m.role,
            "ativo": m.ativo,
        }
        for m in membros
    ]

@router.post("")
def create_membro(data: MembroCreate, user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in ["admin", "operador"]:
        raise HTTPException(status_code=403, detail="Sem permissão")
    existing = db.query(Usuario).filter(Usuario.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    novo = Usuario(
        terreiro_id=user.terreiro_id,
        nome=data.nome,
        email=data.email,
        telefone=data.telefone,
        senha_hash=hash_password(data.senha),
        role=data.role,
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return {"id": str(novo.id), "nome": novo.nome, "email": novo.email, "role": novo.role}
