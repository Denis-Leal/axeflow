"""
api_key_service.py — AxeFlow
Lógica de negócio para geração, validação e revogação de API keys.

Fluxo de autenticação via API Key:
  1. Request chega com header: Authorization: Bearer axf_...
  2. security.py detecta o prefixo 'axf_' e delega para este serviço
  3. Calculamos SHA-256 da chave recebida
  4. Buscamos no banco por key_hash (índice — lookup O(1))
  5. Validamos: ativa, não expirada, terreiro correto
  6. Atualizamos last_used_at e request_count (fire-and-forget)
  7. Retornamos o usuário dono da chave para o endpoint

Geração segura:
  - 32 bytes de secrets.token_bytes() → 64 chars hex
  - Prefixo 'axf_' para identificação em logs/repos
  - SHA-256 armazenado (sem possibilidade de reversão)
  - Valor real exibido UMA ÚNICA VEZ ao usuário (nunca mais recuperável)
"""
import hashlib
import secrets
import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.api_key import ApiKey
from app.models.usuario import Usuario

logger = logging.getLogger(__name__)

# Prefixo identificador — facilita varredura de vazamentos em repos/logs
KEY_PREFIX = "axf_"

# Scopes disponíveis com descrições legíveis
SCOPES_DISPONIVEIS = {
    "giras:read":        "Leitura de giras e detalhes",
    "giras:write":       "Criar e editar giras",
    "inscricoes:read":   "Leitura de inscrições",
    "inscricoes:write":  "Inscrever e cancelar consulentes",
    "presenca:write":    "Marcar presença/falta",
    "relatorios:read":   "Relatórios e ranking de consulentes",
    "membros:read":      "Leitura de membros do terreiro",
}


def _gerar_chave() -> tuple[str, str, str]:
    """
    Gera uma nova API key segura.

    Retorna: (chave_completa, prefix, key_hash)
      - chave_completa: valor exibido ao usuário UMA ÚNICA VEZ
      - prefix: 'axf_' + primeiros 4 chars (identificação)
      - key_hash: SHA-256 hexdigest (o que é armazenado no banco)
    """
    # 32 bytes = 256 bits de entropia — impossível de bruteforçar
    valor_aleatorio = secrets.token_hex(32)
    chave_completa  = f"{KEY_PREFIX}{valor_aleatorio}"
    prefix          = chave_completa[:8]   # 'axf_' + 4 chars
    key_hash        = hashlib.sha256(chave_completa.encode()).hexdigest()
    return chave_completa, prefix, key_hash


def criar_api_key(
    db: Session,
    user: Usuario,
    nome: str,
    scopes: list[str],
    descricao: Optional[str] = None,
    expires_at: Optional[datetime] = None,
) -> tuple[ApiKey, str]:
    """
    Cria uma nova API key para o usuário.

    Retorna: (api_key_obj, chave_completa)
      - api_key_obj: objeto persistido (sem a chave real)
      - chave_completa: valor a ser exibido UMA ÚNICA VEZ ao usuário

    Raises:
      HTTPException 400: se algum scope informado for inválido
      HTTPException 400: se o usuário já tiver 10 chaves ativas (limite de segurança)
    """
    # Valida scopes
    scopes_invalidos = [s for s in scopes if s not in SCOPES_DISPONIVEIS]
    if scopes_invalidos:
        raise HTTPException(
            status_code=400,
            detail=f"Scopes inválidos: {', '.join(scopes_invalidos)}. "
                   f"Disponíveis: {', '.join(SCOPES_DISPONIVEIS.keys())}",
        )

    # Limite de chaves ativas por terreiro (evita abuso)
    total_ativas = db.query(ApiKey).filter(
        ApiKey.terreiro_id == user.terreiro_id,
        ApiKey.ativa == True,
    ).count()
    if total_ativas >= 10:
        raise HTTPException(
            status_code=400,
            detail="Limite de 10 chaves ativas por terreiro atingido. Revogue alguma antes de criar.",
        )

    chave_completa, prefix, key_hash = _gerar_chave()

    api_key = ApiKey(
        terreiro_id   = user.terreiro_id,
        user_id       = user.id,
        prefix        = prefix,
        key_hash      = key_hash,
        nome          = nome.strip(),
        descricao     = descricao.strip() if descricao else None,
        scopes        = scopes,
        ativa         = True,
        expires_at    = expires_at,
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)

    logger.info(
        "[ApiKey] Nova chave criada: prefix=%s nome='%s' terreiro=%s scopes=%s",
        prefix, nome, user.terreiro_id, scopes,
    )

    # Retorna o objeto E o valor real (exibir uma única vez)
    return api_key, chave_completa


def listar_api_keys(db: Session, terreiro_id: UUID) -> list[ApiKey]:
    """Lista todas as chaves do terreiro, ordenadas por criação desc."""
    return (
        db.query(ApiKey)
        .filter(ApiKey.terreiro_id == terreiro_id)
        .order_by(ApiKey.created_at.desc())
        .all()
    )


def revogar_api_key(db: Session, key_id: UUID, terreiro_id: UUID) -> ApiKey:
    """
    Revoga uma API key (soft delete — mantém histórico).

    Raises:
      HTTPException 404: chave não encontrada ou pertence a outro terreiro
      HTTPException 400: chave já está revogada
    """
    key = db.query(ApiKey).filter(
        ApiKey.id          == key_id,
        ApiKey.terreiro_id == terreiro_id,
    ).first()

    if not key:
        raise HTTPException(status_code=404, detail="Chave não encontrada")

    if not key.ativa:
        raise HTTPException(status_code=400, detail="Chave já está revogada")

    key.ativa      = False
    key.revoked_at = datetime.utcnow()
    db.commit()
    db.refresh(key)

    logger.info(
        "[ApiKey] Chave revogada: prefix=%s terreiro=%s",
        key.prefix, terreiro_id,
    )
    return key


def autenticar_por_api_key(
    db: Session,
    chave_recebida: str,
) -> Optional[tuple[Usuario, ApiKey]]:
    """
    Autentica uma requisição via API key.

    Fluxo:
      1. Calcula SHA-256 da chave recebida
      2. Busca no banco por key_hash (índice único)
      3. Valida: ativa, não expirada
      4. Atualiza last_used_at e incrementa request_count
      5. Retorna (usuario, api_key) ou None se inválida

    Nunca lança exceção — retorna None para chaves inválidas.
    O caller decide o comportamento (401 ou fallback para JWT).
    """
    if not chave_recebida.startswith(KEY_PREFIX):
        return None

    key_hash = hashlib.sha256(chave_recebida.encode()).hexdigest()

    key = db.query(ApiKey).filter(ApiKey.key_hash == key_hash).first()

    if not key:
        return None

    # Chave encontrada — verifica validade
    if not key.valida:
        logger.warning(
            "[ApiKey] Tentativa de uso de chave inválida/expirada: prefix=%s",
            key.prefix,
        )
        return None

    # Atualiza estatísticas de uso (sem falhar a requisição se der erro)
    try:
        key.last_used_at  = datetime.utcnow()
        key.request_count = (key.request_count or 0) + 1
        db.commit()
    except Exception as e:
        logger.warning("[ApiKey] Falha ao atualizar last_used_at: %s", e)
        db.rollback()

    # Busca o usuário dono da chave
    usuario = db.query(Usuario).filter(
        Usuario.id    == key.user_id,
        Usuario.ativo == True,
    ).first()

    if not usuario:
        return None

    return usuario, key


def verificar_scope(api_key: ApiKey, scope_necessario: str) -> bool:
    """
    Verifica se a API key tem o scope necessário para a operação.

    Uso nos endpoints:
      if not verificar_scope(api_key, "giras:read"):
          raise HTTPException(403, "Scope insuficiente: giras:read")
    """
    scopes = api_key.scopes or []
    return scope_necessario in scopes