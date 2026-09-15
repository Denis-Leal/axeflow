// =====================================================
// BottomNav.js — AxeFlow
// Barra de navegação inferior (mobile).
//
// Estrutura:
//   Início | Giras | + | Agendamentos | Mais
//
// "Mais" concentra funções administrativas e secundárias.
// O botão "+" concentra ações de criação rápida.
// =====================================================

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

// Páginas que ativam o botão "Mais" quando acessadas
const PAGINAS_MAIS = [
  '/membros',
  '/consulentes',
  '/atendimentos',
  '/configuracoes',
  '/contato',
  '/sobre',
  '/api-docs',
  '/inventario',
  '/estoque',
];

// Itens administrativos/secundários
const ITENS_MAIS = [
  {
    href: '/consulentes',
    icon: 'bi-people',
    label: 'Consulentes',
  },
  {
    href: '/membros',
    icon: 'bi-person-badge',
    label: 'Membros',
  },
  {
    href: '/atendimentos',
    icon: 'bi-calendar2-heart',
    label: 'Atendimentos',
  },
  {
    href: '/inventario',
    icon: 'bi-box-seam',
    label: 'Estoque',
  },
];

// Itens de administração
const ITENS_ADMINISTRACAO = [
  {
    href: '/configuracoes',
    icon: 'bi-gear',
    label: 'Configurações',
  },
];

// Itens relacionados ao sistema
const ITENS_SISTEMA = [
  {
    href: '/api-docs',
    icon: 'bi-code-slash',
    label: 'API & Integrações',
  },
  {
    href: '/contato',
    icon: 'bi-chat-dots',
    label: 'Contato',
  },
  {
    href: '/sobre',
    icon: 'bi-info-circle',
    label: 'Sobre',
  },
];

export default function BottomNav() {
  const router = useRouter();
  const p = router.pathname;

  const [maisAberto, setMaisAberto] = useState(false);
  const [criarAberto, setCriarAberto] = useState(false);

  // Verifica se a página atual pertence ao grupo "Mais"
  const maisAtivo = PAGINAS_MAIS.some(pg => p.startsWith(pg));

  const fecharMenus = () => {
    setMaisAberto(false);
    setCriarAberto(false);
  };

  const toggleMais = () => {
    setCriarAberto(false);
    setMaisAberto(v => !v);
  };

  const toggleCriar = () => {
    setMaisAberto(false);
    setCriarAberto(v => !v);
  };

  const renderItem = (item) => {
    const ativo = p === item.href || p.startsWith(`${item.href}/`);

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={fecharMenus}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          textDecoration: 'none',
          color: ativo
            ? 'var(--cor-acento)'
            : 'var(--cor-texto)',
          background: ativo
            ? 'rgba(212,175,55,0.08)'
            : 'transparent',
          fontSize: '0.9rem',
        }}
      >
        <i
          className={`bi ${item.icon}`}
          style={{ fontSize: '1.1rem' }}
        ></i>

        {item.label}
      </Link>
    );
  };

  return (
    <>
      {/* =================================================
          Overlay
          ================================================= */}
      {(maisAberto || criarAberto) && (
        <div
          onClick={fecharMenus}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 199,
            background: 'rgba(0,0,0,0.4)',
          }}
        />
      )}

      {/* =================================================
          Menu de criação rápida
          ================================================= */}
      {criarAberto && (
        <div
          style={{
            position: 'fixed',
            bottom: '68px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--cor-card)',
            border: '1px solid var(--cor-borda)',
            borderRadius: '14px',
            padding: '0.5rem',
            zIndex: 300,
            minWidth: '220px',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
          }}
        >
          <Link
            href="/giras/nova"
            onClick={fecharMenus}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              textDecoration: 'none',
              color: 'var(--cor-texto)',
              fontSize: '0.9rem',
            }}
          >
            <i
              className="bi bi-stars"
              style={{ fontSize: '1.1rem' }}
            ></i>
            Nova Gira
          </Link>

          <Link
            href="/agendamentos?action=novo"
            onClick={fecharMenus}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              textDecoration: 'none',
              color: 'var(--cor-texto)',
              fontSize: '0.9rem',
            }}
          >
            <i
              className="bi bi-calendar-plus"
              style={{ fontSize: '1.1rem' }}
            />
            Novo Agendamento
          </Link>
        </div>
      )}

      {/* =================================================
          Menu "Mais"
          ================================================= */}
      {maisAberto && (
        <div
          style={{
            position: 'fixed',
            bottom: '68px',
            right: '8px',
            background: 'var(--cor-card)',
            border: '1px solid var(--cor-borda)',
            borderRadius: '14px',
            padding: '0.5rem',
            zIndex: 300,
            minWidth: '220px',
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
          }}
        >
          {/* =========================
              Cadastros
              ========================= */}
          <div
            style={{
              padding: '0.5rem 1rem 0.25rem',
              fontSize: '0.65rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: 'var(--cor-texto-suave)',
              textTransform: 'uppercase',
            }}
          >
            Cadastros
          </div>

          {ITENS_MAIS.map(renderItem)}

          {/* Separador */}
          <div
            style={{
              height: '1px',
              background: 'var(--cor-borda)',
              margin: '0.35rem 0.5rem',
            }}
          />

          {/* =========================
              Administração
              ========================= */}
          <div
            style={{
              padding: '0.5rem 1rem 0.25rem',
              fontSize: '0.65rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: 'var(--cor-texto-suave)',
              textTransform: 'uppercase',
            }}
          >
            Administração
          </div>

          {ITENS_ADMINISTRACAO.map(renderItem)}

          {/* Separador */}
          <div
            style={{
              height: '1px',
              background: 'var(--cor-borda)',
              margin: '0.35rem 0.5rem',
            }}
          />

          {/* =========================
              Sistema
              ========================= */}
          <div
            style={{
              padding: '0.5rem 1rem 0.25rem',
              fontSize: '0.65rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: 'var(--cor-texto-suave)',
              textTransform: 'uppercase',
            }}
          >
            Sistema
          </div>

          {ITENS_SISTEMA.map(renderItem)}
        </div>
      )}

      {/* =================================================
          Barra de navegação inferior
          ================================================= */}
      <nav className="bottom-nav">

        {/* Início */}
        <Link
          href="/dashboard"
          className={p === '/dashboard' ? 'active' : ''}
        >
          <i className="bi bi-speedometer2"></i>
          <span>Início</span>
        </Link>

        {/* Giras */}
        <Link
          href="/giras"
          className={p.startsWith('/giras') ? 'active' : ''}
        >
          <i className="bi bi-stars"></i>
          <span>Giras</span>
        </Link>

        {/* =================================================
            Botão central: Criar
            ================================================= */}
        <button
          onClick={toggleCriar}
          aria-label="Criar"
          style={{
            flex: 'none',
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'var(--cor-acento)',
            color: '#1a0a2e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 4px',
            alignSelf: 'center',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(212,175,55,0.4)',
            transform: criarAberto ? 'rotate(45deg)' : 'none',
            transition: 'transform 0.2s ease',
          }}
        >
          <i
            className="bi bi-plus-lg"
            style={{ fontSize: '1.3rem' }}
          ></i>
        </button>

        {/* Agendamentos */}
        <Link
          href="/agendamentos"
          className={
            p.startsWith('/agendamentos')
              ? 'active'
              : ''
          }
        >
          <i className="bi bi-calendar-check"></i>
          <span>Agendamentos</span>
        </Link>

        {/* Mais */}
        <button
          onClick={toggleMais}
          className={maisAtivo ? 'active' : ''}
          aria-label="Mais"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color:
              maisAtivo || maisAberto
                ? 'var(--cor-acento)'
                : 'var(--cor-texto-suave)',
            fontSize: '0.6rem',
            gap: '2px',
            borderTop:
              maisAtivo || maisAberto
                ? '2px solid var(--cor-acento)'
                : '2px solid transparent',
            padding: '0',
          }}
        >
          <i
            className="bi bi-three-dots"
            style={{ fontSize: '1.2rem' }}
          ></i>
          <span>Mais</span>
        </button>

      </nav>
    </>
  );
}