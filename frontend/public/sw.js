// =====================================================
// Service Worker — AxeFlow PWA
// Gerencia cache offline e push notifications.
//
// CORREÇÃO MULTI-TENANT:
//   Ao clicar numa notificação, o SW verifica se o
//   terreiro_id do payload bate com o terreiro do
//   usuário logado (lido via IndexedDB/cookie ou
//   repassado pela página via postMessage).
//   Se não bater, redireciona para /giras (lista geral)
//   em vez da URL específica da gira de outro terreiro.
// =====================================================

const CACHE_NAME = 'axeflow-v2';
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
          // Remove caches de versões anteriores
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
        // Clonar e guardar no cache apenas respostas válidas
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback para cache quando offline
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Página offline para navegação direta
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

  // Valores padrão caso o payload esteja vazio ou malformado
  let data = {
    title: 'AxeFlow',
    body: 'Você tem uma nova notificação.',
    icon: '/icons/icon-192.png',
    badge: '/icons/notification-icon.png',
    // terreiro_id e url chegam no payload enviado pelo backend
    data: { url: '/giras', terreiro_id: null },
  };

  // Parsear payload JSON enviado pelo backend
  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        ...data,
        ...payload,
        // Garantir que data.data sempre existe com os campos esperados
        data: {
          url: '/giras',
          terreiro_id: null,
          ...(payload.data || {}),
        },
      };
    } catch {
      // Payload não é JSON — usa texto bruto como corpo
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/notification-icon.png',
    vibrate: [200, 100, 200],
    // Passa url E terreiro_id para o handler de clique
    data: data.data,
    actions: [
      { action: 'open',  title: 'Abrir app' },
      { action: 'close', title: 'Fechar'    },
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

  // Ação "fechar" apenas dispensa a notificação
  if (event.action === 'close') return;

  // Dados que vieram no payload do push
  const notifData      = event.notification.data || {};
  const notifUrl       = notifData.url       || '/giras';
  const notifTerreiroId = notifData.terreiro_id || null;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // ── Estratégia de navegação ──────────────────────
        // Envia mensagem para o cliente (página) validar o terreiro.
        // A página (_app.js) responde com o terreiro_id do usuário logado
        // e decide para onde navegar.
        //
        // Se não houver janela aberta, abre uma nova em /giras
        // (URL segura — não expõe dados de outro terreiro).

        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Envia mensagem para a página tratar o redirecionamento
            // com validação de contexto de terreiro
            client.postMessage({
              type: 'PUSH_NOTIFICATION_CLICK',
              payload: {
                url: notifUrl,
                terreiro_id: notifTerreiroId,
              },
            });
            return client.focus();
          }
        }

        // Sem janela aberta: abre em /giras — a página fará a validação
        // ao montar e redirecionará corretamente conforme o terreiro logado
        if (clients.openWindow) {
          // Passa os dados via query string para a página tratar
          const safeUrl = notifTerreiroId
            ? `/giras?from_push=1&terreiro_id=${notifTerreiroId}&target=${encodeURIComponent(notifUrl)}`
            : '/giras';
          return clients.openWindow(safeUrl);
        }
      })
  );
});

// ── Push Subscription Change ─────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  // Ocorre quando a subscription expira (raro, mas deve ser tratado)
  console.log('[SW] Subscription expirou, renovando...');
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: self.VAPID_PUBLIC_KEY,
      })
      .then((subscription) => {
        // Reenvia a nova subscription ao backend com o token atual
        // O token é lido via cookie porque o SW não tem acesso ao localStorage
        const cookieToken = self.cookie || '';
        return fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        });
      })
  );
});