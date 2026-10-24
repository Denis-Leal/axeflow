from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_role
from app.models.usuario import Usuario
from app.models.terreiro import Terreiro
from app.schemas.public_portal_schema import PerfilPublicoUpdate, PublicacaoCreate, PublicacaoUpdate, PublicacaoResponse
from app.services import public_portal_service

router = APIRouter(tags=["portal público"])
internal = APIRouter(prefix="/informacoes-publicas", tags=["informações públicas"])
public = APIRouter(prefix="/public/portal", tags=["portal público"])

class PublicPushSubscriptionRequest(BaseModel):
    token: str = Field(min_length=20, max_length=4096)
    terreiro_slug: str = Field(min_length=1, max_length=120)


@public.post("/push/subscriptions", status_code=status.HTTP_201_CREATED)
def subscribe_push(data: PublicPushSubscriptionRequest, db: Session = Depends(get_db)):
    terreiro = db.query(Terreiro).filter_by(slug_publico=data.terreiro_slug, publico_ativo=True).first()
    if not terreiro:
        raise HTTPException(404, "Terreiro público não encontrado")
    from app.services.public_push_service import upsert_subscription
    upsert_subscription(db, data.token, terreiro.id)
    return {"ok": True, "context": "portal", "terreiro_slug": terreiro.slug_publico}


@public.get("/push/subscriptions/status")
def push_status(token: str = Query(min_length=20, max_length=4096), terreiro_slug: str = Query(min_length=1, max_length=120), db: Session = Depends(get_db)):
    terreiro = db.query(Terreiro).filter_by(slug_publico=terreiro_slug, publico_ativo=True).first()
    if not terreiro:
        raise HTTPException(404, "Terreiro público não encontrado")
    from app.models.public_push_subscription import PublicPushSubscription
    active = db.query(PublicPushSubscription.id).filter_by(token=token, terreiro_id=terreiro.id, active=True).first() is not None
    return {"active": active, "context": "portal"}


@public.delete("/push/subscriptions", status_code=status.HTTP_204_NO_CONTENT)
def unsubscribe_push(data: PublicPushSubscriptionRequest, db: Session = Depends(get_db)):
    terreiro = db.query(Terreiro).filter_by(slug_publico=data.terreiro_slug, publico_ativo=True).first()
    if not terreiro:
        raise HTTPException(404, "Terreiro público não encontrado")
    from app.services.public_push_service import deactivate_subscription
    deactivate_subscription(db, data.token, terreiro.id)
    return None

@internal.get("/perfil")
def get_perfil(user: Usuario = Depends(require_role("admin", "operador")), db: Session = Depends(get_db)):
    return public_portal_service.get_perfil(db, user.terreiro_id)

@internal.put("/perfil")
def update_perfil(data: PerfilPublicoUpdate, user: Usuario = Depends(require_role("admin", "operador")), db: Session = Depends(get_db)):
    return public_portal_service.update_perfil(db, user.terreiro_id, data)

@internal.get("/publicacoes", response_model=list[PublicacaoResponse])
def list_publicacoes(user: Usuario = Depends(require_role("admin", "operador")), db: Session = Depends(get_db)):
    return public_portal_service.list_publicacoes(db, user.terreiro_id)

@internal.post("/publicacoes", response_model=PublicacaoResponse, status_code=status.HTTP_201_CREATED)
def create_publicacao(data: PublicacaoCreate, user: Usuario = Depends(require_role("admin", "operador")), db: Session = Depends(get_db)):
    return public_portal_service.create_publicacao(db, user.terreiro_id, data)

@internal.patch("/publicacoes/{publicacao_id}", response_model=PublicacaoResponse)
def update_publicacao(publicacao_id: UUID, data: PublicacaoUpdate, user: Usuario = Depends(require_role("admin", "operador")), db: Session = Depends(get_db)):
    return public_portal_service.update_publicacao(db, user.terreiro_id, publicacao_id, data)

@internal.delete("/publicacoes/{publicacao_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_publicacao(publicacao_id: UUID, user: Usuario = Depends(require_role("admin", "operador")), db: Session = Depends(get_db)):
    public_portal_service.delete_publicacao(db, user.terreiro_id, publicacao_id)

@public.get("/explorar")
def explorar(busca: Optional[str] = Query(None, max_length=100), cidade: Optional[str] = Query(None, max_length=100), latitude: Optional[float] = Query(None, ge=-90, le=90), longitude: Optional[float] = Query(None, ge=-180, le=180), raio_km: float = Query(30, ge=1, le=200), db: Session = Depends(get_db)):
    if (latitude is None) != (longitude is None):
        raise HTTPException(422, "Informe latitude e longitude juntas")
    return public_portal_service.explorar(db, busca, cidade, latitude, longitude, raio_km)

@public.get("/terreiros/{slug}")
def perfil_publico(slug: str, db: Session = Depends(get_db)):
    return public_portal_service.perfil_publico(db, slug)

router.include_router(internal)
router.include_router(public)
