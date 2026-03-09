"""
email_service.py — AxeFlow
Envio de emails transacionais via Resend (resend.com).
Plano free: 3.000 emails/mês.
"""
import logging
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


def _send(to: str, subject: str, html: str) -> bool:
    """Envia um email via Resend. Retorna True se enviado com sucesso."""
    if not settings.RESEND_API_KEY:
        logger.warning("[Email] RESEND_API_KEY não configurada — email não enviado para %s", to)
        return False

    try:
        response = httpx.post(
            RESEND_API_URL,
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": settings.EMAIL_FROM,
                "to": [to],
                "subject": subject,
                "html": html,
            },
            timeout=10,
        )
        if response.status_code in (200, 201):
            logger.info("[Email] Enviado para %s — %s", to, subject)
            return True
        else:
            logger.error("[Email] Falha ao enviar para %s: %s %s", to, response.status_code, response.text)
            return False
    except Exception as e:
        logger.error("[Email] Erro ao enviar para %s: %s", to, e)
        return False


# ── Templates ─────────────────────────────────────────────────────────────────

def _base_template(titulo: str, corpo: str) -> str:
    """Template HTML base para todos os emails."""
    return f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{titulo}</title>
</head>
<body style="margin:0;padding:0;background:#0f0720;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0720;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <div style="font-size:28px;letter-spacing:6px;color:#d4af37;">☽✦☾</div>
              <div style="font-family:Georgia,serif;font-size:22px;color:#d4af37;letter-spacing:3px;margin-top:8px;">
                AxeFlow
              </div>
              <div style="font-size:12px;color:#8b7fb8;margin-top:4px;letter-spacing:1px;">
                SISTEMA DE GESTÃO DE GIRAS
              </div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#1a0a2e;border:1px solid #2d1b69;border-radius:16px;padding:36px 40px;">
              {corpo}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="color:#4a3f6b;font-size:12px;margin:0;">
                Este email foi enviado pelo AxeFlow. Não responda a este endereço.
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


def send_convite_membro(
    nome: str,
    email: str,
    senha_provisoria: str,
    terreiro_nome: str,
    convidado_por: str,
    app_url: str,
) -> bool:
    """Email de convite enviado quando um novo membro é adicionado ao terreiro."""

    corpo = f"""
      <h2 style="color:#d4af37;font-family:Georgia,serif;margin:0 0 8px 0;font-size:20px;">
        Você foi convidado!
      </h2>
      <p style="color:#c4b5e8;font-size:15px;line-height:1.6;margin:0 0 24px 0;">
        Olá, <strong style="color:#fff;">{nome}</strong>!<br><br>
        <strong style="color:#d4af37;">{convidado_por}</strong> convidou você para fazer parte
        do terreiro <strong style="color:#fff;">{terreiro_nome}</strong> no AxeFlow.
      </p>

      <div style="background:#0f0720;border:1px solid #2d1b69;border-radius:10px;padding:20px;margin-bottom:28px;">
        <p style="color:#8b7fb8;font-size:12px;margin:0 0 12px 0;text-transform:uppercase;letter-spacing:1px;">
          Suas credenciais de acesso
        </p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="color:#8b7fb8;font-size:14px;padding:4px 0;">Email:</td>
            <td style="color:#fff;font-size:14px;padding:4px 0;text-align:right;">{email}</td>
          </tr>
          <tr>
            <td style="color:#8b7fb8;font-size:14px;padding:4px 0;">Senha provisória:</td>
            <td style="color:#d4af37;font-size:16px;font-weight:bold;padding:4px 0;text-align:right;letter-spacing:2px;">{senha_provisoria}</td>
          </tr>
        </table>
      </div>

      <div style="text-align:center;margin-bottom:24px;">
        <a href="{app_url}/login"
           style="display:inline-block;background:#d4af37;color:#1a0a2e;text-decoration:none;
                  font-weight:bold;font-size:15px;padding:14px 36px;border-radius:8px;
                  letter-spacing:1px;">
          Acessar o AxeFlow →
        </a>
      </div>

      <p style="color:#6b5b9a;font-size:13px;line-height:1.5;margin:0;text-align:center;">
        ⚠️ Por segurança, troque sua senha após o primeiro acesso<br>
        em <strong>Configurações → Alterar Senha</strong>.
      </p>
    """

    return _send(
        to=email,
        subject=f"[AxeFlow] Convite para {terreiro_nome}",
        html=_base_template("Convite AxeFlow", corpo),
    )


def send_nova_gira(
    emails: list[str],
    gira_titulo: str,
    gira_data: str,
    gira_horario: str,
    terreiro_nome: str,
    link_inscricao: str,
) -> int:
    """Notifica membros sobre nova gira criada. Retorna quantos emails foram enviados."""
    corpo = f"""
      <h2 style="color:#d4af37;font-family:Georgia,serif;margin:0 0 8px 0;font-size:20px;">
        ✦ Nova Gira Criada
      </h2>
      <p style="color:#c4b5e8;font-size:15px;line-height:1.6;margin:0 0 24px 0;">
        Uma nova gira foi agendada em <strong style="color:#fff;">{terreiro_nome}</strong>.
      </p>

      <div style="background:#0f0720;border:1px solid #2d1b69;border-radius:10px;padding:20px;margin-bottom:28px;">
        <p style="color:#d4af37;font-size:18px;font-weight:bold;margin:0 0 12px 0;">{gira_titulo}</p>
        <p style="color:#8b7fb8;font-size:14px;margin:0;">
          📅 {gira_data} às {gira_horario}
        </p>
      </div>

      <div style="text-align:center;">
        <a href="{link_inscricao}"
           style="display:inline-block;background:#d4af37;color:#1a0a2e;text-decoration:none;
                  font-weight:bold;font-size:15px;padding:14px 36px;border-radius:8px;">
          Ver detalhes e se inscrever →
        </a>
      </div>
    """

    html = _base_template(f"Nova Gira: {gira_titulo}", corpo)
    enviados = sum(1 for e in emails if _send(to=e, subject=f"[AxeFlow] Nova gira: {gira_titulo}", html=html))
    return enviados
