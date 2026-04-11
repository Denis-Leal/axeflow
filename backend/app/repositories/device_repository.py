# app/repositories/device_repository.py

from app.models.device import Device


class DeviceRepository:

    def get_active_by_terreiro(self, db, terreiro_id):
        print("Fetching active devices for terreiro:", terreiro_id)  # Debug log
        print("DeviceID:", Device.id)  # Debug log to check if Device model is correct
        print("Device terreiro_id:", Device.terreiro_id)  # Debug log to check if terreiro_id field is correct
        return (
            db.query(Device)
            .filter(Device.terreiro_id == terreiro_id)
            .filter(Device.active == True)
            .all()
        )