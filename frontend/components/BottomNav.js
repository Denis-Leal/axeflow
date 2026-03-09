import Link from 'next/link';
import { useRouter } from 'next/router';

export default function BottomNav() {
  const router = useRouter();
  const p = router.pathname;

  return (
    <nav className="bottom-nav">
      <Link href="/dashboard" className={p === '/dashboard' ? 'active' : ''}>
        <i className="bi bi-speedometer2"></i>
        <span>Início</span>
      </Link>
      <Link href="/giras" className={p.startsWith('/giras') ? 'active' : ''}>
        <i className="bi bi-stars"></i>
        <span>Giras</span>
      </Link>
      <Link href="/giras/nova" className={p === '/giras/nova' ? 'active' : ''} style={{
        flex: 'none',
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: 'var(--cor-acento)',
        color: 'var(--cor-primaria)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 8px',
        alignSelf: 'center',
        borderTop: 'none',
        boxShadow: '0 4px 12px rgba(212,175,55,0.4)',
      }}>
        <i className="bi bi-plus-lg" style={{ fontSize: '1.4rem', color: '#1a0a2e' }}></i>
      </Link>
      <Link href="/consulentes" className={p === '/consulentes' ? 'active' : ''}>
        <i className="bi bi-people"></i>
        <span>Consulentes</span>
      </Link>
      <Link href="/configuracoes" className={p === '/configuracoes' ? 'active' : ''}>
        <i className="bi bi-gear"></i>
        <span>Config</span>
      </Link>
    </nav>
  );
}
