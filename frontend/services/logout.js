// =====================================================
// logout.js — AxeFlow
// Helper centralizado de logout.
//
// Centraliza toda a lógica de encerramento de sessão:
//   1. Remove a push subscription do browser E avisa o backend
//   2. Limpa token e terreiro_id do localStorage
//   3. Redireciona para /login
//
// Uso:
//   import { logout } from '../services/logout';
//   await logout(router);
//
// IMPORTANTE: usar sempre esta função ao invés de
//   localStorage.removeItem('token') diretamente,
//   para garantir que as notificações push sejam
//   desvinculadas antes de trocar de conta.
// =====================================================
const API_URL = '/api';

/**
 * Remove a subscription do backend (best-effort).
 * Não lança exceção — falha silenciosa para não bloquear o logout.
 */
async function removePushDataFromBackend() {
  try {
    const token = localStorage.getItem('token');
    const fcmToken = localStorage.getItem('fcm_token'); // 🔥 precisa existir

    // ───────────────
    // 1. Remove FCM device
    // ───────────────
    if (fcmToken) {
      await fetch(`${API_URL}/push/devices/unregister`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ token: fcmToken }),
      });
    }

    // ───────────────
    // 2. Remove WebPush subscription (browser)
    // ───────────────
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
      }
    }

    console.log('[Logout] Push removido');
  } catch (err) {
    console.warn('[Logout] Falha ao remover push:', err);
  }
}
/**
 * Executa o logout completo:
 *   - Desativa push (remove subscription do browser e do backend)
 *   - Limpa localStorage (token + terreiro_id)
 *   - Redireciona para /login
 *
 * @param {import('next/router').NextRouter} router - instância do useRouter()
 */
export async function logout(router) {
  // 1. Remove subscription de push (assíncrono, best-effort)
  await removePushDataFromBackend();

  // 2. Limpa todos os dados de sessão do localStorage
  localStorage.removeItem('token');
  localStorage.removeItem('terreiro_id');

  // 3. Redireciona para login
  router.push('/login');
}