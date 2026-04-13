# app/repositories/device_repository.py

from sqlalchemy import text

from app.models.device import Device
from uuid import UUID


class DeviceRepository:

    def get_active_by_terreiro(self, db, terreiro_id):
        terreiro_id = UUID(str(terreiro_id))
        devices = (
            db.query(Device)
            .filter(Device.terreiro_id == terreiro_id)
            .filter(Device.active == True)
            .all()
        )
        return devices
    
    def get_active_by_user(self, db, user_id):
        user_id = UUID(str(user_id))
        devices = (
            db.query(Device)
            .filter(Device.user_id == user_id)
            .filter(Device.active == True)
            .all()
        )
        return devices