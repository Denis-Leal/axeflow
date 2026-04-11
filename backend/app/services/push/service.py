# app/services/push/service.py

import hashlib
import json
from app.services.push.factory import get_provider_for_device
from app.repositories.device_repository import DeviceRepository


class PushService:

    def __init__(self, repo=None):
        self.repo = repo or DeviceRepository()

    def _hash_payload(self, payload):
        return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()

    def send_to_device(self, db, device, payload):

        provider = get_provider_for_device(device)

        try:
            ok = provider.send(device.token, payload)

            if not ok:
                device.active = False

            return ok

        except Exception as e:
            print("PUSH ERROR:", e)
            device.active = False
            return False

    def send_to_many(self, db, devices, payload):

        success, fail = 0, 0

        for d in devices:
            ok = self.send_to_device(db, d, payload)

            if ok:
                success += 1
            else:
                fail += 1

        db.commit()

        return {
            "success": success,
            "fail": fail,
            "total": len(devices)
        }

    def send_to_terreiro(self, db, terreiro_id, payload):

        devices = self.repo.get_active_by_terreiro(db, terreiro_id)
        
        print("DEBUG devices:", len(devices))

        return self.send_to_many(db, devices, payload)