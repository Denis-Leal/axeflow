"""
pushService.py — AxeFlow
Gerencia subscriptions e envio de Web Push Notifications via VAPID
"""
import json
import logging
from typing import List, Dict, Any
from pywebpush import webpush, WebPushException
from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Armazenamento em memória ───────────────────────────────────────────────
# Para produção: salvar no banco de dados (tabela push_subscriptions)
_subscriptions: List[Dict[str, Any]] = []


def add_subscription(subscription: Dict[str, Any]) -> bool:
    """
    Salva uma nova subscription (evita duplicatas por endpoint).
    Retorna True se foi adicionada, False se já existia.
    """
    endpoint = subscription.get("endpoint")
    if not endpoint:
        return False

    # Remover subscription antiga do mesmo endpoint se existir
    global _subscriptions
    _subscriptions = [s for s in _subscriptions if s.get("endpoint") != endpoint]
    _subscriptions.append(subscription)

    logger.info(f"[Push] Subscription salva. Total: {len(_subscriptions)}")
    return True


def remove_subscription(endpoint: str):
    """Remove uma subscription pelo endpoint."""
    global _subscriptions
    before = len(_subscriptions)
    _subscriptions = [s for s in _subscriptions if s.get("endpoint") != endpoint]
    logger.info(f"[Push] Subscription removida. {before} → {len(_subscriptions)}")


def get_subscriptions_count() -> int:
    return len(_subscriptions)


def send_push_notification(
    subscription: Dict[str, Any],
    title: str,
    body: str,
    url: str = "/dashboard",
    icon: str = "/icons/icon-192.png",
) -> bool:
    """
    Envia uma push notification para uma subscription específica.
    Retorna True em sucesso, False em falha.
    """
    payload = json.dumps({
        "title": title,
        "body": body,
        "icon": icon,
        "data": {"url": url},
    })

    try:
        webpush(
            subscription_info=subscription,
            data=payload,
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={
                "sub": f"mailto:{settings.VAPID_EMAIL}",
            },
        )
        return True
    except WebPushException as ex:
        status_code = ex.response.status_code if ex.response else None
        logger.warning(f"[Push] Falha ao enviar: {ex} | Status: {status_code}")

        # Se 410 (Gone) ou 404, a subscription expirou — remover
        if status_code in (404, 410):
            remove_subscription(subscription.get("endpoint", ""))
        return False
    except Exception as ex:
        logger.error(f"[Push] Erro inesperado: {ex}")
        return False


def broadcast_push_notification(
    title: str,
    body: str,
    url: str = "/dashboard",
    icon: str = "/icons/icon-192.png",
) -> Dict[str, int]:
    """
    Envia push notification para TODAS as subscriptions salvas.
    Retorna contagem de sucessos e falhas.
    """
    if not _subscriptions:
        logger.info("[Push] Nenhuma subscription registrada.")
        return {"enviados": 0, "falhas": 0, "total": 0}

    success = 0
    failed = 0

    for sub in list(_subscriptions):  # list() para iterar em cópia
        ok = send_push_notification(sub, title=title, body=body, url=url, icon=icon)
        if ok:
            success += 1
        else:
            failed += 1

    logger.info(f"[Push] Broadcast: {success} enviados, {failed} falhas")
    return {"enviados": success, "falhas": failed, "total": len(_subscriptions)}
