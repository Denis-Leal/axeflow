/**
 * pages/consulentes.js — AxeFlow
 *
 * Dependências:
 *   hooks/useConsulentes             → dados (lista imediata + ranking lazy)
 *   hooks/useMediaQuery              → useIsMobile
 *   viewModels/consulenteViewModel   → buildConsulentesListViewModel,
 *                                      buildRankingConsulentesViewModel,
 *                                      buildRankingConsulentesStats, COR_SCORE
 *
 * Padrão: hook → viewModel → card (mobile) | table (desktop)
 * Lazy loading do ranking preservado via loadRanking().
 */
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import { useConsulentes } from '../hooks/useConsulentes';
import { useIsMobile } from '../hooks/useMediaQuery';
import {
  buildConsulentesListViewModel,
  buildRankingConsulentesViewModel,
  buildRankingConsulentesStats,
  COR_SCORE,
} from '../viewModels/consulenteViewModel';

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Avatar({ inicial, size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--cor-acento)', fontFamily: 'Cinzel', fontWeight: 700,
      fontSize: size > 32 ? '0.9rem' : '0.8rem',
    }}>
      {inicial}
    </div>
  );
}

function ScoreBadge({ item }) {
  const c = item.corStyle;
  return (
    <span
      title={`${item.comparecimentos} presenças · ${item.faltas} faltas`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        background: c.bg, border: `1px solid ${c.border}`, color: c.text,
        borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 600,
        whiteSpace: 'nowrap', cursor: 'help',
      }}
    >
      {item.emoji} {item.scoreLabel}
    </span>
  );
}

// ─── Card mobile — aba Lista ──────────────────────────────────────────────────

function ConsulenteCard({ consulente }) {
  return (
    <div style={{
      background:   'var(--cor-card)',
      border:       '1px solid var(--cor-borda)',
      borderRadius: '10px',
      padding:      '0.75rem',
      marginBottom: '0.5rem',
      display:      'flex',
      alignItems:   'center',
      gap:          '0.75rem',
    }}>
      <Avatar inicial={consulente.inicial} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link
          href={`/consulentes/${consulente.id}`}
          style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--cor-texto)', textDecoration: 'none' }}
        >
          {consulente.nome}
        </Link>
        <div style={{ fontSize: '0.76rem', color: 'var(--cor-texto-suave)', marginTop: '2px' }}>
          {consulente.telefone}
        </div>
        {consulente.obs && (
          <div style={{
            fontSize: '0.72rem', color: '#d4af37', marginTop: '4px',
            background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.2)',
            borderRadius: '5px', padding: '2px 7px',
          }}>
            {consulente.obs}
          </div>
        )}
        <div style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)', marginTop: '4px' }}>
          {consulente.totalInscricoes} inscrições · {consulente.totalGiras} giras
        </div>
      </div>
      <Link
        href={`/consulentes/${consulente.id}`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: '1px solid rgba(212,175,55,0.35)',
          color: 'var(--cor-acento)', borderRadius: '6px',
          padding: '0.3rem 0.5rem', textDecoration: 'none', fontSize: '0.8rem',
        }}
      >
        <i className="bi bi-person-lines-fill" />
      </Link>
    </div>
  );
}

// ─── Card mobile — aba Ranking ────────────────────────────────────────────────

function RankingConsulenteCard({ item }) {
  const c = item.corStyle;
  return (
    <div style={{
      background:   item.alerta ? 'rgba(249,115,22,0.04)' : 'var(--cor-card)',
      border:       `1px solid ${item.alerta ? 'rgba(249,115,22,0.25)' : 'var(--cor-borda)'}`,
      borderRadius: '10px',
      padding:      '0.75rem',
      marginBottom: '0.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
        <Avatar inicial={item.inicial} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <Link
              href={`/consulentes/${item.id}`}
              style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--cor-texto)', textDecoration: 'none' }}
            >
              {item.nome}
            </Link>
            {item.alerta && (
              <span style={{
                fontSize: '0.68rem', color: '#f97316',
                background: 'rgba(249,115,22,0.12)',
                border: '1px solid rgba(249,115,22,0.3)',
                borderRadius: '4px', padding: '1px 5px',
              }}>
                ⚠ {item.faltas}x faltou
              </span>
            )}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>{item.telefone}</span>
        </div>
        <ScoreBadge item={item} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.76rem', flexWrap: 'wrap' }}>
        <span style={{ color: '#10b981' }}>✓ {item.comparecimentos}</span>
        <span style={{
          color: item.faltas >= 3 ? '#ef4444' : 'var(--cor-texto-suave)',
          fontWeight: item.faltas >= 3 ? 700 : 400,
        }}>
          ✗ {item.faltas}
        </span>
        <span style={{ color: 'var(--cor-texto-suave)' }}>{item.finalizadas} giras</span>
        {item.finalizadas > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 80 }}>
            <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
              <div style={{ width: `${item.taxa}%`, height: '100%', background: c.text, borderRadius: '2px' }} />
            </div>
            <span style={{ color: 'var(--cor-texto-suave)', minWidth: 30 }}>{item.taxa}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tabela desktop — aba Lista ───────────────────────────────────────────────

function ConsulentesTable({ consulentes }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table-custom">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Telefone</th>
            <th>Inscrições</th>
            <th>Observações</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {consulentes.map(c => (
            <tr key={c.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Avatar inicial={c.inicial} />
                  <Link href={`/consulentes/${c.id}`} style={{ color: 'var(--cor-texto)', textDecoration: 'none', fontWeight: 600 }}>
                    {c.nome}
                  </Link>
                </div>
              </td>
              <td style={{ color: 'var(--cor-texto-suave)' }}>{c.telefone}</td>
              <td style={{ color: 'var(--cor-texto-suave)' }}>{c.totalInscricoes}</td>
              <td style={{ fontSize: '0.8rem', color: '#d4af37', maxWidth: 200 }}>{c.obs || '—'}</td>
              <td>
                <Link
                  href={`/consulentes/${c.id}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    background: 'transparent', border: '1px solid rgba(212,175,55,0.35)',
                    color: 'var(--cor-acento)', borderRadius: '8px',
                    padding: '0.2rem 0.6rem', textDecoration: 'none', fontSize: '0.8rem',
                  }}
                >
                  <i className="bi bi-person-lines-fill" />
                </Link>
              </td>
            </tr>
          ))}
          {consulentes.length === 0 && (
            <tr><td colSpan="5">
              <div className="empty-state">
                <i className="bi bi-people d-block" />
                <p>Nenhum consulente cadastrado</p>
              </div>
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tabela desktop — aba Ranking ─────────────────────────────────────────────

function RankingTable({ itens }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table-custom">
        <thead>
          <tr>
            <th>Nome</th>
            <th style={{ textAlign: 'center' }}>Score</th>
            <th style={{ textAlign: 'center' }}>Presenças</th>
            <th style={{ textAlign: 'center' }}>Faltas</th>
            <th style={{ textAlign: 'center' }}>Giras</th>
            <th>Taxa</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {itens.map(c => (
            <tr key={c.id} style={{ background: c.alerta ? 'rgba(249,115,22,0.04)' : 'transparent' }}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Avatar inicial={c.inicial} size={32} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <Link href={`/consulentes/${c.id}`} style={{ color: 'var(--cor-texto)', textDecoration: 'none', fontWeight: 600, fontSize: '0.88rem' }}>
                        {c.nome}
                      </Link>
                      {c.alerta && (
                        <span style={{ fontSize: '0.68rem', color: '#f97316', background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '4px', padding: '1px 5px' }}>
                          ⚠ {c.faltas}x faltou
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>{c.telefone}</span>
                  </div>
                </div>
              </td>
              <td style={{ textAlign: 'center' }}><ScoreBadge item={c} /></td>
              <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 600 }}>{c.comparecimentos}</td>
              <td style={{ textAlign: 'center', color: c.faltas >= 3 ? '#ef4444' : 'var(--cor-texto-suave)', fontWeight: c.faltas >= 3 ? 700 : 400 }}>
                {c.faltas}
              </td>
              <td style={{ textAlign: 'center', color: 'var(--cor-texto-suave)' }}>{c.finalizadas}</td>
              <td style={{ minWidth: 120 }}>
                {c.finalizadas > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div className="vagas-bar" style={{ flex: 1 }}>
                      <div className="vagas-fill" style={{ width: `${c.taxa}%`, background: c.corStyle.text }} />
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--cor-texto-suave)', minWidth: 35 }}>{c.taxa}%</span>
                  </div>
                ) : (
                  <span style={{ color: 'var(--cor-texto-suave)', fontSize: '0.78rem' }}>—</span>
                )}
              </td>
              <td>
                <Link href={`/consulentes/${c.id}`} className="btn-outline-gold" style={{ fontSize: '0.78rem', padding: '0.2rem 0.5rem', textDecoration: 'none' }}>
                  <i className="bi bi-person-lines-fill" />
                </Link>
              </td>
            </tr>
          ))}
          {itens.length === 0 && (
            <tr><td colSpan="7">
              <div className="empty-state">
                <i className="bi bi-bar-chart-line d-block" />
                <p>Nenhum dado de presença ainda</p>
              </div>
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Legenda de score ─────────────────────────────────────────────────────────

function ScoreLegenda() {
  const itens = [
    { emoji: '✅', label: 'Confiável ≥80%',   cor: 'verde' },
    { emoji: '⚠️', label: 'Regular 50–79%',   cor: 'amarelo' },
    { emoji: '🔶', label: 'Risco 20–49%',      cor: 'laranja' },
    { emoji: '🚫', label: 'Problemático <20%', cor: 'vermelho' },
    { emoji: '🆕', label: 'Novo (< 2 giras)',  cor: 'cinza' },
  ];
  return (
    <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--cor-borda)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>Score:</span>
      {itens.map(s => {
        const c = COR_SCORE[s.cor];
        return (
          <span key={s.cor} style={{ fontSize: '0.7rem', color: c.text, background: c.bg, border: `1px solid ${c.border}`, borderRadius: '20px', padding: '1px 8px' }}>
            {s.emoji} {s.label}
          </span>
        );
      })}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Consulentes() {
  const router   = useRouter();
  const isMobile = useIsMobile();

  const {
    consulentes, loading,
    ranking, loadingRanking, rankingCarregado,
    loadRanking,
  } = useConsulentes();

  const [aba, setAba]   = useState('lista');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  // Lazy load do ranking ao abrir a aba
  useEffect(() => {
    if (aba === 'ranking') loadRanking();
  }, [aba, loadRanking]);

  // ViewModels
  const consultesVM = useMemo(
    () => buildConsulentesListViewModel(consulentes),
    [consulentes]
  );
  const rankingVM = useMemo(
    () => buildRankingConsulentesViewModel(ranking),
    [ranking]
  );
  const rankingStats = useMemo(
    () => buildRankingConsulentesStats(ranking),
    [ranking]
  );
  const rankingFiltrado = useMemo(
    () => rankingVM.filter(c =>
      c.nome?.toLowerCase().includes(busca.toLowerCase())
    ),
    [rankingVM, busca]
  );
  const listaFiltrada = useMemo(
    () => consultesVM.filter(c =>
      c.nome?.toLowerCase().includes(busca.toLowerCase())
    ),
    [consultesVM, busca]
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner-gold" />
    </div>
  );

  return (
    <>
      <Head><title>Consulentes | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">

          {/* Topbar */}
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>Consulentes</h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>Histórico e presença</small>
            </div>
          </div>

          {/* Abas */}
          <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--cor-borda)', padding: '0 1.5rem', background: 'var(--cor-card)' }}>
            {[
              { id: 'lista',   label: 'Consulentes', icone: 'bi-people' },
              { id: 'ranking', label: 'Ranking',      icone: 'bi-bar-chart-line',
                badge: rankingCarregado && rankingStats.alertas > 0 ? rankingStats.alertas : null },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setAba(tab.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600,
                  color: aba === tab.id ? 'var(--cor-acento)' : 'var(--cor-texto-suave)',
                  borderBottom: aba === tab.id ? '2px solid var(--cor-acento)' : '2px solid transparent',
                  display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '-1px',
                }}
              >
                <i className={`bi ${tab.icone}`} />
                {tab.label}
                {tab.badge && (
                  <span style={{ background: 'rgba(249,115,22,0.2)', color: '#f97316', borderRadius: '10px', padding: '0 6px', fontSize: '0.7rem', border: '1px solid rgba(249,115,22,0.35)' }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="page-content">

            {/* Busca (ambas as abas) */}
            <div style={{ marginBottom: '1rem' }}>
              <input
                className="form-control-custom"
                placeholder="🔍  Buscar consulente por nome..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                style={{ maxWidth: '340px' }}
              />
            </div>

            {/* ── ABA: LISTA ── */}
            {aba === 'lista' && (
              <div className="card-custom">
                {isMobile ? (
                  listaFiltrada.length > 0
                    ? listaFiltrada.map(c => <ConsulenteCard key={c.id} consulente={c} />)
                    : <div className="empty-state"><i className="bi bi-people d-block" /><p>Nenhum consulente encontrado</p></div>
                ) : (
                  <ConsulentesTable consulentes={listaFiltrada} />
                )}
              </div>
            )}

            {/* ── ABA: RANKING ── */}
            {aba === 'ranking' && (
              <div>
                {loadingRanking && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                    <div className="spinner-gold" />
                  </div>
                )}

                {!loadingRanking && rankingCarregado && (
                  <>
                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                      {[
                        { label: 'Total',           value: rankingStats.total,        cor: 'var(--cor-acento)', sub: 'consulentes' },
                        { label: '✅ Confiáveis',   value: rankingStats.confiaveis,   cor: '#10b981',           sub: 'taxa ≥ 80%' },
                        { label: '⚠ Alertas',       value: rankingStats.alertas,      cor: '#f97316',           sub: '3+ faltas, <50%' },
                        { label: '🆕 Sem histórico', value: rankingStats.semHistorico, cor: '#94a3b8',           sub: '< 2 giras' },
                      ].map(card => (
                        <div key={card.label} className="stat-card">
                          <div style={{ fontSize: '0.72rem', color: card.cor, marginBottom: '2px' }}>{card.label}</div>
                          <div className="stat-value" style={{ color: card.cor, fontSize: '1.6rem' }}>{card.value}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>{card.sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* Banner de alertas */}
                    {rankingStats.alertas > 0 && (
                      <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.2rem' }}>🚨</span>
                        <div>
                          <strong style={{ color: '#f97316', fontSize: '0.9rem' }}>
                            {rankingStats.alertas} consulente{rankingStats.alertas > 1 ? 's' : ''} com histórico preocupante
                          </strong>
                          <div style={{ color: 'var(--cor-texto-suave)', fontSize: '0.8rem' }}>3+ faltas e taxa abaixo de 50%.</div>
                        </div>
                      </div>
                    )}

                    {/* Mobile: cards | Desktop: tabela */}
                    <div className="card-custom">
                      {isMobile ? (
                        rankingFiltrado.length > 0
                          ? rankingFiltrado.map(c => <RankingConsulenteCard key={c.id} item={c} />)
                          : <div className="empty-state"><i className="bi bi-bar-chart-line d-block" /><p>{busca ? 'Nenhum encontrado' : 'Nenhum dado ainda'}</p></div>
                      ) : (
                        <RankingTable itens={rankingFiltrado} />
                      )}
                      <ScoreLegenda />
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}