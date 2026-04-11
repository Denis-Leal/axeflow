# app/services/push/fcm_provider.py

from firebase_admin import messaging
from app.services.push.base import PushProvider
from app.core.firebase import init_firebase
import firebase_admin

class FCMProvider(PushProvider):

    def send(self, token: str, payload: dict) -> bool:
        try:
            if not firebase_admin._apps:
                init_firebase()
            message = messaging.Message(
                token=token,
                data={
                    "title": payload.get("title"),
                    "body": payload.get("body"),
                    "url": payload.get("url"),
                    "terreiro_id": payload.get("terreiro_id"),
                }
            )

            messaging.send(message)
            return True

        except Exception as e:
            print(f"[FCM] erro: {e}")
            return False