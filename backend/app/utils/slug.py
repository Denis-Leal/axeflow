"""
slug.py — AxeFlow
Geração de slugs únicos e amigáveis para URLs públicas de giras.
"""
import re
import uuid
import unicodedata
from datetime import date


def slugify(text: str) -> str:
    """Converte texto livre em slug URL-safe (minúsculo, sem acentos, hífens)."""
    # Normaliza acentos → ASCII
    text = unicodedata.normalize('NFKD', text)
    text = text.encode('ascii', 'ignore').decode('ascii')
    text = text.lower()
    # Remove caracteres especiais, mantém letras, números e hífens
    text = re.sub(r'[^\w\s-]', '', text)
    # Substitui espaços e underscores por hífen
    text = re.sub(r'[\s_]+', '-', text)
    return text.strip('-')


def generate_gira_slug(titulo: str, data: date) -> str:
    """
    Gera slug público para gira com hash curto para evitar colisões.

    Formato: {titulo-slugificado}-{YYYY-MM-DD}-{hash4}
    Exemplo: gira-de-exu-2026-03-15-a3f7

    O hash de 4 caracteres evita colisão entre giras com mesmo título e data.
    """
    titulo_slug = slugify(titulo)
    data_str = data.strftime('%Y-%m-%d')
    # 4 caracteres do UUID hex — suficiente para evitar colisão prática
    hash_curto = uuid.uuid4().hex[:4]
    return f"{titulo_slug}-{data_str}-{hash_curto}"
