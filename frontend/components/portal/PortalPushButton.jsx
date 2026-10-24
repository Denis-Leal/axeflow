import { useEffect, useState } from "react";
import { getFCMToken } from "../../services/firebase";

export default function PortalPushButton({ terreiroSlug }) {
  const [state, setState] = useState("idle");

  useEffect(() => {
    async function loadStatus() {
      if (!("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      if (Notification.permission !== "granted") return;
      try {
        const token = await getFCMToken();
        if (!token) return setState("unsupported");
        const params = new URLSearchParams({ token, terreiro_slug: terreiroSlug });
        const response = await fetch(`/api/public/portal/push/subscriptions/status?${params}`);
        if (response.ok && (await response.json()).active) setState("active");
      } catch { /* Keep the neutral state until a confirmed registration. */ }
    }
    loadStatus();
  }, [terreiroSlug]);

  async function setSubscription(enable) {
    try {
      setState("working");
      if (enable && Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return setState("denied");
      }
      const token = await getFCMToken();
      if (!token) return setState("unsupported");
      const response = await fetch("/api/public/portal/push/subscriptions", {
        method: enable ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, terreiro_slug: terreiroSlug }),
      });
      if (!response.ok) throw new Error("subscription request failed");
      setState(enable ? "active" : "idle");
    } catch {
      setState("error");
    }
  }

  if (state === "unsupported") return <small className="d-block mt-3">Notificações não são compatíveis com este navegador.</small>;
  if (state === "denied") return <small className="d-block mt-3">As notificações estão bloqueadas nas configurações do navegador.</small>;
  return (
    <div className="mt-3">
      <p className="mb-2" style={{ color: "var(--cor-texto-suave)" }}>Receba avisos de novos comunicados e giras públicas.</p>
      <button className="btn-outline-gold" disabled={state === "working"} onClick={() => setSubscription(state !== "active")}>
        {state === "working" ? "Atualizando…" : state === "active" ? "Desativar notificações" : "Ativar notificações"}
      </button>
      {state === "error" && <small className="d-block mt-2">Não foi possível confirmar a inscrição. Tente novamente.</small>}
      <small className="d-block mt-2" style={{ color: "var(--cor-texto-suave)" }}>No iPhone e iPad, instale o portal na Tela de Início (iOS/iPadOS 16.4+).</small>
    </div>
  );
}
