import { getFCMToken } from "./firebase";

export async function registerDevice() {
  const token = await getFCMToken();

  if (!token) {
    console.warn("FCM não suportado neste browser");
    return;
  }

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
}