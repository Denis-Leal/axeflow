from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.schemas.gira_schema import GiraCreate, GiraUpdate, GiraResponse
from app.services import gira_service
from app.models.usuario import Usuario
from typing import List

router = APIRouter(prefix="/giras", tags=["giras"])

# Qualquer membro autenticado pode listar e ver giras
@router.get("", response_model=List[GiraResponse])
def list_giras(user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    return gira_service.list_giras(db, user.terreiro_id)

@router.get("/{gira_id}", response_model=GiraResponse)
def get_gira(gira_id: UUID, user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    return gira_service.get_gira(db, gira_id, user.terreiro_id)

# Apenas admin e operador podem criar e editar
@router.post("", response_model=GiraResponse)
def create_gira(
    data: GiraCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "operador"))
):
    return gira_service.create_gira(db, data, user)

@router.put("/{gira_id}", response_model=GiraResponse)
def update_gira(
    gira_id: UUID,
    data: GiraUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "operador"))
):
    return gira_service.update_gira(db, gira_id, data, user.terreiro_id)

# Apenas admin pode deletar
@router.delete("/{gira_id}")
def delete_gira(
    gira_id: UUID,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin"))
):
    return gira_service.delete_gira(db, gira_id, user.terreiro_id)