"""
push_service.py — AxeFlow
Gerenciamento de push notifications via Web Push (VAPID).

Subscriptions são persistidas no PostgreSQL com terreiro_id —
garantindo isolamento multi-tenant: cada terreiro só recebe
notificações das suas próprias giras e ações.

CORREÇÃO MULTI-TENANT (payload):
    O payload de cada push inclui `terreiro_id` dentro de `data`.
    O frontend (sw.js + _app.js) usa esse campo para validar se a
    notificação pertence ao terreiro do usuário logado antes de navegar.

CORREÇÃO LOGOUT:
    remove_subscription agora aceita terreiro_id opcional para garantir
    que apenas o dono da subscription possa removê-la via logout.
    A remoção por expiração (404/410) continua sem validação de terreiro.
"""
import json
import logging
from typing import Dict, Any, Optional
from uuid import UUID
from pywebpush import webpush, WebPushException
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.push_subscription import PushSubscription
from firebase_admin import messaging
from app.services.push.factory import get_push_provider
from app.services.push.service import PushService
from app.models.device import Device
from app.repositories.device_repository import DeviceRepository


provider = get_push_provider()
def get_push_service():
    return PushService(DeviceRepository())

logger = logging.getLogger(__name__)


# ── Helpers de DB ──────────────────────────────────────────────────────────────

def _get_db() -> Session:
    """Abre uma sessão de banco de dados."""
    return SessionLocal()


# ── Gerenciamento de subscriptions ────────────────────────────────────────────

def add_subscription(
    subscription: Dict[str, Any],
    user_id: UUID,
    terreiro_id: UUID,
) -> bool:
    """
    Salva ou atualiza uma push subscription no banco.

    Associa a subscription ao usuário e ao seu terreiro.
    Isso garante que o broadcast por terreiro funcione corretamente.

    Retorna True se era nova, False se já existia (e foi atualizada).
    """
    endpoint = subscription.get("endpoint")
    keys     = subscription.get("keys", {})
    p256dh   = keys.get("p256dh")
    auth     = keys.get("auth")

    if not endpoint or not p256dh or not auth:
        logger.warning("[Push] Subscription inválida — campos ausentes")
        return False

    db = _get_db()
    try:
        existing = db.query(PushSubscription).filter_by(endpoint=endpoint).first()
        if existing:
            # Atualiza chaves e re-associa ao usuário/terreiro atual.
            # NOTA: um mesmo dispositivo físico pode ter sido usado em
            # terreiros diferentes — o terreiro_id é sempre o do login atual.
            existing.p256dh      = p256dh
            existing.auth        = auth
            existing.user_id     = user_id
            existing.terreiro_id = terreiro_id
            db.commit()
            logger.info("[Push] Subscription atualizada para terreiro %s", terreiro_id)
            return False
        else:
            sub = PushSubscription(
                endpoint=endpoint,
                p256dh=p256dh,
                auth=auth,
                user_id=user_id,
                terreiro_id=terreiro_id,
            )
            db.add(sub)
            db.commit()
            total = db.query(PushSubscription).count()
            logger.info("[Push] Nova subscription salva para terreiro %s. Total: %d", terreiro_id, total)
            return True
    except Exception as e:
        db.rollback()
        logger.error("[Push] Erro ao salvar subscription: %s", e)
        return False
    finally:
        db.close()


def remove_subscription(endpoint: str, terreiro_id: Optional[UUID] = None) -> None:
    """
    Remove uma push subscription do banco.

    Quando chamada via logout (terreiro_id informado):
        Valida que a subscription pertence ao terreiro do usuário logado
        antes de remover — evita que um terreiro remova subscription alheia.

    Quando chamada por expiração (terreiro_id=None):
        Remove sem validação de terreiro (o endpoint simplesmente não existe
        mais nos servidores do Google/Mozilla).
    """
    db = _get_db()
    try:
        query = db.query(PushSubscription).filter_by(endpoint=endpoint)

        # Filtro adicional de segurança quando chamado via logout
        if terreiro_id is not None:
            query = query.filter(PushSubscription.terreiro_id == terreiro_id)

        deleted = query.delete()
        db.commit()

        if deleted:
            logger.info("[Push] Subscription removida: %s...", endpoint[:60])
        else:
            logger.info("[Push] Nenhuma subscription encontrada para remover: %s...", endpoint[:60])
    except Exception as e:
        db.rollback()
        logger.error("[Push] Erro ao remover subscription: %s", e)
    finally:
        db.close()


def get_subscriptions_count(terreiro_id: Optional[UUID] = None) -> int:
    """
    Retorna contagem de subscriptions.
    Se terreiro_id for informado, filtra por terreiro.
    """
    db = _get_db()
    try:
        query = db.query(PushSubscription)
        if terreiro_id:
            query = query.filter(PushSubscription.terreiro_id == terreiro_id)
        return query.count()
    finally:
        db.close()


# ── Envio ──────────────────────────────────────────────────────────────────────
# region Envio de push notifications para as subscriptions do terreiro (obsoleto)
# def _send_one(
#     sub: PushSubscription,
#     title: str,
#     body: str,
#     url: str,
#     icon: str,
#     terreiro_id: UUID,
# ) -> bool:
#     """
#     Envia push para uma subscription específica.

#     O payload inclui `terreiro_id` dentro de `data` para que o frontend
#     possa validar se a notificação pertence ao terreiro do usuário logado.
#     Isso é a segunda camada de segurança multi-tenant no lado cliente.
#     """
#     payload = json.dumps({
#         "title": title,
#         "body":  body,
#         "icon":  icon,
#         "badge": "/icons/notification-icon.png",
#         "data": {
#             # URL da página de destino (ex: /giras/{id})
#             "url": url,
#             # terreiro_id permite ao frontend validar o contexto antes de navegar
#             "terreiro_id": str(terreiro_id),
#         },
#     })
#     subscription_info = {
#         "endpoint": sub.endpoint,
#         "keys": {
#             "p256dh": sub.p256dh,
#             "auth":   sub.auth,
#         },
#     }
#     try:
#         webpush(
#             subscription_info=subscription_info,
#             data=payload,
#             vapid_private_key=settings.VAPID_PRIVATE_KEY,
#             vapid_claims={"sub": settings.VAPID_EMAIL},
#         )
#         return True
#     except WebPushException as ex:
#         status = ex.response.status_code if ex.response else None
#         logger.warning("[Push] Falha ao enviar para %s: %s | Status: %s",
#                        sub.endpoint[:40], ex, status)
#         # 404/410 = subscription expirada ou cancelada — remove sem validar terreiro
#         if status in (404, 410):
#             remove_subscription(sub.endpoint)
#         return False
#     except Exception as ex:
#         logger.error("[Push] Erro inesperado ao enviar: %s", ex)
#         return False
# endregion


def send_push_to_terreiro(db, terreiro_id, payload):
    return get_push_service().send_to_terreiro(db, terreiro_id, payload)

def send_push_to_user(db, user_id, payload):
    return get_push_service().send_to_user(db, user_id, payload)