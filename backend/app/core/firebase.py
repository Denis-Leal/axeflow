# app/core/firebase.py

import json

import firebase_admin
from firebase_admin import credentials

from app.core.config import settings


def init_firebase():
    if firebase_admin._apps:
        return

    if not settings.FIREBASE_CREDENTIALS:
        raise ValueError("FIREBASE_CREDENTIALS não está configurada.")

    try:
        cred_dict = json.loads(settings.FIREBASE_CREDENTIALS)
    except json.JSONDecodeError as exc:
        raise ValueError("FIREBASE_CREDENTIALS contém um JSON inválido.") from exc

    cred_dict["private_key"] = cred_dict["private_key"].replace("\\n","\n",)

    cred = credentials.Certificate(cred_dict)

    firebase_admin.initialize_app(cred)