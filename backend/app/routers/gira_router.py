"""
gira_router.py — AxeFlow
Endpoints de giras com auditoria completa.

Eventos registrados:
  GIRA_CREATED  — nova gira criada (INFO)
  GIRA_UPDATED  — gira editada (INFO)
  GIRA_DELETED  — gira removida (WARNING)
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.schemas.gira_schema import GiraCreate, GiraUpdate, GiraResponse, GiraUpdateResponse
from app.services import gira_service
from app.services import audit_service
from app.models.usuario import Usuario

router = APIRouter(prefix="/giras", tags=["giras"])


@router.get("", response_model=List[GiraResponse])
def list_giras(
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return gira_service.list_giras(db, user.terreiro_id)


@router.get("/{gira_id}", response_model=GiraResponse)
def get_gira(
    gira_id: UUID,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return gira_service.get_gira(db, gira_id, user.terreiro_id)


@router.post("", response_model=GiraResponse)
def create_gira(
    data: GiraCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "operador")),
):
    result = gira_service.create_gira(db, data, user)

    audit_service.log(
        db, request,
        context = "gira",
        action  = "GIRA_CREATED",
        level   = "INFO",
        user_id = user.id,
        status  = 200,
        message = f"Gira criada: {data.titulo} ({data.acesso})",
    )
    return result


@router.patch("/{gira_id}", response_model=GiraUpdateResponse)
def update_gira(
    gira_id: UUID,
    data: GiraUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "operador")),
):
    result = gira_service.update_gira(db, gira_id, data, user.terreiro_id)

    audit_service.log(
        db, request,
        context = "gira",
        action  = "GIRA_UPDATED",
        level   = "INFO",
        user_id = user.id,
        status  = 200,
        message = f"Gira editada: {gira_id}",
    )
    return result


@router.delete("/{gira_id}")
def delete_gira(
    gira_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    result = gira_service.delete_gira(db, gira_id, user.terreiro_id)

    audit_service.log(
        db, request,
        context = "gira",
        action  = "GIRA_DELETED",
        level   = "WARNING",
        user_id = user.id,
        status  = 200,
        message = f"Gira removida (soft delete): {gira_id}",
    )
    return result