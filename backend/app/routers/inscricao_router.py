from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.inscricao_schema import PresencaUpdate
from app.services import inscricao_service
from app.models.usuario import Usuario
from typing import List

router = APIRouter(tags=["inscricoes"])

@router.get("/giras/{gira_id}/inscricoes")
def list_inscricoes(gira_id: UUID, user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    return inscricao_service.list_inscricoes(db, gira_id, user.terreiro_id)

@router.patch("/inscricao/{inscricao_id}/presenca")
def update_presenca(inscricao_id: UUID, data: PresencaUpdate, user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    return inscricao_service.update_presenca(db, inscricao_id, data, user.terreiro_id)

@router.delete("/inscricao/{inscricao_id}")
def cancelar_inscricao(inscricao_id: UUID, user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    return inscricao_service.cancelar_inscricao(db, inscricao_id, user.terreiro_id)
