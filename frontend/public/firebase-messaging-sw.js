// public/firebase-messaging-sw.js

importScripts("https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyDbrC_QQffBttmg0W2POqv41ls6Abb4BIA",//process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: "axeflow-6546a.firebaseapp.com", //process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: "axeflow-6546a", //process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: "axeflow-6546a.firebasestorage.app", //process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: "412400342317", //process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: "1:412400342317:web:1daa7a2f0e801e6bb92fa4", //process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: "G-GNC45K00S9"
});

// 🔥 CLICK HANDLER (fora!)
self.addEventListener('notificationclick', function(event) {
  const data = event.notification.data;

  event.notification.close();

  event.waitUntil(
    clients.openWindow(
      `${data.url}?from_push=1&terreiro_id=${data.terreiro_id}&target=${encodeURIComponent(data.url)}`
    )
  );
})