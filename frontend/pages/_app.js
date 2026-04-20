// =====================================================
// _app.js — AxeFlow
// Entry point global do Next.js.
//
// CORREÇÃO MULTI-TENANT (push notifications):
//   Registra um listener de mensagens do Service Worker.
//   Quando o usuário clica numa notificação push, o SW
//   envia { type: 'PUSH_NOTIFICATION_CLICK', payload }
//   com a url e o terreiro_id da notificação.
//   Esta página valida se o terreiro_id bate com o
//   usuário logado antes de navegar para a URL específica.
//   Se não bater, redireciona para /giras (seguro).
// =====================================================

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../styles/globals.css';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { GiraProvider } from '../contexts/GiraContext';
import Head from 'next/head';
import { getFirebaseMessaging } from "../services/firebase";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function App({ Component, pageProps }) {
  const router = useRouter();
  // Ref para evitar múltiplos registros do listener entre re-renders
  const swListenerRegistered = useRef(false);
useEffect(() => {
  async function setupFCM() {
    if (typeof window === "undefined") return;

    const messaging = await getFirebaseMessaging();
    if (!messaging) return;

    const { onMessage } = await import("firebase/messaging");

    onMessage(messaging, (payload) => {
      console.log("[Push] Recebida em foreground:", payload.data);

      const data = payload.data || {};
      const userTerreiroId = localStorage.getItem("terreiro_id");

      if (data.terreiro_id && data.terreiro_id !== userTerreiroId) {
        return;
      }

      if (Notification.permission === "granted") {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(data.title, {
            body: data.body,
            icon: '/icons/icon-192.png',
            data
          });
        });
      }
    });
  }

  setupFCM();
}, []);

useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .then((registration) => {
        console.log('[SW] registrado:');
      })
      .catch((err) => {
        console.error('[SW] erro ao registrar:');
      });
  }
}, []);

useEffect(() => {
  const channel = new BroadcastChannel('push_channel');

  channel.onmessage = (event) => {
    const { type, data } = event.data || {};

    if (type !== 'PUSH_FOREGROUND') return;

    console.log('[Push] via BroadcastChannel:', data);

    const userTerreiroId = localStorage.getItem("terreiro_id");

    if (data.terreiro_id && data.terreiro_id !== userTerreiroId) {
      return;
    }

    // 👉 Aqui você controla UX
    // Pode usar toast, modal, etc

    if (confirm(`${data.title}\n${data.body}\n\nAbrir?`)) {
      router.push(data.url || "/giras");
    }
  };

  return () => channel.close();
}, []);
  // ── Handler para abertura via query string ─────────
  // Cobre o caso de abertura em nova aba (sem janela aberta)
  // SW abre /giras?from_push=1&terreiro_id=X&target=URL
  useEffect(() => {
    if (!router.isReady) return;
    const { from_push, terreiro_id: notifTerreiroId, target } = router.query;

    if (from_push !== '1' || !notifTerreiroId || !target) return;

    const userTerreiroId = localStorage.getItem('terreiro_id');

    // Remove os parâmetros de controle da URL (limpeza de URL)
    const cleanQuery = { ...router.query };
    delete cleanQuery.from_push;
    delete cleanQuery.terreiro_id;
    delete cleanQuery.target;

    if (userTerreiroId && notifTerreiroId === userTerreiroId) {
      // Terreiro validado — navega para a URL alvo da notificação
      // console.log('[App] Push via query — terreiro validado, navegando para:', target);
      router.replace(decodeURIComponent(target));
    } else {
      // Terreiro inválido — fica em /giras sem parâmetros extras
      console.warn('[App] Push via query — terreiro inválido, limpando URL');
      router.replace('/giras');
    }
  }, [router.isReady, router.query]);

  return (
    <>
      <Head>
        <meta name="application-name" content="AxeFlow" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Terreiro" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#1e1040" />
        <link rel="icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
      </Head>
      {/*
        GiraProvider envolve toda a aplicação para que qualquer página
        possa ler/escrever a gira ativa via useGiraAtual().
      */}
      <GiraProvider>
        <Component {...pageProps} />
      </GiraProvider>
      {/* ✅ AQUI é o lugar certo */}
      <ToastContainer
        position="top-center"
        autoClose={2500}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        draggable
        theme="dark"
        toastClassName="toast-custom"
        bodyClassName="toast-body-custom"
        progressClassName="toast-progress-custom"
      />
    </>
  );
}