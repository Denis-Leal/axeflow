/**
 * errorHandler.js — AxeFlow
 *
 * Separa a experiência do usuário do log técnico:
 * - Usuário vê mensagem clara e amigável
 * - Dev vê log completo no console + auditoria enviada ao backend
 */

const IS_DEV = process.env.NODE_ENV === 'development';

const HTTP_MESSAGES = {
  400: 'Os dados enviados são inválidos. Verifique e tente novamente.',
  401: 'Email ou senha incorretos.',
  403: 'Você não tem permissão para realizar essa ação.',
  404: 'O recurso solicitado não foi encontrado.',
  409: 'Esse registro já existe.',
  422: 'Os dados enviados são inválidos. Verifique e tente novamente.',
  429: 'Muitas tentativas. Aguarde um momento e tente novamente.',
  500: 'Erro interno no servidor. Nossa equipe foi notificada.',
  502: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
  503: 'O servidor está iniciando. Aguarde alguns segundos e tente novamente.',
  504: 'O servidor demorou para responder. Tente novamente.',
};

const NETWORK_MESSAGES = {
  ERR_NETWORK:      'Não foi possível conectar ao servidor. Verifique sua internet.',
  ERR_CANCELED:     'A requisição foi cancelada.',
  ECONNABORTED:     'A conexão expirou. Tente novamente.',
  ERR_BAD_RESPONSE: 'Resposta inesperada do servidor. Tente novamente em instantes.',
};

export function handleApiError(err, context = 'Desconhecido') {
  const status = err?.response?.status;
  const code   = err?.code;
  const detail = err?.response?.data?.detail;
  const url    = err?.config?.url || '';
  const method = err?.config?.method?.toUpperCase() || '';

  // Log técnico no console
  if (IS_DEV) {
    console.group(`🔴 [AxeFlow Error] ${context}`);
    console.error('Status:', status);
    console.error('Code:', code);
    console.error('URL:', `${method} ${url}`);
    console.error('Response data:', err?.response?.data);
    console.error('Full error:', err);
    console.groupEnd();
  } else {
    console.error(`[AxeFlow][${context}] status=${status} code=${code} url=${method} ${url}`);
  }

  // Envia auditoria ao backend (fire and forget)
  sendAuditLog({
    context, status, code, url, method, detail,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    timestamp: new Date().toISOString(),
  });

  // Mensagem amigável — nunca mostra HTML ou stack trace ao usuário
  if (detail && typeof detail === 'string' && detail.length < 120 && !detail.includes('<')) {
    return detail;
  }
  if (status && HTTP_MESSAGES[status]) return HTTP_MESSAGES[status];
  if (code && NETWORK_MESSAGES[code]) return NETWORK_MESSAGES[code];
  return 'Algo deu errado. Tente novamente ou contate o suporte.';
}

async function sendAuditLog(data) {
  try {
    await fetch('/api/audit/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch {
    // silencioso
  }
}
