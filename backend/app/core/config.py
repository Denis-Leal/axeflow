from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://terreiro:terreiro123@postgres:5432/terreiro_saas"
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 horas

    # VAPID keys para Web Push Notifications
    # Geradas com: python -c "from py_vapid import Vapid; v=Vapid(); v.generate_keys(); print(v.private_key_urlsafe, v.public_key_urlsafe)"
    VAPID_PRIVATE_KEY: str = "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgsxwmmzwI9U13ELFPbXSRKq9Kaz4hxIQ9y9scGnAbwgGhRANCAAT1QdBlpJb8VSKNxgLY9qdSA42b9ckyksFXMCFiwnt8MoC20Q0iXzsUgr0HfmVIk5_i7x9Po7Dyn5c5beE4PLnw"
    VAPID_PUBLIC_KEY: str = "BPVB0GWklvxVIo3GAtj2p1IDjZv1yTKSwVcwIWLCe3wygLbRDSJfOxSCvQd-ZUiTn-LvH0-jsPKflzlt4Tg8ufA"
    VAPID_EMAIL: str = "mailto:admin@terreiro.app"

    class Config:
        env_file = ".env"

settings = Settings()
