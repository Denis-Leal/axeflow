"""
push_router.py — AxeFlow
Endpoints para gerenciar push subscriptions e disparar notificações.
"""
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from app.core.security import get_current_user
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.services.push_service import (
    add_subscription,
    remove_subscription,
    send_push_to_terreiro,
    get_subscriptions_count,
)
from app.models.device import Device
from app.core.database import get_db
from app.workers.push_worker import run_push_async

router = APIRouter(prefix="/push", tags=["push"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class PushSubscribeRequest(BaseModel):
    subscription: Dict[str, Any]  # objeto PushSubscription serializado do browser


class PushUnsubscribeRequest(BaseModel):
    endpoint: str  # endpoint da subscription a ser removida


class PushTestRequest(BaseModel):
    title: Optional[str] = "Nova gira disponível"
    body:  Optional[str] = "A lista para a gira foi aberta."
    url:   Optional[str] = "/giras"


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/subscribe")
def subscribe(data: PushSubscribeRequest, user=Depends(get_current_user)):
    """
    Recebe e salva uma push subscription vinda do browser.
    Associa ao usuário logado e ao seu terreiro — isolamento multi-tenant.
    """
    sub = data.subscription

    if not sub.get("endpoint"):
        raise HTTPException(status_code=400, detail="Subscription inválida: endpoint ausente")

    added = add_subscription(
        subscription=sub,
        user_id=user.id,
        terreiro_id=user.terreiro_id,
    )
    total = get_subscriptions_count(terreiro_id=user.terreiro_id)

    return {
        "ok": True,
        "nova": added,
        "total_subscriptions": total,
        "message": "Subscription registrada" if added else "Subscription atualizada",
    }

@router.post("/test")
def send_test_push(data: PushTestRequest = PushTestRequest(), user=Depends(get_current_user)):
    payload = {
        "title": data.title,
        "body": data.body,
        "data": {
            "url": data.url,
            "terreiro_id": str(user.terreiro_id)
        }
    }

    run_push_async(user.terreiro_id, payload)

    return {"ok": True, "message": "Push enviado async"}


@router.get("/status")
def push_status(user=Depends(get_current_user)):
    """Retorna quantas subscriptions estão ativas para o terreiro do usuário."""
    return {
        "subscriptions_ativas": get_subscriptions_count(terreiro_id=user.terreiro_id),
    }
    
@router.post("/devices/register")
def register_device(data: dict, user=Depends(get_current_user), db=Depends(get_db)):

    token = data.get("token")
    print("Registering device with token:", token)
    if not token:
        raise HTTPException(400, "Token ausente")

    device = db.query(Device).filter(Device.token == token).first()

    if device:
        device.user_id = user.id
        device.terreiro_id = user.terreiro_id
        device.last_seen = datetime.utcnow()
        device.active = True
    else:
        device = Device(
            user_id=user.id,
            terreiro_id=user.terreiro_id,
            token=token,
            platform=data.get("platform"),
            provider="fcm"
        )
        db.add(device)

    db.commit()

    return {"ok": True}

@router.delete("/devices/unregister")
def unregister_device(data: dict, user=Depends(get_current_user), db=Depends(get_db)):

    token = data.get("token")

    if not token:
        raise HTTPException(400, "Token ausente")

    device = (
        db.query(Device)
        .filter(Device.token == token)
        .filter(Device.terreiro_id == user.terreiro_id)
        .first()
    )

    if device:
        device.active = False  # melhor que deletar
        db.commit()

    return {"ok": True}