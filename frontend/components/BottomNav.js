import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function BottomNav() {
  const router = useRouter();
  const p = router.pathname;
  const [maisAberto, setMaisAberto] = useState(false);

  return (
    <>
      {/* Overlay para fechar o menu "Mais" */}
      {maisAberto && (
        <div
          onClick={() => setMaisAberto(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 199,
            background: 'rgba(0,0,0,0.4)',
          }}
        />
      )}

      {/* Gaveta "Mais" */}
      {maisAberto && (
        <div style={{
          position: 'fixed',
          bottom: '68px',
          right: '8px',
          background: 'var(--cor-card)',
          border: '1px solid var(--cor-borda)',
          borderRadius: '14px',
          padding: '0.5rem',
          zIndex: 300,
          minWidth: '180px',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
        }}>
          <Link
            href="/membros"
            onClick={() => setMaisAberto(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.75rem 1rem', borderRadius: '10px', textDecoration: 'none',
              color: p === '/membros' ? 'var(--cor-acento)' : 'var(--cor-texto)',
              background: p === '/membros' ? 'rgba(212,175,55,0.08)' : 'transparent',
              fontSize: '0.9rem',
            }}
          >
            <i className="bi bi-person-badge" style={{ fontSize: '1.1rem' }}></i>
            Membros
          </Link>
          <Link
            href="/configuracoes"
            onClick={() => setMaisAberto(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.75rem 1rem', borderRadius: '10px', textDecoration: 'none',
              color: p === '/configuracoes' ? 'var(--cor-acento)' : 'var(--cor-texto)',
              background: p === '/configuracoes' ? 'rgba(212,175,55,0.08)' : 'transparent',
              fontSize: '0.9rem',
            }}
          >
            <i className="bi bi-gear" style={{ fontSize: '1.1rem' }}></i>
            Configurações
          </Link>
        </div>
      )}

      {/* Barra de navegação inferior */}
      <nav className="bottom-nav">
        <Link href="/dashboard" className={p === '/dashboard' ? 'active' : ''}>
          <i className="bi bi-speedometer2"></i>
          <span>Início</span>
        </Link>

        <Link href="/giras" className={p.startsWith('/giras') ? 'active' : ''}>
          <i className="bi bi-stars"></i>
          <span>Giras</span>
        </Link>

        {/* Botão central + Nova Gira */}
        <Link
          href="/giras/nova"
          style={{
            flex: 'none', width: '52px', height: '52px', borderRadius: '50%',
            background: 'var(--cor-acento)', color: '#1a0a2e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 4px', alignSelf: 'center',
            borderTop: 'none',
            boxShadow: '0 4px 12px rgba(212,175,55,0.4)',
          }}
        >
          <i className="bi bi-plus-lg" style={{ fontSize: '1.3rem' }}></i>
        </Link>

        <Link href="/consulentes" className={p === '/consulentes' ? 'active' : ''}>
          <i className="bi bi-people"></i>
          <span>Consulentes</span>
        </Link>

        {/* Menu Mais */}
        <button
          onClick={() => setMaisAberto(v => !v)}
          className={p === '/membros' || p === '/configuracoes' ? 'active' : ''}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            color: (p === '/membros' || p === '/configuracoes' || maisAberto)
              ? 'var(--cor-acento)' : 'var(--cor-texto-suave)',
            fontSize: '0.6rem', gap: '2px',
            borderTop: (p === '/membros' || p === '/configuracoes' || maisAberto)
              ? '2px solid var(--cor-acento)' : '2px solid transparent',
            padding: '0',
          }}
        >
          <i className="bi bi-three-dots" style={{ fontSize: '1.2rem' }}></i>
          <span>Mais</span>
        </button>
      </nav>
    </>
  );
}
