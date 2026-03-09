import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../styles/globals.css';
import { useEffect } from 'react';
import Head from 'next/head';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Bootstrap JS
    require('bootstrap/dist/js/bootstrap.bundle.min.js');

    // Registrar Service Worker para PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((reg) => console.log('[PWA] SW registrado:', reg.scope))
        .catch((err) => console.warn('[PWA] Falha SW:', err));
    }
  }, []);

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
      <Component {...pageProps} />
    </>
  );
}
