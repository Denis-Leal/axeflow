"""Public-portal FCM subscriptions and a small durable outbox."""
import logging
from threading import Thread
from uuid import UUID

from firebase_admin import messaging
import firebase_admin
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.firebase import init_firebase
from app.models.public_push_event import PublicPushEvent
from app.models.public_push_subscription import PublicPushSubscription
from app.utils.datetime_utils import utcnow

logger = logging.getLogger(__name__)


def upsert_subscription(db: Session, token: str, terreiro_id: UUID | None) -> None:
    query = db.query(PublicPushSubscription).filter(PublicPushSubscription.token == token)
    query = query.filter(PublicPushSubscription.terreiro_id.is_(None) if terreiro_id is None else PublicPushSubscription.terreiro_id == terreiro_id)
    item = query.first()
    if item:
        item.active = True
    else:
        db.add(PublicPushSubscription(token=token, terreiro_id=terreiro_id))
    db.commit()


def deactivate_subscription(db: Session, token: str, terreiro_id: UUID | None) -> None:
    query = db.query(PublicPushSubscription).filter(PublicPushSubscription.token == token)
    query = query.filter(PublicPushSubscription.terreiro_id.is_(None) if terreiro_id is None else PublicPushSubscription.terreiro_id == terreiro_id)
    query.update({"active": False}, synchronize_session=False)
    db.commit()


def enqueue(db: Session, terreiro_id: UUID, event_key: str, payload: dict) -> bool:
    if db.query(PublicPushEvent.id).filter_by(event_key=event_key).first():
        return False
    db.add(PublicPushEvent(terreiro_id=terreiro_id, event_key=event_key, payload=payload))
    db.commit()
    Thread(target=process_pending, daemon=True).start()
    return True


def _send(token: str, payload: dict) -> None:
    if not firebase_admin._apps:
        init_firebase()
    messaging.send(messaging.Message(token=token, data={k: str(v) for k, v in payload.items()}))


def process_pending() -> None:
    db = SessionLocal()
    try:
        events = db.query(PublicPushEvent).filter(PublicPushEvent.status == "pending").order_by(PublicPushEvent.created_at).limit(50).all()
        for event in events:
            event.attempts += 1
            subscriptions = db.query(PublicPushSubscription).filter(PublicPushSubscription.active.is_(True), PublicPushSubscription.terreiro_id == event.terreiro_id).all()
            failed = False
            for subscription in subscriptions:
                try:
                    _send(subscription.token, event.payload)
                except Exception as exc:
                    code = getattr(exc, "code", "")
                    # Only permanently invalidate tokens Firebase explicitly rejects.
                    if code in {"NOT_FOUND", "UNREGISTERED", "registration-token-not-registered"}:
                        subscription.active = False
                    else:
                        failed = True
                    logger.warning("[PublicPush] FCM delivery failed for event %s: %s", event.id, code or type(exc).__name__)
            if failed:
                event.last_error = "One or more FCM deliveries failed; retry pending."
            else:
                event.status = "sent"
                event.processed_at = utcnow()
                event.last_error = None
            db.commit()
    except Exception:
        db.rollback()
        logger.exception("[PublicPush] outbox processing failed")
    finally:
        db.close()
