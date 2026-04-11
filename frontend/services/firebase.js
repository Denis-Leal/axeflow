import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

  const firebaseConfig = {
    apiKey: "AIzaSyDbrC_QQffBttmg0W2POqv41ls6Abb4BIA",//process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: "axeflow-6546a.firebaseapp.com", //process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: "axeflow-6546a", //process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: "axeflow-6546a.firebasestorage.app", //process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: "412400342317", //process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: "1:412400342317:web:1daa7a2f0e801e6bb92fa4", //process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: "G-GNC45K00S9"
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