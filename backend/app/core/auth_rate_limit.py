"""Limites locais por IP e identidade opaca para os fluxos de autenticação."""
import hashlib
import hmac
import math
import time

from fastapi import HTTPException, Request
from limits import parse
from limits.storage import MemoryStorage
from limits.strategies import FixedWindowRateLimiter

from app.core.config import settings

# Limites de taxa por ação e escopo (IP ou conta) — valores restritivos para evitar abuso.
RATE_LIMITS = {
    "login": {"ip": ("20/minute", "100/hour"), "account": ("10/minute", "50/hour")},
    "register": {"ip": ("10/hour",), "account": ("3/hour",)},
    "password-change": {"ip": ("20/hour",), "account": ("10/hour",)},
    "reset-search": {"ip": ("20/hour",), "account": ("10/hour",)},
    "reset-request": {"ip": ("10/hour",), "account": ("5/hour",)},
    "password-token": {"ip": ("20/hour",), "account": ("10/hour",)},
    "member-invite": {"ip": ("60/hour",), "account": ("5/hour",)},
    "member-invite-actor": {"account": ("30/hour",)},
}

# Cada processo tem seus próprios contadores, sem depender de infraestrutura remota.
storage = MemoryStorage()
strategy = FixedWindowRateLimiter(storage)


def _check(action: str, scope: str, identifier: str) -> None:
    opaque_id = hmac.new(
        settings.SECRET_KEY.encode("utf-8"), identifier.encode("utf-8"), hashlib.sha256,
    ).hexdigest()
    for quota in RATE_LIMITS[action].get(scope, ()):
        limit = parse(quota)
        if not strategy.hit(limit, action, scope, opaque_id):
            window = strategy.get_window_stats(limit, action, scope, opaque_id)
            retry_after = max(1, math.ceil(window.reset_time - time.time()))
            raise HTTPException(
                status_code=429,
                detail="Muitas tentativas. Aguarde antes de tentar novamente.",
                headers={"Retry-After": str(retry_after)},
            )


def check_ip(request: Request, action: str) -> None:
    # O cliente já deve ter sido resolvido pelo proxy confiável do servidor ASGI.
    peer = request.client.host if request.client else "unknown"
    _check(action, "ip", peer)


def check_account(action: str, identifier: str) -> None:
    _check(action, "account", identifier.strip().lower())
