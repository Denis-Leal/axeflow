# app/services/push/factory.py
from app.services.push.fcm_provider import FCMProvider

def get_push_provider():
    return FCMProvider()

def get_provider_for_device(device):
    if device.provider == "fcm":
        return FCMProvider()

    raise Exception(f"Provider não suportado: {device.provider}")