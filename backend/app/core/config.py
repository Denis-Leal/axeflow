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
    BREVO_API_KEY: str = ""
    GMAIL_USER: str    = ""

    # ── App ────────────────────────────────────────────────────────────────────
    APP_URL: str = "https://axeflow.vercel.app"

    # ── Retenção de logs de auditoria ──────────────────────────────────────────
    # Registros mais antigos que este valor (em dias) são removidos diariamente.
    # Sobrescreva com AUDIT_LOG_RETENTION_DAYS=180 no .env para aumentar o período.
    AUDIT_LOG_RETENTION_DAYS: int = 90

    class Config:
        env_file = ".env"

    @property
    def database_url_fixed(self) -> str:
        """Render fornece postgres://, SQLAlchemy exige postgresql://."""
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url


settings = Settings()