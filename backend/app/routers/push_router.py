"""
push_router.py — AxeFlow
Endpoints para gerenciar push subscriptions e disparar notificações.
"""
from fastapi import APIRouter, HTTPException, Depends
from app.core.security import get_current_user
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.services.push_service import (
    add_subscription,
    send_push_to_terreiro,
    get_subscriptions_count,
)

router = APIRouter(prefix="/push", tags=["push"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class PushSubscribeRequest(BaseModel):
    subscription: Dict[str, Any]  # objeto PushSubscription serializado do browser


class PushTestRequest(BaseModel):
    title: Optional[str] = "Nova gira disponível"
    body:  Optional[str] = "A lista para a gira foi aberta."
    url:   Optional[str] = "/dashboard"


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
    """
    Dispara notificação de teste apenas para o terreiro do usuário logado.
    Útil para validar que o push está funcionando.
    """
    total = get_subscriptions_count(terreiro_id=user.terreiro_id)
    if total == 0:
        raise HTTPException(
            status_code=404,
            detail="Nenhuma subscription registrada para este terreiro. Ative as notificações no app.",
        )

    result = send_push_to_terreiro(
        terreiro_id=user.terreiro_id,
        title=data.title,
        body=data.body,
        url=data.url,
    )

    return {
        "ok": True,
        "resultado": result,
        "message": f"{result['enviados']} notificação(ões) enviada(s)",
    }


@router.get("/status")
def push_status(user=Depends(get_current_user)):
    """Retorna quantas subscriptions estão ativas para o terreiro do usuário."""
    return {
        "subscriptions_ativas": get_subscriptions_count(terreiro_id=user.terreiro_id),
    }
