from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):

    # -------------------------
    # DATABASE
    # -------------------------
    DATABASE_URL: str

    database_schema: str = "axeflow"


    # -------------------------
    # AUTH / JWT
    # -------------------------
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24


    # -------------------------
    # PUSH NOTIFICATIONS (VAPID)
    # -------------------------
    VAPID_PRIVATE_KEY: str
    VAPID_PUBLIC_KEY: str
    VAPID_EMAIL: str


    # -------------------------
    # EMAIL (RESEND)
    # -------------------------
    RESEND_API_KEY: Optional[str] = None
    EMAIL_FROM: Optional[str] = None


    # -------------------------
    # EMAIL (BREVO)
    # -------------------------
    BREVO_API_KEY: Optional[str] = None


    # -------------------------
    # SMTP FALLBACK
    # -------------------------
    GMAIL_USER: Optional[str] = None
    GMAIL_PASS: Optional[str] = None


    # -------------------------
    # APP
    # -------------------------
    APP_URL: str


    class Config:
        env_file = ".env"
        case_sensitive = True


    # -------------------------
    # FIX DATABASE URL
    # -------------------------
    @property
    def database_url_fixed(self) -> str:
        url = self.DATABASE_URL

        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)

        return url


settings = Settings()