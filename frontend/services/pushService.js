// =====================================================
// pushService.js — Terreiro SaaS
// Gerencia registro de SW e push subscriptions
// =====================================================

const API_URL = '/api';

// Chave pública VAPID gerada no backend
// IMPORTANTE: deve ser a mesma chave configurada no backend (.env)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BPVB0GWklvxVIo3GAtj2p1IDjZv1yTKSwVcwIWLCe3wygLbRDSJfOxSCvQd-ZUiTn-LvH0-jsPKflzlt4Tg8ufA';

/**
 * Converte a chave VAPID base64url para Uint8Array
 * necessário para pushManager.subscribe()
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Verifica se o browser suporta PWA/Push
 */
export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Retorna o estado atual da permissão de notificação
 */
export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

/**
 * Registra o service worker e retorna o registration
 */
export async function registerServiceWorker() {
  if (!isPushSupported()) {
    throw new Error('Service Worker ou Push não suportado neste browser');
  }
  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
  });
  console.log('[Push] Service Worker registrado:', registration.scope);
  // Aguardar o SW estar pronto
  await navigator.serviceWorker.ready;
  return registration;
}

/**
 * Solicita permissão de notificação ao usuário
 * Retorna: 'granted' | 'denied' | 'default'
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    throw new Error('Notificações não suportadas neste browser');
  }
  const permission = await Notification.requestPermission();
  console.log('[Push] Permissão de notificação:', permission);
  return permission;
}

/**
 * Cria ou recupera a push subscription do browser
 */
export async function subscribeToPush(registration) {
  const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

  // Verificar se já existe subscription
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
    console.log('[Push] Nova subscription criada');
  } else {
    console.log('[Push] Subscription já existente, reutilizando');
  }

  return subscription;
}

/**
 * Envia a subscription para o backend salvar
 */
export async function saveSubscriptionToBackend(subscription) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Erro ao salvar subscription no servidor');
  }

  return response.json();
}

/**
 * Fluxo completo: SW → Permissão → Subscription → Backend
 * Retorna objeto com status e detalhes
 */
export async function activatePushNotifications() {
  if (!isPushSupported()) {
    return { success: false, reason: 'unsupported', message: 'Seu browser não suporta notificações push.' };
  }

  // 1. Registrar SW
  let registration;
  try {
    registration = await registerServiceWorker();
  } catch (err) {
    return { success: false, reason: 'sw_error', message: 'Falha ao registrar o service worker: ' + err.message };
  }

  // 2. Pedir permissão
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    return {
      success: false,
      reason: 'denied',
      message: permission === 'denied'
        ? 'Permissão negada. Habilite nas configurações do browser.'
        : 'Permissão não concedida.',
    };
  }

  // 3. Criar subscription
  let subscription;
  try {
    subscription = await subscribeToPush(registration);
  } catch (err) {
    return { success: false, reason: 'subscription_error', message: 'Erro ao criar subscription: ' + err.message };
  }

  // 4. Salvar no backend
  try {
    await saveSubscriptionToBackend(subscription);
  } catch (err) {
    return { success: false, reason: 'backend_error', message: 'Erro ao salvar no servidor: ' + err.message };
  }

  return { success: true, message: 'Notificações ativadas com sucesso!' };
}

/**
 * Desativa notificações (remove subscription)
 */
export async function deactivatePushNotifications() {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
    console.log('[Push] Subscription removida');
  }
}
