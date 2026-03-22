"""
config.py — AxeFlow
Configurações centralizadas via variáveis de ambiente (pydantic-settings).

IMPORTANTE: Nunca commite valores reais aqui. Use variáveis de ambiente em produção.
No Render: Settings → Environment Variables.
Localmente: arquivo .env (ignorado pelo git).

AMBIENTES:
  staging    → banco NeonDB staging, APP_URL do Vercel staging
  production → banco NeonDB produção, APP_URL do Vercel produção
  local      → banco Docker local

O campo ENVIRONMENT controla comportamentos específicos:
  - APP_URL: calculado automaticamente se não for definido explicitamente
  - CORS: main.py lê allowed_origins a partir deste settings
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # ── Ambiente de execução ───────────────────────────────────────────────────
    # Defina no Render: ENVIRONMENT=staging ou ENVIRONMENT=production
    ENVIRONMENT: str = "local"  # "local" | "staging" | "production"

    # ── Banco ──────────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql://terreiro:terreiro123@postgres:5432/axeflow"

    # ── Auth ───────────────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # ── Web Push (VAPID) ───────────────────────────────────────────────────────
    VAPID_PRIVATE_KEY: str = "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgsxwmmzwI9U13ELFPbXSRKq9Kaz4hxIQ9y9scGnAbwgGhRANCAAT1QdBlpJb8VSKNxgLY9qdSA42b9ckyksFXMCFiwnt8MoC20Q0iXzsUgr0HfmVIk5_i7x9Po7Dyn5c5beE4PLnw"
    VAPID_PUBLIC_KEY: str  = "BPVB0GWklvxVIo3GAtj2p1IDjZv1yTKSwVcwIWLCe3wygLbRDSJfOxSCvQd-ZUiTn-LvH0-jsPKflzlt4Tg8ufA"
    VAPID_EMAIL: str       = "mailto:admin@axeflow.app"

    # ── Email (Brevo) ──────────────────────────────────────────────────────────
    BREVO_API_KEY: str = "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"
    GMAIL_USER: str    = "axeflow777@gmail.com"
    DEV_EMAIL: str     = "denis.leal07@gmail.com"

    # ── App URL ────────────────────────────────────────────────────────────────
    # Defina explicitamente no Render para cada ambiente:
    #   staging:    APP_URL=https://axeflow-git-staging-dbl-tech.vercel.app
    #   production: APP_URL=https://axeflow.vercel.app
    #
    # Se não definido, o valor é calculado pelo property app_url_resolved abaixo.
    APP_URL: str = ""

    # ── Retenção de logs de auditoria ──────────────────────────────────────────
    AUDIT_LOG_RETENTION_DAYS: int = 90

    class Config:
        env_file = ".env"

    @property
    def database_url_fixed(self) -> str:
        """Render/Neon fornecem postgres://, SQLAlchemy exige postgresql://."""
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url

    @property
    def app_url_resolved(self) -> str:
        """
        Retorna APP_URL com fallback por ambiente.

        Ordem de prioridade:
          1. APP_URL definida explicitamente via env var (mais seguro)
          2. Fallback baseado em ENVIRONMENT (conveniente para staging)
          3. localhost para ambiente local

        SEMPRE defina APP_URL explicitamente no Render — o fallback é apenas
        para não quebrar o sistema se a variável estiver ausente.
        """
        if self.APP_URL:
            return self.APP_URL.rstrip("/")

        fallbacks = {
            "production": "https://axeflow.vercel.app",
            "staging":    "https://axeflow-git-staging-dbl-tech.vercel.app",
            "local":      "http://localhost:3000",
        }
        return fallbacks.get(self.ENVIRONMENT, "http://localhost:3000")

    @property
    def cors_origins(self) -> list[str]:
        """
        Lista de origens CORS permitidas para o ambiente atual.
        Lida pelo main.py em vez de hardcodar as origens lá.

        Staging inclui o domínio de staging do Vercel explicitamente.
        Produção inclui apenas os domínios de produção + previews do Vercel.
        Ambos incluem localhost para desenvolvimento local.
        """
        base = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]

        if self.ENVIRONMENT == "production":
            return base + [
                "https://axeflow.vercel.app",
                "https://axeflow-*.vercel.app",  # previews de PR
            ]

        if self.ENVIRONMENT == "staging":
            return base + [
                "https://axeflow-git-staging-dbl-tech.vercel.app",
                "https://axeflow-*.vercel.app",  # outros previews
            ]

        # local: aceita qualquer localhost
        return base


settings = Settings()