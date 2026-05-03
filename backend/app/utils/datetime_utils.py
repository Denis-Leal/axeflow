# app/utils/datetime_utils.py
from datetime import datetime, timezone


def utcnow() -> datetime:
    """Substituto para datetime.utcnow() — retorna aware UTC."""
    return datetime.now(timezone.utc)


def ensure_utc(dt: datetime | None) -> datetime | None:
    """
    Normaliza datetime lido do banco (pode ser naive se coluna sem timezone=True).
    Assume que valores naive já estão em UTC — NÃO converte, só adiciona tzinfo.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt