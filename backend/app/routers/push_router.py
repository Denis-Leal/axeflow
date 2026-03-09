"""
push_router.py — AxeFlow
Endpoints para gerenciar push subscriptions e disparar notificações
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.services.push_service import (
    add_subscription,
    broadcast_push_notification,
    get_subscriptions_count,
)

router = APIRouter(prefix="/push", tags=["push"])


# ── Schemas ────────────────────────────────────────────────────────────────

class PushSubscribeRequest(BaseModel):
    subscription: Dict[str, Any]  # objeto PushSubscription serializado do browser


class PushTestRequest(BaseModel):
    title: Optional[str] = "Nova gira disponível"
    body: Optional[str] = "A lista para a gira foi aberta."
    url: Optional[str] = "/dashboard"


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.post("/subscribe")
def subscribe(data: PushSubscribeRequest):
    """
    Recebe e salva uma push subscription vinda do browser.
    Chamado automaticamente após o usuário conceder permissão.
    """
    sub = data.subscription

    if not sub.get("endpoint"):
        raise HTTPException(status_code=400, detail="Subscription inválida: endpoint ausente")

    added = add_subscription(sub)
    total = get_subscriptions_count()

    return {
        "ok": True,
        "nova": added,
        "total_subscriptions": total,
        "message": "Subscription registrada com sucesso" if added else "Subscription já registrada (atualizada)",
    }


@router.post("/test")
def send_test_push(data: PushTestRequest = PushTestRequest()):
    """
    Dispara uma notificação de teste para todos os inscritos.
    Útil para testar via curl ou interface admin.
    """
    total = get_subscriptions_count()
    if total == 0:
        raise HTTPException(
            status_code=404,
            detail="Nenhuma subscription registrada. Ative as notificações no app primeiro.",
        )

    result = broadcast_push_notification(
        title=data.title,
        body=data.body,
        url=data.url,
    )

    return {
        "ok": True,
        "resultado": result,
        "message": f"{result['enviados']} notificação(ões) enviada(s) com sucesso",
    }


@router.get("/status")
def push_status():
    """Retorna quantas subscriptions estão registradas no momento."""
    return {
        "subscriptions_ativas": get_subscriptions_count(),
    }
