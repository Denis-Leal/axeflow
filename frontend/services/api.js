import axios from 'axios';

// Usa o proxy do Next.js (/api → backend:8000 internamente).
// Assim o celular nunca precisa acessar a porta 8000 diretamente.
// Funciona em qualquer rede, localhost ou IP local.
const API_URL = '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

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
          // Só redireciona se o token ainda foi removido (não houve refresh entre)
          localStorage.removeItem('token');
          window.location.href = '/login';
        }, 100);
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const login = (email, senha) => api.post('/auth/login', { email, senha });
export const register = (data) => api.post('/auth/register', data);
export const getMe = () => api.get('/auth/me');

// Giras
export const listGiras = () => api.get('/giras');
export const createGira = (data) => api.post('/giras', data);
export const getGira = (id) => api.get(`/giras/${id}`);
export const updateGira = (id, data) => api.put(`/giras/${id}`, data);
export const deleteGira = (id) => api.delete(`/giras/${id}`);

// Inscricoes
export const listInscricoes = (giraId) => api.get(`/giras/${giraId}/inscricoes`);
export const updatePresenca = (inscricaoId, status) =>
  api.patch(`/inscricao/${inscricaoId}/presenca`, { status });
export const cancelarInscricao = (inscricaoId) => api.delete(`/inscricao/${inscricaoId}`);

// Publico
export const getGiraPublica = (slug) => api.get(`/public/gira/${slug}`);
export const inscreverPublico = (slug, data) => api.post(`/public/gira/${slug}/inscrever`, data);
