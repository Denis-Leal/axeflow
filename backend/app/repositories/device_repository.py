# app/repositories/device_repository.py

from app.models.device import Device


class DeviceRepository:

    def get_active_by_terreiro(self, db, terreiro_id):
        return (
            db.query(Device)
            .filter(Device.terreiro_id == terreiro_id)
            .filter(Device.active == True)
            .all()
        )