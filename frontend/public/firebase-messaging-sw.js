importScripts("https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js");

firebase.initializeApp({ apiKey: "AIzaSyDbrC_QQffBttmg0W2POqv41ls6Abb4BIA", authDomain: "axeflow-6546a.firebaseapp.com", projectId: "axeflow-6546a", storageBucket: "axeflow-6546a.firebasestorage.app", messagingSenderId: "412400342317", appId: "1:412400342317:web:1daa7a2f0e801e6bb92fa4" });
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  self.registration.showNotification(data.title || "AxeFlow", { body: data.body || "", icon: data.icon || "/icons/icon-192.png", badge: "/icons/notification-icon.png", data: { url: data.url || "/", context: data.context || "internal" } });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const portal = data.context === "portal";
  const fallback = portal ? "/portal" : "/giras";
  let target;
  try {
    const candidate = new URL(data.url || fallback, self.location.origin);
    target = candidate.origin === self.location.origin && (!portal || candidate.pathname.startsWith("/portal")) ? candidate : new URL(fallback, self.location.origin);
  } catch (_) { target = new URL(fallback, self.location.origin); }
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url === target.href);
    return existing ? existing.focus() : clients.openWindow(target.href);
  }));
});
