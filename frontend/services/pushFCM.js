import { getFCMToken } from "./firebase";

export async function registerDevice() {
  try{
      const token = await getFCMToken();
    
      if (!token) {
        console.warn('[Push] Token FCM não obtido');
        return;
      }
      localStorage.setItem('fcm_token', token); // Salva o token para uso futuro (ex: logout)
      const jwt = localStorage.getItem("token");
    
      await fetch("/api/push/devices/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        body: JSON.stringify({
          token,
          platform: "web",
        }),
      });
    
      console.log("[Push] Device registrado via FCM");
    } catch (err) {
      console.error("[Push] Falha ao registrar device:", err);
      throw err; // Re-throw para tratamento específico no login.js
    }
  }