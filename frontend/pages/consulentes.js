import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import Link from 'next/link';
import api from '../services/api';
import { getRankingConsulentes } from '../services/api';

const COR_SCORE = {
  verde:    { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)',  text: '#10b981' },
  amarelo:  { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)',  text: '#f59e0b' },
  laranja:  { bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.35)',  text: '#f97316' },
  vermelho: { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)',   text: '#ef4444' },
  cinza:    { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.25)', text: '#94a3b8' },
};

function ScoreBadge({ c }) {
  const cor = COR_SCORE[c.cor] || COR_SCORE.cinza;
  return (
    <span title={`${c.comparecimentos ?? 0} presenças · ${c.faltas ?? 0} faltas`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        background: cor.bg, border: `1px solid ${cor.border}`, color: cor.text,
        borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 600,
        whiteSpace: 'nowrap', cursor: 'help',
      }}>
      {c.emoji} {c.score !== null && c.score !== undefined ? `${c.score}%` : c.label}
    </span>
  );
}

export default function Consulentes() {
  const router = useRouter();
  const [consulentes, setConsulentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    getRankingConsulentes()
      .then(res => setConsulentes(res.data))
      .catch(err => { if (err.response?.status === 401) { localStorage.removeItem('token'); router.push('/login'); } })
      .finally(() => setLoading(false));
  }, []);

  const totalAlerta      = consulentes.filter(c => c.alerta).length;
  const totalProblema    = consulentes.filter(c => c.cor === 'vermelho').length;
  const totalConfiavel   = consulentes.filter(c => c.cor === 'verde').length;
  const totalNovo        = consulentes.filter(c => c.cor === 'cinza').length;

  const filtrados = consulentes.filter(c => {
    const buscaOk = c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
                    c.telefone?.includes(busca);
    const filtroOk =
      filtro === 'todos'      ? true :
      filtro === 'alerta'     ? c.alerta :
      filtro === 'primeira'   ? c.primeira_visita :
      filtro === 'confiavel'  ? c.cor === 'verde' :
      filtro === 'problema'   ? c.cor === 'vermelho' || c.cor === 'laranja' : true;
    return buscaOk && filtroOk;
  });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner-gold"></div>
    </div>
  );

  return (
    <>
      <Head><title>Consulentes | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">
          <div className="topbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>Consulentes</h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>
                {consulentes.length} cadastrado{consulentes.length !== 1 ? 's' : ''}
                {totalAlerta > 0 && (
                  <span style={{ color: '#f97316', marginLeft: '0.75rem' }}>
                    · ⚠ {totalAlerta} com alerta
                  </span>
                )}
              </small>
            </div>
            <input className="form-control-custom" placeholder="🔍  Buscar nome ou telefone..."
              value={busca} onChange={e => setBusca(e.target.value)}
              style={{ width: '240px', maxWidth: '100%' }} />
          </div>

          <div className="page-content">

            {/* Cards resumo — clicáveis para filtrar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {[
                { key: 'todos',     label: 'Total',          value: consulentes.length, cor: 'var(--cor-acento)', sub: 'consulentes' },
                { key: 'alerta',    label: '⚠ Alertas',      value: totalAlerta,        cor: '#f97316',           sub: '3+ faltas, <50%' },
                { key: 'problema',  label: '🚫 Risco/Prob.',  value: totalProblema,      cor: '#ef4444',           sub: 'taxa abaixo de 50%' },
                { key: 'confiavel', label: '✅ Confiáveis',   value: totalConfiavel,     cor: '#10b981',           sub: 'taxa ≥ 80%' },
                { key: 'primeira',  label: '🆕 1ª visita',   value: totalNovo + consulentes.filter(c => c.primeira_visita).length - totalNovo, cor: '#94a3b8', sub: 'nunca retornaram' },
              ].map(card => (
                <button key={card.key} onClick={() => setFiltro(card.key)} className="stat-card"
                  style={{ textAlign: 'left', cursor: 'pointer',
                    border: filtro === card.key ? `1px solid ${card.cor}` : undefined }}>
                  <div style={{ fontSize: '0.72rem', color: card.cor, marginBottom: '2px' }}>{card.label}</div>
                  <div className="stat-value" style={{ color: card.cor, fontSize: '1.6rem' }}>{card.value}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>{card.sub}</div>
                </button>
              ))}
            </div>

            {/* Tabela */}
            <div className="card-custom">
              {filtro !== 'todos' && (
                <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--cor-borda)',
                  display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--cor-texto-suave)' }}>
                    Filtro ativo — {filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}
                  </span>
                  <button onClick={() => setFiltro('todos')}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none',
                      color: 'var(--cor-texto-suave)', cursor: 'pointer', fontSize: '0.8rem' }}>
                    ✕ Limpar
                  </button>
                </div>
              )}

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
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map(c => {
                      const taxa = c.finalizadas > 0
                        ? Math.round((c.comparecimentos / c.finalizadas) * 100) : 0;
                      return (
                        <tr key={c.id} style={{ background: c.alerta ? 'rgba(249,115,22,0.04)' : 'transparent' }}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <Link href={`/consulentes/${c.id}`} style={{ color:'var(--cor-texto)', textDecoration:'none', fontWeight:600 }}>
                              {c.nome}
                            </Link>
                              {c.alerta && (
                                <span title="3+ faltas com taxa abaixo de 50%"
                                  style={{ fontSize: '0.68rem', color: '#f97316',
                                    background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)',
                                    borderRadius: '4px', padding: '1px 5px' }}>
                                  ⚠ {c.faltas}x faltou
                                </span>
                              )}
                              {c.primeira_visita && (
                                <span style={{ fontSize: '0.68rem', color: '#94a3b8',
                                  background: 'rgba(148,163,184,0.1)', borderRadius: '4px', padding: '1px 5px' }}>
                                  1ª visita
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--cor-texto-suave)' }}>{c.telefone}</div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <ScoreBadge c={c} />
                          </td>
                          <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 600 }}>
                            {c.comparecimentos}
                          </td>
                          <td style={{ textAlign: 'center', color: c.faltas >= 3 ? '#ef4444' : 'var(--cor-texto-suave)', fontWeight: c.faltas >= 3 ? 700 : 400 }}>
                            {c.faltas}
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--cor-texto-suave)' }}>
                            {c.finalizadas ?? 0}
                          </td>
                          <td style={{ minWidth: '120px' }}>
                            {c.finalizadas > 0 ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div className="vagas-bar" style={{ flex: 1 }}>
                                  <div className="vagas-fill" style={{
                                    width: `${taxa}%`,
                                    background: (COR_SCORE[c.cor] || COR_SCORE.cinza).text,
                                  }}></div>
                                </div>
                                <span style={{ fontSize: '0.78rem', color: 'var(--cor-texto-suave)', minWidth: '35px' }}>
                                  {taxa}%
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--cor-texto-suave)', fontSize: '0.78rem' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filtrados.length === 0 && (
                      <tr><td colSpan="6">
                        <div className="empty-state">
                          <i className="bi bi-people d-block"></i>
                          <p>{busca || filtro !== 'todos' ? 'Nenhum consulente encontrado' : 'Nenhum consulente ainda'}</p>
                        </div>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}
