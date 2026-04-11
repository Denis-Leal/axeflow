// =====================================================
// api.js — AxeFlow
// Cliente HTTP Axios com interceptors de autenticação.
//
// CORREÇÃO MULTI-TENANT (push notifications):
//   O interceptor de 401 agora remove também o terreiro_id
//   do localStorage, garantindo que após logout automático
//   (token expirado) o _app.js não use um terreiro_id antigo
//   para validar notificações push de outra sessão.
// =====================================================

import axios from 'axios';

// Usa o proxy do Next.js (/api → backend:8000 internamente).
// Assim o celular nunca precisa acessar a porta 8000 diretamente.
// Funciona em qualquer rede, localhost ou IP local.
const API_URL = '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Interceptor de Request ────────────────────────────
// Injeta o token JWT em todas as requisições autenticadas
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ── Interceptor de Response ───────────────────────────
// Trata 401 (token expirado/inválido) globalmente:
//   - Remove token E terreiro_id do localStorage
//   - Redireciona para /login após um tick (evita cortar requisições paralelas)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      // Não redireciona se já estamos na página de login ou registro
      const pagina = window.location.pathname;
      if (pagina !== '/login' && pagina !== '/registro') {
        // Espera um tick para não cortar requisições paralelas legítimas
        // (ex: dashboard fazendo listGiras + getMe ao mesmo tempo)
        setTimeout(() => {
          // Remove token e terreiro_id para limpar contexto multi-tenant
          localStorage.removeItem('token');
          localStorage.removeItem('terreiro_id');
          window.location.href = '/login';
        }, 100);
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────
export const login    = (email, senha) => api.post('/auth/login', { email, senha });
export const register = (data)         => api.post('/auth/register', data);
export const getMe    = ()             => api.get('/auth/me');

// ── Giras ─────────────────────────────────────────────
export const listGiras   = ()           => api.get('/giras');
export const createGira  = (data)       => api.post('/giras', data);
export const getGira     = (id)         => api.get(`/giras/${id}`);
export const updateGira  = (id, data)   => api.patch(`/giras/${id}`, data);
export const deleteGira  = (id)         => api.delete(`/giras/${id}`);

// ── Inscrições ────────────────────────────────────────
export const listInscricoes    = (giraId)              => api.get(`/giras/${giraId}/inscricoes`);
export const updatePresenca    = (inscricaoId, status) => api.patch(`/inscricao/${inscricaoId}/presenca`, { status });
export const updatePresencaMembro = (id, membroId, status) => api.post(`/membros/giras/${id}/presenca-membros/${membroId}`, { status });
export const cancelarInscricaoMembro = (id, membroId) => api.delete(`/membros/giras/${id}/presenca-membros/${membroId}`);
export const getPresencaMembros = (giraId) => api.get(`/membros/giras/${giraId}/presenca-membros`);
export const getPresencaMembrosPublica = (giraId) => api.get(`/membros/giras/${giraId}/presenca-membros-publica`);
export const confirmarPresencaMembro = (giraId) => api.post(`/membros/giras/${giraId}/confirmar-presenca`);
export const confirmarPresencaMembroPublica = (giraId) => api.post(`/membros/giras/${giraId}/confirmar-presenca-publica`);
export const cancelarInscricao = (inscricaoId)         => api.delete(`/inscricao/${inscricaoId}`);
export const reativarInscricao = (inscricaoId)         => api.post(`/inscricao/${inscricaoId}/reativar`);


// ── Consulentes ───────────────────────────────────────
export const listConsulentes   = ()           => api.get('/consulentes');
export const createConsulente  = (data)       => api.post('/consulentes', data);
export const updateConsulente  = (id, data)   => api.put(`/consulentes/${id}`, data);
export const deleteConsulente  = (id)         => api.delete(`/consulentes/${id}`);
export const getRankingConsulentes = () => api.get('/consulentes/ranking');

// ── Público ───────────────────────────────────────────
export const getGiraPublica   = (slug)        => api.get(`/public/gira/${slug}`);
export const inscreverPublico = (slug, data)  => api.post(`/public/gira/${slug}/inscrever`, data);

// ── Membros ───────────────────────────────────────────
export const listMembros   = ()           => api.get('/membros');
export const createMembro  = (data)       => api.post('/membros', data);
export const updateMembro  = (id, data)   => api.put(`/membros/${id}`, data);
export const deleteMembro  = (id)         => api.delete(`/membros/${id}`);

// ── Configurações ─────────────────────────────────────
export const getConfig     = ()           => api.get('/config');
export const updateConfig  = (data)       => api.put('/config', data);
export const changePassword = (data) => api.patch('/auth/senha', data);

// ── Contato ───────────────────────────────────────────
export const enviarContato = (data)       => api.post('/contato', data);

// ── Push Notifications ─────────────────────────────────
export const registerPushSubscription = (subscription) => api.post('/push/register', { subscription });
export const unregisterPushSubscription = () => api.post('/push/unregister');

// ── Auditoria ───────────────────────────────────────────
export const listAuditoria = () => api.get('/auditoria');

// ── API Keys ───────────────────────────────────────────
export const listApiKeys = () => api.get('/api-keys');
export const createApiKey = (data) => api.post('/api-keys', data);
export const deleteApiKey = (id) => api.delete(`/api-keys/${id}`);

// ── Health Check ───────────────────────────────────────
export const healthCheck = () => api.get('/health')

// ── Inventário ────────────────────────────────────────────────────────────────
// Itens de estoque
export const listarItens           = (ownerId)             => api.get('/inventory/items', { params: ownerId ? { owner_id: ownerId } : {} });
export const criarItemTerreiro     = (data)                => api.post('/inventory/items/terreiro', data);
export const criarItemMedium       = (data)                => api.post('/inventory/items/medium', data);
export const getSaldoItem          = (itemId)              => api.get(`/inventory/items/${itemId}/stock`);
export const getHistoricoItem      = (itemId, limit = 20)  => api.get(`/inventory/items/${itemId}/history`, { params: { limit } });
export const registrarMovimentacao = (itemId, data)        => api.post(`/inventory/items/${itemId}/movements`, data);

// Consumo por gira
export const listarConsumos        = (giraId)              => api.get(`/giras/${giraId}/consumption`);
export const registrarConsumo      = (giraId, data)        => api.post(`/giras/${giraId}/consumption`, data);
export const editarConsumo         = (giraId, cid, data)   => api.patch(`/giras/${giraId}/consumption/${cid}`, data);

// Finalização
export const finalizarGira         = (giraId)              => api.post(`/giras/${giraId}/finalizar`);
// (Outros endpoints podem ser adicionados aqui conforme necessário)