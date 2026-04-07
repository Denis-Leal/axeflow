// =====================================================
// BottomNav.js — AxeFlow
// Barra de navegação inferior (mobile).
//
// ALTERAÇÃO: adicionados links /contato e /sobre
//   na gaveta "Mais", junto com Membros e Configurações.
//   Mantém o comportamento de fechar a gaveta ao clicar.
// =====================================================

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

// Páginas que ativam o botão "Mais" quando acessadas
const PAGINAS_MAIS = ['/inventario', '/membros', '/configuracoes', '/contato', '/sobre', '/api-docs'];

export default function BottomNav() {
  const router = useRouter();
  const p = router.pathname;
  const [maisAberto, setMaisAberto] = useState(false);

  // Verifica se a página atual pertence ao grupo "Mais"
  const maisAtivo = PAGINAS_MAIS.includes(p);

  // Itens da gaveta "Mais" — centralizados para facilitar manutenção
  const itensMais = [
    { href: '/inventario',    icon: 'bi-box-seam',     label: 'Inventário' },
    { href: '/membros',       icon: 'bi-person-badge', label: 'Membros' },
    { href: '/configuracoes', icon: 'bi-gear',         label: 'Configurações' },
    { href: '/api-docs',      icon: 'bi-code-slash',   label: 'API & Integrações' },
    { href: '/contato',       icon: 'bi-chat-dots',    label: 'Contato' },
    { href: '/sobre',         icon: 'bi-info-circle',  label: 'Sobre' },
  ];

  return (
    <>
      {/* ── Overlay: fecha a gaveta ao clicar fora ── */}
      {maisAberto && (
        <div
          onClick={() => setMaisAberto(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 199,
            background: 'rgba(0,0,0,0.4)',
          }}
        />
      )}

      {/* ── Gaveta "Mais" ── */}
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
          minWidth: '190px',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
        }}>
          {itensMais.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMaisAberto(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1rem', borderRadius: '10px', textDecoration: 'none',
                color: p === item.href ? 'var(--cor-acento)' : 'var(--cor-texto)',
                background: p === item.href ? 'rgba(212,175,55,0.08)' : 'transparent',
                fontSize: '0.9rem',
              }}
            >
              <i className={`bi ${item.icon}`} style={{ fontSize: '1.1rem' }}></i>
              {item.label}
            </Link>
          ))}
        </div>
      )}

      {/* ── Barra de navegação inferior ── */}
      <nav className="bottom-nav">
        <Link href="/dashboard" className={p === '/dashboard' ? 'active' : ''}>
          <i className="bi bi-speedometer2"></i>
          <span>Início</span>
        </Link>

        <Link href="/giras" className={p.startsWith('/giras') ? 'active' : ''}>
          <i className="bi bi-stars"></i>
          <span>Giras</span>
        </Link>

        {/* Botão central: Nova Gira */}
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

        {/* Botão "Mais" — abre gaveta com itens secundários */}
        <button
          onClick={() => setMaisAberto(v => !v)}
          className={maisAtivo ? 'active' : ''}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            color: (maisAtivo || maisAberto) ? 'var(--cor-acento)' : 'var(--cor-texto-suave)',
            fontSize: '0.6rem', gap: '2px',
            borderTop: (maisAtivo || maisAberto)
              ? '2px solid var(--cor-acento)'
              : '2px solid transparent',
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