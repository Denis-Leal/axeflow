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

export default function App({ Component, pageProps }) {
  const router = useRouter();
  // Ref para evitar múltiplos registros do listener entre re-renders
  const swListenerRegistered = useRef(false);

  useEffect(() => {
    // Bootstrap JS — carregado dinamicamente para evitar SSR crash
    require('bootstrap/dist/js/bootstrap.bundle.min.js');

    // ── Registrar Service Worker para PWA ──────────────
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[PWA] SW registrado:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Falha ao registrar SW:', err);
      });

    // ── Listener de clique em notificação push ─────────
    // Evita registrar múltiplas vezes em hot-reload (dev)
    if (swListenerRegistered.current) return;
    swListenerRegistered.current = true;

    const handleSwMessage = (event) => {
      // Só processa mensagens do tipo PUSH_NOTIFICATION_CLICK
      if (!event.data || event.data.type !== 'PUSH_NOTIFICATION_CLICK') return;

      const { url: targetUrl, terreiro_id: notifTerreiroId } = event.data.payload || {};

      console.log('[App] Push click recebido — url:', targetUrl, '| terreiro_id:', notifTerreiroId);

      // Recupera o terreiro do usuário logado (salvo no login)
      const userTerreiroId = localStorage.getItem('terreiro_id');

      if (!notifTerreiroId || !userTerreiroId) {
        // Sem informação de terreiro: navega para /giras (seguro)
        console.warn('[App] terreiro_id ausente — redirecionando para /giras');
        router.push('/giras');
        return;
      }

      if (notifTerreiroId === userTerreiroId) {
        // Mesmos terreiros: pode navegar para a URL específica da gira
        console.log('[App] Terreiro validado — navegando para:', targetUrl);
        router.push(targetUrl || '/giras');
      } else {
        // Terreiros diferentes: notificação chegou em dispositivo de outro terreiro
        // Redireciona para a lista de giras do terreiro logado (sem expor dados alheios)
        console.warn(
          '[App] Terreiro da notificação (%s) difere do usuário logado (%s) — redirecionando para /giras',
          notifTerreiroId,
          userTerreiroId
        );
        router.push('/giras');
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);

    // Cleanup ao desmontar (troca de página no Next.js)
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      swListenerRegistered.current = false;
    };
  }, []); // Executa apenas uma vez na montagem

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
      console.log('[App] Push via query — terreiro validado, navegando para:', target);
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
    </>
  );
}