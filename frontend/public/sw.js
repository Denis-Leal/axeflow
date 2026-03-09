// =====================================================
// Service Worker — AxeFlow PWA
// Gerencia cache offline e push notifications
// =====================================================

const CACHE_NAME = 'axeflow-v1';
const OFFLINE_URL = '/offline';

// Arquivos para cache inicial (shell do app)
const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/offline',
];

// ── Install ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Falha no precache (normal em dev):', err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch (Network First, fallback Cache) ────────────
self.addEventListener('fetch', (event) => {
  // Ignorar requests não-GET e requests de extensões
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // API requests: sempre network, sem cache
  if (event.request.url.includes('/api/') || event.request.url.includes(':8000')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clonar e guardar no cache
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback para cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Página offline para navegação
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
        });
      })
  );
});

// ── Push Notifications ───────────────────────────────
self.addEventListener('push', (event) => {
  console.log('[SW] Push recebido:', event);

  let data = {
    title: 'AxeFlow',
    body: 'Você tem uma nova notificação.',
    icon: '/icons/icon-192.png',
    badge: '/icons/notification-icon.png',
    data: { url: '/dashboard' },
  };

  // Tentar parsear payload JSON do push
  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/notification-icon.png',
    vibrate: [200, 100, 200],
    data: data.data || { url: '/dashboard' },
    actions: [
      {
        action: 'open',
        title: 'Abrir app',
      },
      {
        action: 'close',
        title: 'Fechar',
      },
    ],
    requireInteraction: false,
    silent: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── Notification Click ───────────────────────────────
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notificação clicada:', event.action);
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se já tem uma janela aberta, foca nela
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Senão abre nova janela
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ── Push Subscription Change ─────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Subscription expirou, renovando...');
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: self.VAPID_PUBLIC_KEY,
    }).then((subscription) => {
      return fetch('/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });
    })
  );
});
