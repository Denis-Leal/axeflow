"""Recuperação privada e definição de senha com tokens de uso único."""
import logging
from html import escape
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth_rate_limit import check_account
from app.core.auth_route import SensitiveRoute
from app.core.config import settings
from app.core.database import SessionLocal, get_db
from app.core.password_policy import NewPassword
from app.models.terreiro import Terreiro
from app.models.usuario import Usuario
from app.services import audit_service
from app.services.email_service import _send
from app.services.password_token_service import (
    TOKEN_EXPIRA_HORAS, _gerar_token, _hash_token, consume_password_token,
    issue_password_token,
)


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"], route_class=SensitiveRoute)
MSG_GENERICA = "Se o email estiver cadastrado, você receberá um link de recuperação em breve."


class BuscarTerreiroRequest(BaseModel):
    email: EmailStr


class EnviarResetRequest(BaseModel):
    email: EmailStr
    terreiro_id: Optional[UUID] = None


class RedefinirSenhaRequest(BaseModel):
    token: str = Field(min_length=10, max_length=512)
    nova_senha: NewPassword
    purpose: Literal["reset", "invite"] = "reset"


def _html_reset_email(nome: str, terreiro_nome: str, link: str) -> str:
    """Gera HTML do email de recuperação no padrão visual do AxeFlow."""
    nome, terreiro_nome, link = escape(nome), escape(terreiro_nome), escape(link, quote=True)
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


def _process_reset_request(email: str, terreiro_id: Optional[UUID]) -> None:
    """Usa uma sessão própria depois que a resposta pública já foi produzida."""
    db = SessionLocal()
    try:
        candidates = db.query(Usuario.id).filter(
            func.lower(func.trim(Usuario.email)) == email,
            Usuario.ativo.is_(True),
        )
        if terreiro_id is not None:
            candidates = candidates.filter(Usuario.terreiro_id == terreiro_id)
        user_ids = [row[0] for row in candidates.all()]
        for user_id in user_ids:
            try:
                user = db.query(Usuario).filter(
                    Usuario.id == user_id,
                    func.lower(func.trim(Usuario.email)) == email,
                    Usuario.ativo.is_(True),
                ).populate_existing().with_for_update().first()
                if user is None:
                    db.rollback()
                    continue
                tenant = db.query(Terreiro).filter(Terreiro.id == user.terreiro_id).first()
                if tenant is None:
                    db.rollback()
                    continue
                raw = issue_password_token(db, user, "reset")
                link = f"{settings.app_url_resolved}/redefinir-senha#token={raw}&purpose=reset"
                recipient, name, tenant_name = user.email.strip(), user.nome, tenant.nome
                db.commit()
                sent = _send(
                    to=recipient,
                    subject="[AxeFlow] Recuperação de senha",
                    html=_html_reset_email(name, tenant_name, link),
                )
                if not sent:
                    logger.warning("[PasswordReset] Envio de recuperação indisponível")
            except Exception:
                db.rollback()
                logger.error("[PasswordReset] Falha no processamento da recuperação")
    except Exception:
        db.rollback()
        logger.error("[PasswordReset] Recuperação temporariamente indisponível")
    finally:
        db.close()


@router.post("/esqueci-senha/buscar", deprecated=True)
def buscar_terreiros(data: BuscarTerreiroRequest, request: Request):
    """Mantém o contrato legado sem consultar ou divulgar associações religiosas."""
    check_account("reset-search", str(data.email))
    return {"terreiros": []}


@router.post("/esqueci-senha/enviar")
def enviar_reset(data: EnviarResetRequest, request: Request, background_tasks: BackgroundTasks):
    check_account("reset-request", str(data.email))
    background_tasks.add_task(
        _process_reset_request, str(data.email).strip().lower(), data.terreiro_id,
    )
    return {"message": MSG_GENERICA}


@router.post("/redefinir-senha")
def redefinir_senha(
    data: RedefinirSenhaRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    check_account("password-token", data.token)
    user = consume_password_token(db, data.token, data.nova_senha, data.purpose)
    audit_service.log(
        db, request, context="auth", action="PASSWORD_RESET_OK", level="INFO",
        user_id=user.id, status=200, message="Senha definida e sessões revogadas",
    )
    return {"ok": True, "message": "Senha definida com sucesso! Faça login com sua nova senha."}
