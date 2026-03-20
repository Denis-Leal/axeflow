"""
api_key_router.py — AxeFlow
Endpoints REST para gestão de API keys.

Endpoints:
  GET    /api-keys            — lista chaves do terreiro
  POST   /api-keys            — cria nova chave (retorna valor real UMA VEZ)
  DELETE /api-keys/{id}       — revoga chave

Autenticação nos endpoints públicos da API (via api_key_service):
  GET    /v1/giras            — lista giras (scope: giras:read)
  POST   /v1/inscricoes       — inscrever consulente (scope: inscricoes:write)
  GET    /v1/relatorios       — ranking e presença (scope: relatorios:read)
  PATCH  /v1/presenca/{id}    — marcar presença (scope: presenca:write)
"""
import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.usuario import Usuario
from app.models.gira import Gira
from app.models.inscricao_consulente import InscricaoConsulente
from app.models.consulente import Consulente
from app.services import api_key_service, audit_service
from app.services.api_key_service import SCOPES_DISPONIVEIS, autenticar_por_api_key, verificar_scope
from app.schemas.inscricao_schema import InscricaoPublicaRequest
from app.services import inscricao_service
from app.services.presenca_service import get_ranking_consulentes

logger = logging.getLogger(__name__)

router = APIRouter(tags=["api-keys"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class CriarApiKeyRequest(BaseModel):
    nome:       str             = Field(..., min_length=3, max_length=100)
    descricao:  Optional[str]   = Field(default=None, max_length=300)
    scopes:     list[str]       = Field(..., min_length=1)
    expires_at: Optional[datetime] = None


class ApiKeyResponse(BaseModel):
    """Resposta de listagem — nunca inclui o valor real da chave."""
    id:            str
    nome:          str
    descricao:     Optional[str]
    prefix:        str
    scopes:        list[str]
    ativa:         bool
    expires_at:    Optional[datetime]
    last_used_at:  Optional[datetime]
    request_count: int
    created_at:    datetime
    revoked_at:    Optional[datetime]


class CriarApiKeyResponse(ApiKeyResponse):
    """Resposta de criação — inclui o valor real DA CHAVE (exibido uma única vez)."""
    chave: str = Field(..., description="Valor da chave — armazene agora, não será exibido novamente")


# ── Endpoints de gestão (requerem JWT) ────────────────────────────────────────

@router.get("/api-keys", response_model=list[ApiKeyResponse])
def listar_chaves(
    user: Usuario = Depends(get_current_user),
    db:   Session = Depends(get_db),
):
    """Lista todas as API keys do terreiro (admin e operador)."""
    chaves = api_key_service.listar_api_keys(db, user.terreiro_id)
    return [
        ApiKeyResponse(
            id            = str(k.id),
            nome          = k.nome,
            descricao     = k.descricao,
            prefix        = k.prefix,
            scopes        = k.scopes or [],
            ativa         = k.ativa,
            expires_at    = k.expires_at,
            last_used_at  = k.last_used_at,
            request_count = k.request_count or 0,
            created_at    = k.created_at,
            revoked_at    = k.revoked_at,
        )
        for k in chaves
    ]


@router.post("/api-keys", response_model=CriarApiKeyResponse)
def criar_chave(
    data: CriarApiKeyRequest,
    request: Request,
    user: Usuario = Depends(require_role("admin")),
    db:   Session = Depends(get_db),
):
    """
    Cria nova API key (somente admin).
    O valor real da chave é retornado UMA ÚNICA VEZ — não é recuperável depois.
    """
    key, chave_completa = api_key_service.criar_api_key(
        db         = db,
        user       = user,
        nome       = data.nome,
        scopes     = data.scopes,
        descricao  = data.descricao,
        expires_at = data.expires_at,
    )

    audit_service.log(
        db, request,
        context = "api_key",
        action  = "API_KEY_CRIADA",
        level   = "INFO",
        user_id = user.id,
        status  = 200,
        message = f"API key criada: '{data.nome}' scopes={data.scopes}",
    )

    return CriarApiKeyResponse(
        id            = str(key.id),
        nome          = key.nome,
        descricao     = key.descricao,
        prefix        = key.prefix,
        scopes        = key.scopes or [],
        ativa         = key.ativa,
        expires_at    = key.expires_at,
        last_used_at  = key.last_used_at,
        request_count = 0,
        created_at    = key.created_at,
        revoked_at    = key.revoked_at,
        chave         = chave_completa,   # exibido UMA VEZ
    )


@router.delete("/api-keys/{key_id}")
def revogar_chave(
    key_id: UUID,
    request: Request,
    user: Usuario = Depends(require_role("admin")),
    db:   Session = Depends(get_db),
):
    """Revoga uma API key (somente admin). Operação irreversível."""
    key = api_key_service.revogar_api_key(db, key_id, user.terreiro_id)

    audit_service.log(
        db, request,
        context = "api_key",
        action  = "API_KEY_REVOGADA",
        level   = "WARNING",
        user_id = user.id,
        status  = 200,
        message = f"API key revogada: prefix={key.prefix} nome='{key.nome}'",
    )

    return {"ok": True, "message": f"Chave '{key.nome}' revogada com sucesso"}


@router.get("/api-keys/scopes")
def listar_scopes():
    """Lista todos os scopes disponíveis com suas descrições (público)."""
    return [
        {"scope": scope, "descricao": desc}
        for scope, desc in SCOPES_DISPONIVEIS.items()
    ]


# ── Helper: autenticação por API key ──────────────────────────────────────────

def _get_user_by_api_key(request: Request, db: Session):
    """
    Extrai e valida API key do header Authorization.
    Retorna (usuario, api_key) ou levanta 401.
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer axf_"):
        raise HTTPException(
            status_code=401,
            detail="API key ausente ou formato inválido. Use: Authorization: Bearer axf_...",
            headers={"WWW-Authenticate": "Bearer"},
        )

    chave = auth.removeprefix("Bearer ")
    resultado = autenticar_por_api_key(db, chave)

    if not resultado:
        raise HTTPException(
            status_code=401,
            detail="API key inválida, expirada ou revogada",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return resultado   # (usuario, api_key)


# ── Endpoints públicos da API v1 ──────────────────────────────────────────────

@router.get("/v1/giras")
def v1_listar_giras(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    [API v1] Lista giras ativas do terreiro.
    Scope necessário: giras:read
    """
    usuario, api_key = _get_user_by_api_key(request, db)

    if not verificar_scope(api_key, "giras:read"):
        raise HTTPException(status_code=403, detail="Scope insuficiente: necessário 'giras:read'")

    giras = (
        db.query(Gira)
        .filter(
            Gira.terreiro_id == usuario.terreiro_id,
            Gira.deleted_at.is_(None),
        )
        .order_by(Gira.data.desc())
        .all()
    )

    return [
        {
            "id":                 str(g.id),
            "titulo":             g.titulo,
            "tipo":               g.tipo,
            "acesso":             g.acesso,
            "data":               g.data.isoformat(),
            "horario":            g.horario.strftime("%H:%M"),
            "limite_consulentes": g.limite_consulentes,
            "status":             g.status,
            "slug_publico":       g.slug_publico,
            "abertura_lista":     g.abertura_lista.isoformat() if g.abertura_lista else None,
            "fechamento_lista":   g.fechamento_lista.isoformat() if g.fechamento_lista else None,
        }
        for g in giras
    ]


@router.get("/v1/giras/{gira_id}/inscricoes")
def v1_listar_inscricoes(
    gira_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    [API v1] Lista inscrições de consulentes de uma gira.
    Scope necessário: inscricoes:read
    """
    usuario, api_key = _get_user_by_api_key(request, db)

    if not verificar_scope(api_key, "inscricoes:read"):
        raise HTTPException(status_code=403, detail="Scope insuficiente: necessário 'inscricoes:read'")

    # Valida que a gira pertence ao terreiro da key
    gira = db.query(Gira).filter(
        Gira.id          == gira_id,
        Gira.terreiro_id == usuario.terreiro_id,
        Gira.deleted_at.is_(None),
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    inscricoes = (
        db.query(InscricaoConsulente)
        .filter(InscricaoConsulente.gira_id == gira_id)
        .order_by(InscricaoConsulente.posicao)
        .all()
    )

    return [
        {
            "id":        str(i.id),
            "posicao":   i.posicao,
            "status":    i.status,
            "nome":      i.consulente.nome      if i.consulente else None,
            "telefone":  i.consulente.telefone  if i.consulente else None,
            "criado_em": i.created_at.isoformat(),
        }
        for i in inscricoes
    ]


@router.post("/v1/giras/{slug}/inscrever")
def v1_inscrever_consulente(
    slug: str,
    data: InscricaoPublicaRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    [API v1] Inscreve consulente em gira pública via slug.
    Scope necessário: inscricoes:write

    Mesmo comportamento do endpoint público, mas autenticado por API key.
    Útil para integrações WhatsApp/n8n que processam inscrições.
    """
    _, api_key = _get_user_by_api_key(request, db)

    if not verificar_scope(api_key, "inscricoes:write"):
        raise HTTPException(status_code=403, detail="Scope insuficiente: necessário 'inscricoes:write'")

    return inscricao_service.inscrever_publico(db, slug, data)


@router.get("/v1/relatorios/consulentes")
def v1_ranking_consulentes(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    [API v1] Ranking de presença dos consulentes do terreiro.
    Scope necessário: relatorios:read
    """
    usuario, api_key = _get_user_by_api_key(request, db)

    if not verificar_scope(api_key, "relatorios:read"):
        raise HTTPException(status_code=403, detail="Scope insuficiente: necessário 'relatorios:read'")

    return get_ranking_consulentes(db, usuario.terreiro_id)


@router.patch("/v1/inscricoes/{inscricao_id}/presenca")
def v1_marcar_presenca(
    inscricao_id: UUID,
    data: dict,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    [API v1] Marca presença ou falta de um consulente.
    Scope necessário: presenca:write
    Body: { "status": "compareceu" | "faltou" }
    """
    usuario, api_key = _get_user_by_api_key(request, db)

    if not verificar_scope(api_key, "presenca:write"):
        raise HTTPException(status_code=403, detail="Scope insuficiente: necessário 'presenca:write'")

    status = data.get("status")
    if status not in ("compareceu", "faltou"):
        raise HTTPException(status_code=400, detail="Status inválido. Use: compareceu | faltou")

    from app.schemas.inscricao_schema import PresencaUpdate
    return inscricao_service.update_presenca(
        db, inscricao_id,
        PresencaUpdate(status=status),
        usuario.terreiro_id,
    )