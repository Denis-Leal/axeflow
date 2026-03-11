"""
config.py — AxeFlow
Configurações centralizadas via variáveis de ambiente (pydantic-settings).

IMPORTANTE: Nunca commite valores reais aqui. Use variáveis de ambiente em produção.
No Render: Settings → Environment Variables.
Localmente: arquivo .env (ignorado pelo git).
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # ── Banco ──────────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql://terreiro:terreiro123@postgres:5432/axeflow"

    # ── Auth ───────────────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    # 7 dias de sessão — usuários não ficam deslogados sem motivo
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # ── Web Push (VAPID) ───────────────────────────────────────────────────────
    VAPID_PRIVATE_KEY: str = ""
    VAPID_PUBLIC_KEY: str  = ""
    VAPID_EMAIL: str       = "mailto:admin@axeflow.app"

    # ── Email (Brevo) ──────────────────────────────────────────────────────────
    # Obter em: https://app.brevo.com/settings/keys/api
    BREVO_API_KEY: str = ""
    # Sender verificado no Brevo (Settings → Senders)
    GMAIL_USER: str = ""

    # ── App ────────────────────────────────────────────────────────────────────
    APP_URL: str = "https://axeflow.vercel.app"

    class Config:
        env_file = ".env"  # carrega .env automaticamente em desenvolvimento local

    @property
    def database_url_fixed(self) -> str:
        """Render fornece postgres://, SQLAlchemy exige postgresql://."""
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url


settings = Settings()
