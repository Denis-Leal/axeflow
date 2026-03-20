/**
 * pages/sobre.js — AxeFlow
 *
 * Página "Sobre" com informações do aplicativo:
 *   - Versão atual e histórico de versões
 *   - Fabricante (dbl_tech)
 *   - Stack tecnológica
 *   - Informações legais e de suporte
 *   - Links úteis
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import api from '../services/api';

// ── Metadados do app ──────────────────────────────────────────────────────────
const APP_INFO = {
  nome:        'AxeFlow',
  versao:      '1.0.0',
  build:       '2026.03.20',
  descricao:   'Sistema de gestão de giras para terreiros de Umbanda e Candomblé.',
  fabricante:  'dbl_tech',
  contato_dev: 'denis.leal07@gmail.com',
  site:        'https://axeflow.vercel.app',
  ano:         2026,
};

// ── Histórico de versões (changelog resumido) ─────────────────────────────────
const CHANGELOG = [
  {
    versao: '1.0.0',
    data:   'Mar 2026',
    status: 'atual',
    itens: [
      'Lançamento oficial do AxeFlow',
      'Gestão completa de giras públicas e fechadas',
      'Lista de espera com promoção automática',
      'Score de confiabilidade de consulentes',
      'Push notifications (PWA)',
      'Separação de inscrições: consulentes × membros',
      'Auditoria completa de eventos',
      'Suporte a múltiplos terreiros (multi-tenant)',
    ],
  },
  {
    versao: '0.9.0',
    data:   'Fev 2026',
    status: 'anterior',
    itens: [
      'Sistema de presença de membros em giras públicas',
      'Notas internas por consulente',
      'Observações no formulário público',
      'Integração WhatsApp para notificação de promovidos',
    ],
  },
  {
    versao: '0.8.0',
    data:   'Jan 2026',
    status: 'anterior',
    itens: [
      'PWA: instalável no Android e iOS',
      'Modo offline com cache do service worker',
      'Notificações push via VAPID',
    ],
  },
];

// ── Stack tecnológico ─────────────────────────────────────────────────────────
const STACK = [
  { categoria: 'Frontend',   itens: ['Next.js 14', 'React 18', 'Bootstrap 5'] },
  { categoria: 'Backend',    itens: ['FastAPI', 'Python 3.11', 'SQLAlchemy 2'] },
  { categoria: 'Banco',      itens: ['PostgreSQL 16', 'Alembic'] },
  { categoria: 'Infra',      itens: ['Vercel (frontend)', 'Render (backend)', 'Docker'] },
  { categoria: 'Segurança',  itens: ['JWT', 'bcrypt', 'CORS', 'Rate Limiting'] },
  { categoria: 'Push',       itens: ['Web Push API', 'VAPID', 'Service Worker'] },
];

// ── Componente: badge de versão ───────────────────────────────────────────────
function BadgeVersao({ status }) {
  const estilos = {
    atual:    { bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.4)',  text: '#10b981', label: 'atual' },
    anterior: { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.25)', text: '#94a3b8', label: 'anterior' },
  };
  const s = estilos[status] || estilos.anterior;
  return (
    <span style={{
      fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
      borderRadius: '20px', padding: '1px 8px',
    }}>
      {s.label}
    </span>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Sobre() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [healthInfo, setHealthInfo] = useState(null);  // status do backend

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    // Carrega status do backend para exibir na tela Sobre
    api.get('/health')
      .then(r => setHealthInfo(r.data))
      .catch(() => setHealthInfo(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner-gold"></div>
    </div>
  );

  return (
    <>
      <Head><title>Sobre | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">

          {/* ── Topbar ── */}
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>
                Sobre
              </h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>
                Informações do aplicativo
              </small>
            </div>
          </div>

          <div className="page-content">
            <div style={{ maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* ── Card principal: identidade do app ── */}
              <div className="card-custom" style={{ overflow: 'hidden' }}>

                {/* Banner decorativo */}
                <div style={{
                  background: 'linear-gradient(135deg, #1a0a2e 0%, #2d0a5e 50%, #1a0a2e 100%)',
                  padding: '2rem',
                  textAlign: 'center',
                  position: 'relative',
                  borderBottom: '1px solid var(--cor-borda)',
                }}>
                  {/* Efeito de brilho central */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'radial-gradient(ellipse at center, rgba(212,175,55,0.08) 0%, transparent 70%)',
                    pointerEvents: 'none',
                  }} />

                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem', position: 'relative' }}>
                    ☽✦☾
                  </div>
                  <h2 style={{
                    fontFamily: 'Cinzel', color: 'var(--cor-acento)',
                    fontSize: '1.75rem', letterSpacing: '4px', margin: '0 0 0.25rem',
                    position: 'relative',
                  }}>
                    {APP_INFO.nome}
                  </h2>
                  <div style={{ color: 'var(--cor-texto-suave)', fontSize: '0.8rem', letterSpacing: '2px', position: 'relative' }}>
                    SISTEMA DE GESTÃO DE GIRAS
                  </div>

                  {/* Badge de versão */}
                  <div style={{ marginTop: '1rem', position: 'relative' }}>
                    <span style={{
                      background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)',
                      color: 'var(--cor-acento)', borderRadius: '20px',
                      padding: '0.3rem 1rem', fontSize: '0.82rem', fontWeight: 600,
                    }}>
                      v{APP_INFO.versao} · Build {APP_INFO.build}
                    </span>
                  </div>
                </div>

                {/* Descrição e info básica */}
                <div style={{ padding: '1.5rem' }}>
                  <p style={{
                    color: 'var(--cor-texto-suave)', fontSize: '0.92rem', lineHeight: 1.7,
                    marginBottom: '1.5rem', textAlign: 'center',
                  }}>
                    {APP_INFO.descricao}
                  </p>

                  {/* Grid de informações */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1px', background: 'var(--cor-borda)',
                    border: '1px solid var(--cor-borda)', borderRadius: '10px', overflow: 'hidden',
                  }}>
                    {[
                      { label: 'Versão',       valor: `v${APP_INFO.versao}` },
                      { label: 'Build',         valor: APP_INFO.build },
                      { label: 'Fabricante',    valor: APP_INFO.fabricante },
                      { label: 'Lançamento',    valor: `${APP_INFO.ano}` },
                    ].map(info => (
                      <div key={info.label} style={{
                        background: 'var(--cor-card)', padding: '1rem',
                        display: 'flex', flexDirection: 'column', gap: '4px',
                      }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--cor-texto-suave)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {info.label}
                        </span>
                        <span style={{ fontSize: '0.95rem', color: 'var(--cor-acento)', fontWeight: 700, fontFamily: 'Cinzel' }}>
                          {info.valor}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Status do sistema (exibe apenas se healthInfo disponível) ── */}
              {healthInfo && (
                <div className="card-custom">
                  <div className="card-header">
                    <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                      ✦ Status do Sistema
                    </span>
                    {/* Indicador geral de saúde */}
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: '0.75rem', fontWeight: 600,
                      color: healthInfo.status === 'healthy' ? '#10b981' : '#f59e0b',
                    }}>
                      {healthInfo.status === 'healthy' ? '● Operacional' : '● Degradado'}
                    </span>
                  </div>
                  <div style={{
                    padding: '1rem 1.25rem',
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '0.6rem',
                  }}>
                    {Object.entries({
                      'Banco de dados':     healthInfo.database,
                      'Email (Brevo)':      healthInfo.email_service,
                      'Push Notifications': healthInfo.push_service,
                      'Job de limpeza':     healthInfo.cleanup_scheduler,
                    }).map(([servico, status]) => {
                      // Define cor com base no status do serviço
                      const ok = status === 'ok' || status === 'configured' || status === 'running';
                      return (
                        <div key={servico} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.5rem 0.75rem', borderRadius: '8px',
                          background: ok ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)',
                          border: `1px solid ${ok ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                        }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--cor-texto)' }}>{servico}</span>
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 600,
                            color: ok ? '#10b981' : '#f59e0b',
                          }}>
                            {ok ? '✓ ok' : '⚠ ' + status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Stack tecnológico ── */}
              <div className="card-custom">
                <div className="card-header">
                  <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                    ✦ Stack Tecnológico
                  </span>
                </div>
                <div style={{
                  padding: '1rem 1.25rem',
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '0.75rem',
                }}>
                  {STACK.map(grupo => (
                    <div key={grupo.categoria}>
                      <div style={{
                        fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '1px', color: 'var(--cor-acento)',
                        marginBottom: '0.5rem',
                      }}>
                        {grupo.categoria}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {grupo.itens.map(item => (
                          <span key={item} style={{
                            fontSize: '0.82rem', color: 'var(--cor-texto-suave)',
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                          }}>
                            <span style={{ color: 'var(--cor-borda)' }}>·</span>
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Histórico de versões ── */}
              <div className="card-custom">
                <div className="card-header">
                  <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                    ✦ Histórico de Versões
                  </span>
                </div>
                <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {CHANGELOG.map((release, idx) => (
                    <div key={release.versao}>
                      {/* Cabeçalho da release */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        marginBottom: '0.6rem',
                      }}>
                        <span style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', fontSize: '0.95rem', fontWeight: 700 }}>
                          v{release.versao}
                        </span>
                        <BadgeVersao status={release.status} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--cor-texto-suave)', marginLeft: 'auto' }}>
                          {release.data}
                        </span>
                      </div>

                      {/* Lista de itens da release */}
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {release.itens.map(item => (
                          <li key={item} style={{
                            fontSize: '0.82rem', color: 'var(--cor-texto-suave)',
                            display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                          }}>
                            <span style={{ color: 'var(--cor-acento)', flexShrink: 0, marginTop: '1px' }}>✦</span>
                            {item}
                          </li>
                        ))}
                      </ul>

                      {/* Separador entre versões */}
                      {idx < CHANGELOG.length - 1 && (
                        <div style={{ borderTop: '1px solid var(--cor-borda)', marginTop: '1.25rem' }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Créditos e links ── */}
              <div className="card-custom">
                <div className="card-header">
                  <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                    ✦ Créditos & Contato
                  </span>
                </div>
                <div style={{ padding: '1.25rem' }}>

                  {/* Card do fabricante */}
                  <div style={{
                    background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.15)',
                    borderRadius: '10px', padding: '1rem',
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    marginBottom: '1.25rem',
                  }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
                      background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'Cinzel', color: 'var(--cor-acento)', fontWeight: 700, fontSize: '1.1rem',
                    }}>
                      D
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: 'var(--cor-texto)', fontSize: '0.95rem' }}>
                        dbl_tech
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--cor-texto-suave)', marginTop: '2px' }}>
                        Desenvolvimento de software · {APP_INFO.ano}
                      </div>
                    </div>
                    <a
                      href={`mailto:${APP_INFO.contato_dev}`}
                      style={{
                        fontSize: '0.78rem', color: 'var(--cor-acento)',
                        background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)',
                        borderRadius: '6px', padding: '0.3rem 0.75rem',
                        textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                      }}
                    >
                      <i className="bi bi-envelope"></i> Email
                    </a>
                  </div>

                  {/* Links úteis */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--cor-texto-suave)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>
                      Links úteis
                    </div>

                    {[
                      { href: '/contato',                    icon: 'bi-chat-dots',  label: 'Enviar feedback ao desenvolvedor', externo: false },
                      { href: APP_INFO.site,                 icon: 'bi-globe',      label: 'Site do AxeFlow',                 externo: true },
                      { href: `${APP_INFO.site}/docs`,       icon: 'bi-book',       label: 'Documentação da API',             externo: true },
                    ].map(link => (
                      link.externo ? (
                        <a
                          key={link.href}
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.6rem 0.75rem', borderRadius: '8px',
                            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--cor-borda)',
                            color: 'var(--cor-texto-suave)', textDecoration: 'none',
                            fontSize: '0.85rem', transition: 'all 0.15s',
                          }}
                        >
                          <i className={`bi ${link.icon}`} style={{ color: 'var(--cor-acento)' }}></i>
                          {link.label}
                          <i className="bi bi-box-arrow-up-right" style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.5 }}></i>
                        </a>
                      ) : (
                        <Link
                          key={link.href}
                          href={link.href}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.6rem 0.75rem', borderRadius: '8px',
                            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--cor-borda)',
                            color: 'var(--cor-texto-suave)', textDecoration: 'none',
                            fontSize: '0.85rem',
                          }}
                        >
                          <i className={`bi ${link.icon}`} style={{ color: 'var(--cor-acento)' }}></i>
                          {link.label}
                          <i className="bi bi-chevron-right" style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.5 }}></i>
                        </Link>
                      )
                    ))}
                  </div>

                  {/* Copyright */}
                  <div style={{
                    marginTop: '1.25rem', paddingTop: '1rem',
                    borderTop: '1px solid var(--cor-borda)',
                    textAlign: 'center', fontSize: '0.75rem', color: 'var(--cor-texto-suave)',
                  }}>
                    © {APP_INFO.ano} {APP_INFO.fabricante} · {APP_INFO.nome} v{APP_INFO.versao}
                    <br />
                    Feito com ☽✦☾ para os terreiros do Brasil
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}