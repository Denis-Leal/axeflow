import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

console.log("FIREBASE CONFIG:", firebaseConfig);

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

let messaging = null;

export async function getFirebaseMessaging() {
  const supported = await isSupported();
  if (!supported) return null;

  if (!messaging) {
    messaging = getMessaging(app);
  }

  return messaging;
}

export async function getFCMToken() {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return null;

  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
  });

  return token;
}