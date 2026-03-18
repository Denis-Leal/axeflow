"""
push_service.py — AxeFlow
Subscriptions persistidas no PostgreSQL (não se perdem com restart do servidor).
"""
import json
import logging
from typing import Dict, Any
from pywebpush import webpush, WebPushException
from sqlalchemy import UUID
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.push_subscription import PushSubscription
from app.models.usuario import Usuario

logger = logging.getLogger(__name__)


# ── Helpers de DB ─────────────────────────────────────────────────────────────

def _get_db() -> Session:
    return SessionLocal()


def add_subscription(subscription: Dict[str, Any], user_id: UUID, terreiro_id: UUID) -> bool:
    """Salva ou atualiza uma subscription no banco."""
    endpoint = subscription.get("endpoint")
    keys     = subscription.get("keys", {})
    p256dh   = keys.get("p256dh")
    auth     = keys.get("auth")
    user_id  = user_id
    terreiro_id = terreiro_id

    if not endpoint or not p256dh or not auth:
        logger.warning("[Push] Subscription inválida — campos ausentes")
        return False

    db = _get_db()
    try:
        existing = db.query(PushSubscription).filter_by(endpoint=endpoint).first()
        if existing:
            existing.p256dh = p256dh
            existing.auth   = auth
            existing.user_id = user_id
            existing.terreiro_id = terreiro_id
            db.commit()
            logger.info(f"[Push] Subscription atualizada. Total: {db.query(PushSubscription).count()}")
            return False  # já existia
        else:
            sub = PushSubscription(endpoint=endpoint, p256dh=p256dh, auth=auth, user_id=user_id, terreiro_id=terreiro_id)
            db.add(sub)
            db.commit()
            logger.info(f"[Push] Subscription nova salva. Total: {db.query(PushSubscription).count()}")
            return True
    except Exception as e:
        db.rollback()
        logger.error(f"[Push] Erro ao salvar subscription: {e}")
        return False
    finally:
        db.close()


def remove_subscription(endpoint: str):
    """Remove subscription expirada do banco."""
    db = _get_db()
    try:
        db.query(PushSubscription).filter_by(endpoint=endpoint).delete()
        db.commit()
        logger.info(f"[Push] Subscription removida: {endpoint[:60]}...")
    except Exception as e:
        db.rollback()
        logger.error(f"[Push] Erro ao remover subscription: {e}")
    finally:
        db.close()


def get_subscriptions_count() -> int:
    db = _get_db()
    try:
        return db.query(PushSubscription).count()
    finally:
        db.close()


# ── Envio ─────────────────────────────────────────────────────────────────────

def _send_one(sub: PushSubscription, title: str, body: str, url: str, icon: str) -> bool:
    payload = json.dumps({
        "title": title,
        "body":  body,
        "icon":  icon,
        "badge": "/icons/notification-icon.png",
        "data":  {"url": url},
    })
    subscription_info = {
        "endpoint": sub.endpoint,
        "keys": {
            "p256dh": sub.p256dh,
            "auth":   sub.auth,
        },
    }
    try:
        webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_EMAIL},
        )
        return True
    except WebPushException as ex:
        status = ex.response.status_code if ex.response else None
        logger.warning(f"[Push] Falha ao enviar: {ex} | Status: {status}")
        if status in (404, 410):
            remove_subscription(sub.endpoint)
        return False
    except Exception as ex:
        logger.error(f"[Push] Erro inesperado ao enviar: {ex}")
        return False


def send_push_to_terreiro(
    terreiro_id,
    title: str,
    body: str,
    url: str = "/dashboard",
    icon: str = "/icons/icon-192.png",
) -> Dict[str, int]:

    if not settings.VAPID_PRIVATE_KEY:
        logger.info("[Push] VAPID_PRIVATE_KEY não configurada — push desabilitado.")
        return {"enviados": 0, "falhas": 0, "total": 0}

    db = _get_db()
    try:
        subs = (
            db.query(PushSubscription)
            .filter(PushSubscription.terreiro_id == terreiro_id)
            .all()
        )

        if not subs:
            logger.info(f"[Push] Nenhuma subscription para terreiro {terreiro_id}")
            return {"enviados": 0, "falhas": 0, "total": 0}

        success, failed = 0, 0

        for sub in subs:
            if _send_one(sub, title=title, body=body, url=url, icon=icon):
                success += 1
            else:
                failed += 1

        logger.info(f"[Push] Terreiro {terreiro_id}: {success} enviados, {failed} falhas de {len(subs)}")
        return {"enviados": success, "falhas": failed, "total": len(subs)}

    finally:
        db.close()