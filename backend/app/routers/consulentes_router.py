from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user, require_role, hash_password
from app.models.usuario import Usuario
from app.schemas import consulente_schema
from app.services import consulentes_service

router = APIRouter(prefix="/consulentes", tags=["consulentes"])

# ── Listagem ──────────────────────────────────────────────────────────────────

@router.get("/lista")
def list_consulentes(
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return consulentes_service.listar_consulentes(db=db, terreiro_id=user.terreiro_id)

# ── Busca ─────────────────────────────────────────────────────────────────────

@router.get("/search")
def search_consulentes(
    q: str,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return consulentes_service.buscar_consulentes(
        db=db,
        terreiro_id=user.terreiro_id,
        query=q,
    )
    
# ── Ranking ───────────────────────────────────────────────────────────────────

@router.get("/ranking")
def ranking_consulentes(
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return consulentes_service.ranking_consulentes(
        db=db,
        terreiro_id=user.terreiro_id,
    )
    
# ── Atualização cadastral ─────────────────────────────────────────────────────

@router.put("/{consulente_id}")
def atualizar_consulente(
    consulente_id: UUID,
    dados: consulente_schema.ConsulentePutSchema,
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
    return consulentes_service.atualizar_consulente(
        db=db,
        consulente_id=consulente_id,
        terreiro_id=user.terreiro_id,
        dados=dados,
    )
    
# ── Notas ─────────────────────────────────────────────────────────────────────

@router.patch("/{consulente_id}/notas")
def update_notas_consulente(
    consulente_id: UUID,
    data: consulente_schema.NotasConsulenteUpdate,
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
    return consulentes_service.atualizar_notas_consulentes(db=db, consulente_id=consulente_id, terreiro_id=user.terreiro_id, user_id=user.id, data=data)

# ── Exclusão ──────────────────────────────────────────────────────────────────

@router.delete("/{consulente_id}", status_code=204)
def deletar_consulente(
    consulente_id: UUID,
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
    consulentes_service.deletar_consulente(
        db=db,
        consulente_id=consulente_id,
        terreiro_id=user.terreiro_id,
    )


# ── Perfil ────────────────────────────────────────────────────────────────────

@router.get("/{consulente_id}/perfil")
def perfil_consulente(
    consulente_id: UUID,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return consulentes_service.obter_perfil_consulente(
        db=db,
        consulente_id=consulente_id,
        terreiro_id=user.terreiro_id,
    )