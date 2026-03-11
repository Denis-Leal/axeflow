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
    VAPID_PRIVATE_KEY: str = "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgsxwmmzwI9U13ELFPbXSRKq9Kaz4hxIQ9y9scGnAbwgGhRANCAAT1QdBlpJb8VSKNxgLY9qdSA42b9ckyksFXMCFiwnt8MoC20Q0iXzsUgr0HfmVIk5_i7x9Po7Dyn5c5beE4PLnw"
    VAPID_PUBLIC_KEY: str = "BPVB0GWklvxVIo3GAtj2p1IDjZv1yTKSwVcwIWLCe3wygLbRDSJfOxSCvQd-ZUiTn-LvH0-jsPKflzlt4Tg8ufA"
    VAPID_EMAIL: str = "mailto:admin@resend.dev"

    # Email (Resend — resend.com)
    RESEND_API_KEY: str = "re_SqQgBk67_4DdKQmm1qGaNKbXvkeovcSLt"
    EMAIL_FROM: str = "axeflow@resend.dev"
    APP_URL: str = "https://axeflow.vercel.app"
    
    # Gmail SMTP (alternativa ao Resend)
    GMAIL_USER: str = "axeflow777@gmail.com"
    GMAIL_PASS: str = "znso rino gtvh mzgy"  # senha de app — NÃO USE SUA SENHA NORMAL
    APP_URL: str = "https://axeflow.vercel.app"
    
    # Brevo (sendinblue) — 300 emails/dia grátis
    BREVO_API_KEY: str = "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"
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
