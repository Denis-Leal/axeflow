/**
 * errorHandler.js — AxeFlow
 * Traduz erros de rede e HTTP em mensagens amigáveis em português.
 * Usado por todos os serviços que fazem chamadas à API.
 */

/**
 * Extrai mensagem legível de qualquer tipo de erro (Axios, fetch, genérico).
 * @param {unknown} error - Erro capturado no catch
 * @returns {string} Mensagem amigável para exibir ao usuário
 */
export function getErrorMessage(error) {
  // Sem conexão com a internet
  if (!navigator.onLine) {
    return 'Sem conexão com a internet. Verifique sua rede e tente novamente.';
  }

  // Erro do Axios ou fetch com resposta do servidor
  if (error?.response) {
    const status = error.response.status;
    const detail = error.response.data?.detail;

    // Mensagens específicas por código HTTP
    switch (status) {
      case 400: return detail || 'Dados inválidos. Verifique as informações e tente novamente.';
      case 401: return 'Sessão expirada. Faça login novamente.';
      case 403: return 'Você não tem permissão para realizar esta ação.';
      case 404: return detail || 'Recurso não encontrado.';
      case 409: return detail || 'Conflito: o recurso já existe.';
      case 422: return 'Dados inválidos. Verifique os campos obrigatórios.';
      case 429: return 'Muitas tentativas. Aguarde um momento e tente novamente.';
      case 500: return 'Erro interno do servidor. Tente novamente em instantes.';
      case 502:
      case 503:
      case 504: return 'Servidor temporariamente indisponível. Tente novamente em alguns segundos.';
      default:  return detail || `Erro inesperado (código ${status}).`;
    }
  }

  // Timeout ou servidor inacessível (sem resposta)
  if (error?.request || error?.code === 'ECONNABORTED') {
    return 'Servidor indisponível. Verifique sua conexão ou tente novamente em instantes.';
  }

  // Erro genérico de JS
  return error?.message || 'Ocorreu um erro inesperado. Tente novamente.';
}

/**
 * Exibe mensagem de erro em elemento da DOM.
 * @param {string} containerId - ID do elemento onde exibir o erro
 * @param {unknown} error - Erro capturado
 */
export function showError(containerId, error) {
  const el = document.getElementById(containerId);
  if (el) {
    el.textContent = getErrorMessage(error);
    el.style.display = 'block';
  }
}

export function handleApiError(error, context = '') {
  const msg = getErrorMessage(error);
  return context ? `${context}: ${msg}` : msg;
}