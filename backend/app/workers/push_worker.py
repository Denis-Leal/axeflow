# app/workers/push_worker.py

from threading import Thread
from app.services.push.service import PushService
from app.repositories.device_repository import DeviceRepository
from app.core.database import SessionLocal


def run_push_async(terreiro_id, payload):

    def task():
        db = SessionLocal()

        try:
            repo = DeviceRepository()
            service = PushService(repo)

            service.send_to_terreiro(db, terreiro_id, payload)

        finally:
            db.close()

    Thread(target=task).start()