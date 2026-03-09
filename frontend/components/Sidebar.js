import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getMe } from '../services/api';

export default function Sidebar() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    getMe().then(r => setUser(r.data)).catch(() => {});
  }, []);

  const isActive = (path) => router.pathname.startsWith(path) ? 'active' : '';

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>☽✦☾</div>
        <h4>Terreiro SaaS</h4>
        {user && <small>{user.terreiro_nome}</small>}
      </div>

      <nav className="sidebar-nav">
        <Link href="/dashboard" className={`nav-item-custom ${isActive('/dashboard')}`}>
          <i className="bi bi-speedometer2"></i> Dashboard
        </Link>
        <Link href="/giras" className={`nav-item-custom ${isActive('/giras')}`}>
          <i className="bi bi-stars"></i> Giras
        </Link>
        <Link href="/consulentes" className={`nav-item-custom ${isActive('/consulentes')}`}>
          <i className="bi bi-people"></i> Consulentes
        </Link>
        <Link href="/membros" className={`nav-item-custom ${isActive('/membros')}`}>
          <i className="bi bi-person-badge"></i> Membros
        </Link>
        <div className="divider-ornamental" style={{ margin: '1rem 1.5rem' }}>
          <span style={{ fontSize: '0.7rem' }}>✦</span>
        </div>
        <Link href="/configuracoes" className={`nav-item-custom ${isActive('/configuracoes')}`}>
          <i className="bi bi-gear"></i> Configurações
        </Link>
      </nav>

      <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--cor-borda)' }}>
        {user && (
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--cor-texto)' }}>{user.nome}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--cor-texto-suave)' }}>{user.email}</div>
          </div>
        )}
        <button onClick={handleLogout} className="btn-outline-gold w-100" style={{ fontSize: '0.85rem' }}>
          <i className="bi bi-box-arrow-right me-1"></i> Sair
        </button>
      </div>
    </aside>
  );
}
