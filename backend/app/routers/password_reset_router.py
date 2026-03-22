"""
password_reset_router.py — AxeFlow
Endpoints de recuperação de senha com fluxo multi-tenant em dois steps.

Step 1 — POST /auth/esqueci-senha/buscar
  Recebe: { email }
  Retorna: lista de terreiros onde aquele email está cadastrado
  (apenas id e nome — sem expor dados sensíveis)
  Se nenhum terreiro for encontrado: retorna lista vazia silenciosamente

Step 2 — POST /auth/esqueci-senha/enviar
  Recebe: { email, terreiro_id }
  Valida o par internamente, gera token, envia email com link
  SEMPRE retorna mensagem genérica (anti-enumeração)

Step 3 — POST /auth/redefinir-senha
  Recebe: { token, nova_senha }
  Valida token (hash + não expirado + não usado)
  Atualiza senha e invalida token

Rate limiting:
  /buscar:           10/hora por IP — anti-enumeração de emails
  /enviar:            5/hora por IP — anti-spam de envio de email
  /redefinir-senha:  10/hora por IP — anti-bruteforce de tokens
"""
import hashlib
import secrets
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.config import settings
from app.core.security import hash_password
from app.models.usuario import Usuario
from app.models.terreiro import Terreiro
from app.models.password_reset_token import PasswordResetToken
from app.services.email_service import _send
from app.services import audit_service
from slowapi import Limiter
from slowapi.util import get_remote_address

logger  = logging.getLogger(__name__)
router  = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

# Janela de validade do token — curta para reduzir risco de abuso
TOKEN_EXPIRA_HORAS = 1

# Mensagem genérica retornada pelo step 2 (sucesso ou falha silenciosa)
MSG_GENERICA = (
    "Se o email estiver cadastrado neste terreiro, "
    "você receberá um link de recuperação em breve."
)


# ── Schemas ────────────────────────────────────────────────────────────────────

class BuscarTerreiroRequest(BaseModel):
    """Step 1: apenas o email — sem expor que o terreiro existe ou não."""
    email: EmailStr


class EnviarResetRequest(BaseModel):
    """Step 2: email + terreiro escolhido pelo usuário na tela."""
    email:       EmailStr
    terreiro_id: str = Field(..., description="UUID do terreiro selecionado")


class RedefinirSenhaRequest(BaseModel):
    """Step 3: token do link no email + nova senha escolhida pelo usuário."""
    token:      str = Field(..., min_length=10)
    nova_senha: str = Field(..., min_length=6, max_length=128)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _hash_token(token: str) -> str:
    """SHA-256 hexdigest — usado para armazenar e comparar tokens."""
    return hashlib.sha256(token.encode()).hexdigest()


def _gerar_token() -> tuple[str, str]:
    """
    Gera token seguro com 256 bits de entropia.
    Retorna: (token_raw, token_hash)
      - token_raw:  incluso no link do email — nunca persiste no banco
      - token_hash: SHA-256 armazenado no banco (irreversível)
    """
    token_raw  = secrets.token_urlsafe(32)
    token_hash = _hash_token(token_raw)
    return token_raw, token_hash


def _invalidar_tokens_anteriores(db: Session, user_id) -> None:
    """
    Invalida todos os tokens ainda ativos do usuário antes de gerar novo.
    Garante que só o link mais recente funcione.
    """
    agora = datetime.utcnow()
    (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.user_id   == user_id,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > agora,
        )
        .update({"used_at": agora})  # bulk update — mais eficiente que loop
    )


def _html_reset_email(nome: str, terreiro_nome: str, link: str) -> str:
    """Gera HTML do email de recuperação no padrão visual do AxeFlow."""
    return f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Recuperação de Senha | AxeFlow</title></head>
<body style="margin:0;padding:0;background:#0f0720;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0720;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <tr><td align="center" style="padding-bottom:28px;">
          <div style="font-size:26px;letter-spacing:5px;color:#d4af37;">☽✦☾</div>
          <div style="font-family:Georgia,serif;font-size:20px;color:#d4af37;letter-spacing:3px;margin-top:6px;">AxeFlow</div>
          <div style="font-size:11px;color:#8b7fb8;margin-top:4px;letter-spacing:1px;">RECUPERAÇÃO DE SENHA</div>
        </td></tr>

        <tr><td style="background:#1a0a2e;border:1px solid #2d1b69;border-radius:16px;padding:36px 40px;">
          <h2 style="color:#d4af37;font-family:Georgia,serif;margin:0 0 8px;font-size:20px;">Redefinir sua senha</h2>
          <p style="color:#c4b5e8;font-size:15px;line-height:1.6;margin:0 0 24px;">
            Olá, <strong style="color:#fff;">{nome}</strong>!<br><br>
            Recebemos uma solicitação de recuperação de senha para o terreiro
            <strong style="color:#d4af37;">{terreiro_nome}</strong>.
            Clique no botão abaixo para criar uma nova senha.
          </p>

          <div style="text-align:center;margin-bottom:28px;">
            <a href="{link}" style="display:inline-block;background:#d4af37;color:#1a0a2e;
               text-decoration:none;font-weight:bold;font-size:15px;
               padding:14px 36px;border-radius:8px;letter-spacing:1px;">
              Redefinir minha senha →
            </a>
          </div>

          <div style="background:#0f0720;border:1px solid #2d1b69;border-radius:10px;padding:16px;margin-bottom:20px;">
            <p style="color:#8b7fb8;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Ou copie o link</p>
            <p style="color:#6b5b9a;font-size:12px;margin:0;word-break:break-all;">{link}</p>
          </div>

          <p style="color:#6b5b9a;font-size:13px;line-height:1.5;margin:0;text-align:center;">
            ⏱️ Este link expira em <strong style="color:#d4af37;">1 hora</strong>.<br>
            Se você não solicitou a recuperação, ignore este email com segurança.
          </p>
        </td></tr>

        <tr><td align="center" style="padding-top:20px;">
          <p style="color:#4a3f6b;font-size:11px;margin:0;">
            Este email foi enviado pelo AxeFlow. Não responda a este endereço.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/esqueci-senha/buscar")
@limiter.limit("10/hour")
def buscar_terreiros(
    data: BuscarTerreiroRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Step 1 — Retorna os terreiros onde o email está cadastrado.

    Expõe APENAS id e nome do terreiro.
    Retorna lista vazia se o email não existir (sem revelar ausência).
    """
    email_norm = data.email.strip().lower()

    # Busca todos os usuários ativos com este email em qualquer terreiro
    usuarios = (
        db.query(Usuario)
        .filter(
            func.lower(Usuario.email) == email_norm,
            Usuario.ativo == True,
        )
        .all()
    )

    if not usuarios:
        logger.info("[PasswordReset] Email não encontrado: %s", data.email)
        return {"terreiros": []}  # lista vazia — não revela que email não existe

    # Busca os terreiros correspondentes, ordenados por nome para UX consistente
    terreiro_ids = [u.terreiro_id for u in usuarios]
    terreiros = (
        db.query(Terreiro)
        .filter(Terreiro.id.in_(terreiro_ids))
        .order_by(Terreiro.nome)
        .all()
    )

    # Expõe APENAS id e nome — sem vazar email, role, senha_hash, etc.
    return {
        "terreiros": [
            {"id": str(t.id), "nome": t.nome}
            for t in terreiros
        ]
    }


@router.post("/esqueci-senha/enviar")
@limiter.limit("5/hour")
def enviar_reset(
    data: EnviarResetRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Step 2 — Valida o par email+terreiro e envia o link de recuperação.

    Sempre retorna mensagem genérica (anti-enumeração).
    """
    email_norm = data.email.strip().lower()

    usuario = (
        db.query(Usuario)
        .filter(
            func.lower(Usuario.email) == email_norm,
            Usuario.terreiro_id       == data.terreiro_id,
            Usuario.ativo             == True,
        )
        .first()
    )

    if not usuario:
        # Par inválido — retorna mensagem genérica sem revelar o motivo
        logger.warning(
            "[PasswordReset] Par inválido: %s / terreiro=%s",
            data.email, data.terreiro_id,
        )
        audit_service.log(
            db, request,
            context = "auth",
            action  = "PASSWORD_RESET_INVALID_PAIR",
            level   = "WARNING",
            status  = 200,
            message = f"Par não encontrado: {data.email} / terreiro={data.terreiro_id}",
        )
        return {"message": MSG_GENERICA}

    terreiro = db.query(Terreiro).filter(Terreiro.id == usuario.terreiro_id).first()

    # Invalida links anteriores antes de gerar novo
    _invalidar_tokens_anteriores(db, usuario.id)

    # Gera token e persiste apenas o hash
    token_raw, token_hash = _gerar_token()
    expires_at = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRA_HORAS)

    reset_token = PasswordResetToken(
        user_id     = usuario.id,
        terreiro_id = terreiro.id,
        token_hash  = token_hash,
        expires_at  = expires_at,
    )
    db.add(reset_token)
    db.commit()

    # Envia email — falha silenciosa para não revelar existência do usuário
    link = f"{settings.app_url_resolved}/redefinir-senha?token={token_raw}"
    try:
        enviado = _send(
            to      = usuario.email,
            subject = "[AxeFlow] Recuperação de senha",
            html    = _html_reset_email(usuario.nome, terreiro.nome, link),
        )
        if not enviado:
            logger.error("[PasswordReset] Falha ao enviar email para %s", usuario.email)
    except Exception as e:
        logger.error("[PasswordReset] Erro ao enviar email: %s", e)

    audit_service.log(
        db, request,
        context = "auth",
        action  = "PASSWORD_RESET_REQUESTED",
        level   = "INFO",
        user_id = usuario.id,
        status  = 200,
        message = f"Token gerado: {usuario.email} (terreiro: {terreiro.nome})",
    )

    return {"message": MSG_GENERICA}


@router.post("/redefinir-senha")
@limiter.limit("10/hour")
def redefinir_senha(
    data: RedefinirSenhaRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Step 3 — Valida token e redefine a senha.

    Token válido = hash confere + não expirou + não foi usado antes.
    Após uso: token invalidado — não pode ser reutilizado.
    """
    token_hash  = _hash_token(data.token)
    reset_token = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == token_hash)
        .first()
    )

    if not reset_token or not reset_token.valido:
        audit_service.log(
            db, request,
            context = "auth",
            action  = "PASSWORD_RESET_INVALID_TOKEN",
            level   = "WARNING",
            status  = 400,
            message = "Token inválido, expirado ou já utilizado",
        )
        raise HTTPException(
            status_code=400,
            detail="Link de recuperação inválido ou expirado. Solicite um novo.",
        )

    usuario = (
        db.query(Usuario)
        .filter(Usuario.id == reset_token.user_id, Usuario.ativo == True)
        .first()
    )
    if not usuario:
        raise HTTPException(status_code=400, detail="Usuário não encontrado ou inativo.")

    # Atualiza senha e invalida token na mesma operação
    usuario.senha_hash  = hash_password(data.nova_senha)
    reset_token.used_at = datetime.utcnow()
    db.commit()

    audit_service.log(
        db, request,
        context = "auth",
        action  = "PASSWORD_RESET_OK",
        level   = "INFO",
        user_id = usuario.id,
        status  = 200,
        message = f"Senha redefinida: {usuario.email}",
    )

    return {"ok": True, "message": "Senha redefinida com sucesso! Faça login com sua nova senha."}