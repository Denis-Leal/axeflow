# app/services/push/fcm_provider.py

from firebase_admin import messaging
from app.services.push.base import PushProvider

class FCMProvider(PushProvider):

    def send(self, token: str, payload: dict) -> bool:
        try:
            message = messaging.Message(
                token=token,
                notification=messaging.Notification(
                    title=payload.get("title"),
                    body=payload.get("body"),
                ),
                data=payload.get("data", {}),
            )

            messaging.send(message)
            return True

        except Exception as e:
            print(f"[FCM] erro: {e}")
            return False