"""
contato_router.py — AxeFlow
Endpoint para receber feedbacks dos usuários e encaminhar ao desenvolvedor.

Fluxo:
  1. Frontend POST /contato com { tipo, assunto, mensagem, usuario }
  2. Backend valida payload e constrói HTML do email
  3. Envia via Brevo (email_service) para o endereço do desenvolvedor
  4. Retorna { ok: True } ou 500 com detalhe do erro

Rate limiting: 3 mensagens por minuto por IP para evitar spam.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.usuario import Usuario
from app.services.email_service import _send
from app.services import audit_service
from app.core.config import settings
from slowapi import Limiter
from slowapi.util import get_remote_address

logger  = logging.getLogger(__name__)
router  = APIRouter(prefix="/contato", tags=["contato"])
limiter = Limiter(key_func=get_remote_address)

# Email de destino do feedback — endereço do desenvolvedor
EMAIL_DEV = "denis.leal07@gmail.com"

# Tipos válidos de feedback
TIPOS_VALIDOS = {"bug", "sugestao", "elogio", "duvida", "outro"}

# Emojis e labels por tipo (usados no assunto e no email)
TIPO_META = {
    "bug":      {"emoji": "🐛", "label": "Bug Report"},
    "sugestao": {"emoji": "💡", "label": "Sugestão"},
    "elogio":   {"emoji": "⭐", "label": "Elogio"},
    "duvida":   {"emoji": "❓", "label": "Dúvida"},
    "outro":    {"emoji": "🔧", "label": "Outro"},
}


# ── Schema do payload ──────────────────────────────────────────────────────────

class UsuarioContato(BaseModel):
    """Dados do usuário que enviou o feedback (enriquecidos pelo frontend)."""
    nome:          Optional[str] = None
    email:         Optional[str] = None
    terreiro_nome: Optional[str] = None
    terreiro_id:   Optional[str] = None


class ContatoRequest(BaseModel):
    tipo:     str = Field(..., description="Tipo de feedback: bug | sugestao | elogio | duvida | outro")
    assunto:  Optional[str] = Field(default=None, max_length=120)
    mensagem: str = Field(..., min_length=10, max_length=2000)
    usuario:  Optional[UsuarioContato] = None


# ── Template HTML do email ─────────────────────────────────────────────────────

def _html_feedback(req: ContatoRequest, ip: str) -> str:
    """Gera HTML do email de feedback com o padrão visual do AxeFlow."""
    meta       = TIPO_META.get(req.tipo, TIPO_META["outro"])
    assunto    = req.assunto or f"Feedback via AxeFlow"
    usuario    = req.usuario or UsuarioContato()

    # Escapa caracteres HTML básicos para evitar XSS no email
    def esc(s: str) -> str:
        if not s:
            return "—"
        return (s
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace('"', "&quot;"))

    mensagem_html = esc(req.mensagem).replace("\n", "<br>")

    return f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Feedback AxeFlow</title>
</head>
<body style="margin:0;padding:0;background:#0f0720;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0720;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <div style="font-size:26px;letter-spacing:5px;color:#d4af37;">☽✦☾</div>
              <div style="font-family:Georgia,serif;font-size:20px;color:#d4af37;letter-spacing:3px;margin-top:6px;">
                AxeFlow
              </div>
              <div style="font-size:11px;color:#8b7fb8;margin-top:4px;letter-spacing:1px;">
                NOVO FEEDBACK RECEBIDO
              </div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#1a0a2e;border:1px solid #2d1b69;border-radius:16px;padding:32px 36px;">

              <!-- Tipo -->
              <div style="margin-bottom:24px;text-align:center;">
                <span style="font-size:2.5rem;">{meta['emoji']}</span>
                <div style="margin-top:8px;font-family:Georgia,serif;font-size:18px;color:#d4af37;">
                  {meta['label']}
                </div>
                <div style="font-size:13px;color:#8b7fb8;margin-top:4px;">
                  {esc(assunto)}
                </div>
              </div>

              <!-- Mensagem -->
              <div style="background:#0f0720;border:1px solid #2d1b69;border-radius:10px;padding:20px;margin-bottom:24px;">
                <p style="color:#8b7fb8;font-size:11px;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px;">
                  Mensagem
                </p>
                <p style="color:#e8e0f0;font-size:14px;line-height:1.7;margin:0;">
                  {mensagem_html}
                </p>
              </div>

              <!-- Dados do usuário -->
              <div style="background:#0f0720;border:1px solid #2d1b69;border-radius:10px;padding:20px;">
                <p style="color:#8b7fb8;font-size:11px;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;">
                  Dados do Usuário
                </p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#8b7fb8;font-size:13px;padding:4px 0;">Nome:</td>
                    <td style="color:#e8e0f0;font-size:13px;padding:4px 0;text-align:right;">{esc(usuario.nome)}</td>
                  </tr>
                  <tr>
                    <td style="color:#8b7fb8;font-size:13px;padding:4px 0;">Email:</td>
                    <td style="color:#d4af37;font-size:13px;padding:4px 0;text-align:right;">{esc(usuario.email)}</td>
                  </tr>
                  <tr>
                    <td style="color:#8b7fb8;font-size:13px;padding:4px 0;">Terreiro:</td>
                    <td style="color:#e8e0f0;font-size:13px;padding:4px 0;text-align:right;">{esc(usuario.terreiro_nome)}</td>
                  </tr>
                  <tr>
                    <td style="color:#8b7fb8;font-size:13px;padding:4px 0;">Terreiro ID:</td>
                    <td style="color:#6b5b9a;font-size:11px;padding:4px 0;text-align:right;">{esc(usuario.terreiro_id)}</td>
                  </tr>
                  <tr>
                    <td style="color:#8b7fb8;font-size:13px;padding:4px 0;">IP:</td>
                    <td style="color:#6b5b9a;font-size:11px;padding:4px 0;text-align:right;">{esc(ip)}</td>
                  </tr>
                </table>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:20px;">
              <p style="color:#4a3f6b;font-size:11px;margin:0;">
                Feedback enviado pelo AxeFlow · Responda diretamente para {esc(usuario.email) if usuario.email else 'o usuário'}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.post("")
@limiter.limit("3/minute")   # máximo 3 feedbacks por minuto por IP (anti-spam)
def enviar_feedback(
    data: ContatoRequest,
    request: Request,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Recebe feedback do usuário e envia email ao desenvolvedor.
    Requer autenticação — garante que só usuários legítimos enviam mensagens.
    """
    # Valida tipo
    if data.tipo not in TIPOS_VALIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de feedback inválido. Use: {', '.join(TIPOS_VALIDOS)}",
        )

    # Captura IP para contexto no email
    ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "desconhecido")
    )

    # Garante que os dados do usuário reflitam o usuário autenticado
    # (evita que alguém envie dados falsos de outro usuário)
    if data.usuario:
        data.usuario.email = user.email
        data.usuario.nome  = user.nome

    # Monta assunto do email
    meta    = TIPO_META.get(data.tipo, TIPO_META["outro"])
    assunto = f"[AxeFlow Feedback] {meta['emoji']} {meta['label']}: {data.assunto or data.mensagem[:60]}"

    # Gera e envia o email
    html    = _html_feedback(data, ip)
    enviado = _send(to=EMAIL_DEV, subject=assunto, html=html)

    if not enviado:
        # Log para rastreamento — não expõe detalhe interno ao usuário
        logger.error(
            "[Contato] Falha ao enviar feedback de %s (tipo=%s, terreiro=%s)",
            user.email, data.tipo, user.terreiro_id,
        )
        raise HTTPException(
            status_code=500,
            detail="Não foi possível enviar a mensagem no momento. Tente novamente em breve.",
        )

    # Auditoria do envio bem-sucedido
    audit_service.log(
        db, request,
        context = "contato",
        action  = "FEEDBACK_ENVIADO",
        level   = "INFO",
        user_id = user.id,
        status  = 200,
        message = f"Feedback '{data.tipo}' enviado por {user.email} ({user.terreiro_id})",
    )

    logger.info(
        "[Contato] Feedback '%s' enviado de %s (terreiro=%s)",
        data.tipo, user.email, user.terreiro_id,
    )

    return {"ok": True, "message": "Mensagem enviada com sucesso!"}