import { useState, useEffect } from 'react';
import {
  isPushSupported,
  getNotificationPermission,
  activatePushNotifications,
  deactivatePushNotifications,
} from '../services/pushService';

export default function NotificationButton({ compact = false }) {
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [isHttps, setIsHttps] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Push só funciona em HTTPS (ou localhost)
    const secure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    setIsHttps(secure);
    if (!secure) { setStatus('http'); return; }

    if (!isPushSupported()) { setStatus('unsupported'); return; }

    const permission = getNotificationPermission();
    if (permission === 'granted') {
      navigator.serviceWorker.ready
        .then(reg => reg.pushManager.getSubscription())
        .then(sub => setStatus(sub ? 'active' : 'idle'))
        .catch(() => setStatus('idle'));
    } else if (permission === 'denied') {
      setStatus('denied');
    }
  }, []);

  const handleActivate = async () => {
    setStatus('loading');
    setMessage('');
    const result = await activatePushNotifications();
    if (result.success) {
      setStatus('active');
      setMessage('✓ Ativadas!');
    } else {
      setStatus(result.reason === 'denied' ? 'denied' : 'error');
      setMessage(result.message);
    }
  };

  const handleDeactivate = async () => {
    await deactivatePushNotifications();
    setStatus('idle');
    setMessage('');
  };

  // Em HTTP (IP local), mostrar aviso pequeno apenas no desktop; no mobile ocultar
  if (status === 'http') {
    if (compact) return null;
    return (
      <span title="Push Notifications requerem HTTPS" style={{ color: 'var(--cor-texto-suave)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        <i className="bi bi-lock" style={{ color: '#f59e0b' }}></i>
        <span className="d-none d-md-inline">Push requer HTTPS</span>
      </span>
    );
  }

  if (status === 'unsupported') return null;

  if (status === 'denied') {
    return (
      <span style={{ color: '#f59e0b', fontSize: compact ? '0.78rem' : '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        <i className="bi bi-bell-slash"></i>
        <span className="d-none d-md-inline">Notificações bloqueadas</span>
      </span>
    );
  }

  if (status === 'active') {
    return (
      <button onClick={handleDeactivate} style={compact ? styles.btnCompactActive : styles.btnActive}>
        <i className="bi bi-bell-fill"></i>
        {!compact && <span style={{ marginLeft: '0.4rem' }}>Notificações ativas</span>}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <button onClick={handleActivate} disabled={status === 'loading'} style={compact ? styles.btnCompact : styles.btnIdle}>
        {status === 'loading'
          ? <span className="spinner-border spinner-border-sm" style={{ width: '0.8rem', height: '0.8rem' }}></span>
          : <i className="bi bi-bell"></i>
        }
        {!compact && <span style={{ marginLeft: '0.4rem' }}>{status === 'loading' ? 'Ativando...' : 'Ativar notificações'}</span>}
      </button>
      {message && <span style={{ fontSize: '0.78rem', color: status === 'error' ? '#ef4444' : '#10b981' }}>{message}</span>}
    </div>
  );
}

const styles = {
  btnIdle: { background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.4)', color: '#d4af37', borderRadius: '8px', padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center' },
  btnActive: { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.4)', color: '#10b981', borderRadius: '8px', padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center' },
  btnCompact: { background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)', color: '#d4af37', borderRadius: '6px', padding: '0.35rem 0.55rem', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center' },
  btnCompactActive: { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', borderRadius: '6px', padding: '0.35rem 0.55rem', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center' },
};
