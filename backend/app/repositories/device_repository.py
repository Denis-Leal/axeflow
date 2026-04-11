# app/repositories/device_repository.py

from app.models.device import Device
from uuid import UUID


class DeviceRepository:

    def get_active_by_terreiro(self, db, terreiro_id):
        print("TYPE antes:", type(terreiro_id))
        terreiro_id = UUID(str(terreiro_id))
        devices = (
            db.query(Device)
            .filter(Device.terreiro_id == terreiro_id)
            .filter(Device.active == True)
            .all()
        )
        devices = db.query(Device).all()
        for d in devices:
            print("DB:", d.terreiro_id, type(d.terreiro_id))
        
        print("Found devices:", devices)
        
        return devices