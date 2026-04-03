import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import { getMe, listMembros, createMembro, updateMembro } from '../services/api';
import { handleApiError } from '../services/errorHandler';
import api from '../services/api';

const ROLES = { admin: 'Admin', operador: 'Operador', membro: 'Membro' };
const ROLE_COLORS = { admin: '#d4af37', operador: '#a78bfa', membro: '#60a5fa' };

// ── Paleta de cores por classificação de score ────────────────────────────────
const COR_SCORE = {
  verde:    { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)',  text: '#10b981' },
  amarelo:  { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)',  text: '#f59e0b' },
  laranja:  { bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.35)',  text: '#f97316' },
  vermelho: { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)',   text: '#ef4444' },
  cinza:    { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.25)', text: '#94a3b8' },
};

// ── Badge de score compacto ───────────────────────────────────────────────────
function ScoreBadge({ c }) {
  const cor = COR_SCORE[c.cor] || COR_SCORE.cinza;
  return (
    <span
      title={`${c.comparecimentos ?? 0} presenças · ${c.faltas ?? 0} faltas`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        background: cor.bg, border: `1px solid ${cor.border}`, color: cor.text,
        borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 600,
        whiteSpace: 'nowrap', cursor: 'help',
      }}
    >
      {c.emoji} {c.score !== null && c.score !== undefined ? `${c.score}%` : c.label}
    </span>
  );
}

export default function Membros() {
  const router = useRouter();

  // ── Estado principal ────────────────────────────────────────────────────────
  const [membros, setMembros]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [me, setMe]                   = useState(null);

  // ── Abas: 'lista' | 'desempenho' ───────────────────────────────────────────
  const [aba, setAba]                 = useState('lista');

  // ── Estado da aba de desempenho ─────────────────────────────────────────────
  const [ranking, setRanking]         = useState([]);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [rankingCarregado, setRankingCarregado] = useState(false);
  const [busca, setBusca]             = useState('');

  // ── Estado dos modais ───────────────────────────────────────────────────────
  const [showModal, setShowModal]     = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [membroEditando, setMembroEditando] = useState(null);
  const [form, setForm]               = useState({ nome: '', email: '', senha: '', telefone: '', role: 'membro' });
  const [editForm, setEditForm]       = useState({ nome: '', telefone: '', role: 'membro', ativo: true, senha: '' });
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [editError, setEditError]     = useState('');

  // ── Carregamento inicial ────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    getMe().then(r => {
      setMe(r.data);
      return listMembros();
    }).then(r => setMembros(r.data))
      .catch(() => {
        getMe().then(r => setMembros([r.data]));
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Carrega ranking quando usuário muda para a aba de desempenho ────────────
  // Lazy loading: só busca quando a aba for aberta pela primeira vez
  useEffect(() => {
    if (aba !== 'desempenho' || rankingCarregado) return;

    setLoadingRanking(true);
    api.get('/membros/ranking')
      .then(res => {
        setRanking(res.data);
        setRankingCarregado(true);
      })
      .catch(() => {
        // Falha silenciosa — exibe vazio com mensagem
        setRankingCarregado(true);
      })
      .finally(() => setLoadingRanking(false));
  }, [aba, rankingCarregado]);

  // ── Handlers de formulário ──────────────────────────────────────────────────
  const handleConvidar = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createMembro(form);
      setShowModal(false);
      setForm({ nome: '', email: '', senha: '', telefone: '', role: 'membro' });
      const r = await listMembros();
      setMembros(r.data);
      // Invalida cache do ranking para recarregar na próxima visita à aba
      setRankingCarregado(false);
    } catch (err) {
      setError(handleApiError(err, 'Membros'));
    } finally {
      setSaving(false);
    }
  };

  const abrirEditar = (m) => {
    setMembroEditando(m);
    setEditForm({ nome: m.nome, telefone: m.telefone || '', role: m.role, ativo: m.ativo !== false, senha: '' });
    setEditError('');
    setShowEditModal(true);
  };

  const handleEditar = async (e) => {
    e.preventDefault();
    setSaving(true);
    setEditError('');
    try {
      const payload = { ...editForm };
      if (!payload.senha) delete payload.senha;
      await updateMembro(membroEditando.id, payload);
      setShowEditModal(false);
      const r = await listMembros();
      setMembros(r.data);
      // Invalida cache do ranking
      setRankingCarregado(false);
    } catch (err) {
      setEditError(handleApiError(err, 'Membros'));
    } finally {
      setSaving(false);
    }
  };

  // ── Dados derivados para a aba de desempenho ────────────────────────────────
  const rankingFiltrado = ranking.filter(m =>
    m.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    m.email?.toLowerCase().includes(busca.toLowerCase())
  );
  const totalAlerta    = ranking.filter(m => m.alerta).length;
  const totalConfiavel = ranking.filter(m => m.cor === 'verde').length;

  // ── Loading inicial ─────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner-gold"></div>
    </div>
  );

  return (
    <>
      <Head><title>Membros | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">

          {/* ── Topbar ── */}
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>Membros</h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>Usuários do seu terreiro</small>
            </div>
            {me?.role === 'admin' && aba === 'lista' && (
              <button className="btn-gold" onClick={() => setShowModal(true)}>
                <i className="bi bi-person-plus me-1"></i> Convidar Membro
              </button>
            )}
          </div>

          {/* ── Navegação por abas ── */}
          <div style={{
            display: 'flex', gap: '0.25rem',
            borderBottom: '1px solid var(--cor-borda)',
            padding: '0 1.5rem',
            background: 'var(--cor-card)',
          }}>
            {[
              { id: 'lista',      label: 'Membros',      icone: 'bi-person-badge' },
              { id: 'desempenho', label: 'Desempenho',   icone: 'bi-bar-chart-line',
                // Badge de alerta visível mesmo antes de carregar o ranking
                badge: rankingCarregado && totalAlerta > 0 ? totalAlerta : null },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setAba(tab.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600,
                  color: aba === tab.id ? 'var(--cor-acento)' : 'var(--cor-texto-suave)',
                  borderBottom: aba === tab.id
                    ? '2px solid var(--cor-acento)'
                    : '2px solid transparent',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  transition: 'color 0.15s', marginBottom: '-1px',
                }}
              >
                <i className={`bi ${tab.icone}`}></i>
                {tab.label}
                {/* Badge numérico de alertas na aba de desempenho */}
                {tab.badge && (
                  <span style={{
                    background: 'rgba(249,115,22,0.2)', color: '#f97316',
                    borderRadius: '10px', padding: '0 6px', fontSize: '0.7rem',
                    border: '1px solid rgba(249,115,22,0.35)',
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="page-content">

            {/* ══════════════════════════════════════════════════════════════
                ABA: LISTA DE MEMBROS (comportamento original preservado)
            ══════════════════════════════════════════════════════════════ */}
            {aba === 'lista' && (
              <div className="card-custom">
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-custom">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Email</th>
                        <th>Telefone</th>
                        <th>Perfil</th>
                        <th>Status</th>
                        {me?.role === 'admin' && <th>Ações</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {membros.map((m, idx) => (
                        <tr key={m.id || idx}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{
                                width: '36px', height: '36px', borderRadius: '50%',
                                background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--cor-acento)', fontFamily: 'Cinzel', fontWeight: '700', fontSize: '0.9rem'
                              }}>
                                {m.nome?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                {/* Link para o perfil de desempenho do membro */}
                                <Link
                                  href={`/membros/${m.id}`}
                                  style={{ color: 'var(--cor-texto)', textDecoration: 'none', fontWeight: 600 }}
                                >
                                  {m.nome}
                                </Link>
                                {me?.id === m.id && (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--cor-texto-suave)', marginLeft: '0.4rem' }}>
                                    (você)
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ color: 'var(--cor-texto-suave)' }}>{m.email}</td>
                          <td style={{ color: 'var(--cor-texto-suave)' }}>{m.telefone || '—'}</td>
                          <td>
                            <span style={{
                              padding: '0.2rem 0.7rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600',
                              background: `rgba(${m.role === 'admin' ? '212,175,55' : m.role === 'operador' ? '167,139,250' : '96,165,250'}, 0.15)`,
                              color: ROLE_COLORS[m.role] || 'var(--cor-texto)'
                            }}>
                              {ROLES[m.role] || m.role}
                            </span>
                          </td>
                          <td>
                            <span className={`badge-status ${m.ativo !== false ? 'badge-confirmado' : 'badge-cancelado'}`}>
                              {m.ativo !== false ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          {me?.role === 'admin' && (
                            <td>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button
                                  onClick={() => abrirEditar(m)}
                                  className="btn-outline-gold"
                                  title="Editar membro"
                                  style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem' }}
                                >
                                  <i className="bi bi-pencil"></i>
                                </button>
                                {/* Link direto para o perfil de desempenho */}
                                <Link
                                  href={`/membros/${m.id}`}
                                  title="Ver desempenho"
                                  style={{
                                    display: 'inline-flex', alignItems: 'center',
                                    background: 'transparent',
                                    border: '1px solid rgba(212,175,55,0.35)',
                                    color: 'var(--cor-acento)', borderRadius: '8px',
                                    padding: '0.2rem 0.6rem', textDecoration: 'none',
                                    fontSize: '0.8rem',
                                  }}
                                >
                                  <i className="bi bi-bar-chart-line"></i>
                                </Link>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                      {membros.length === 0 && (
                        <tr><td colSpan="5">
                          <div className="empty-state">
                            <i className="bi bi-person-badge d-block"></i>
                            <p>Nenhum membro cadastrado</p>
                          </div>
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                ABA: DESEMPENHO — ranking de presença dos membros
            ══════════════════════════════════════════════════════════════ */}
            {aba === 'desempenho' && (
              <div>

                {/* Loading do ranking */}
                {loadingRanking && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                    <div className="spinner-gold"></div>
                  </div>
                )}

                {!loadingRanking && rankingCarregado && (
                  <>
                    {/* Cards de resumo */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '0.75rem', marginBottom: '1.5rem',
                    }}>
                      {[
                        {
                          label: 'Total',
                          value: ranking.length,
                          cor: 'var(--cor-acento)',
                          sub: 'membros ativos',
                          emoji: '👥',
                        },
                        {
                          label: '✅ Confiáveis',
                          value: totalConfiavel,
                          cor: '#10b981',
                          sub: 'taxa ≥ 80%',
                          emoji: null,
                        },
                        {
                          label: '⚠ Alertas',
                          value: totalAlerta,
                          cor: '#f97316',
                          sub: '3+ faltas, <50%',
                          emoji: null,
                        },
                        {
                          label: '🆕 Sem histórico',
                          value: ranking.filter(m => m.cor === 'cinza').length,
                          cor: '#94a3b8',
                          sub: '< 2 giras finalizadas',
                          emoji: null,
                        },
                      ].map(card => (
                        <div key={card.label} className="stat-card">
                          <div style={{ fontSize: '0.72rem', color: card.cor, marginBottom: '2px' }}>
                            {card.label}
                          </div>
                          <div className="stat-value" style={{ color: card.cor, fontSize: '1.6rem' }}>
                            {card.value}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>
                            {card.sub}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Barra de busca */}
                    <div style={{ marginBottom: '1rem' }}>
                      <input
                        className="form-control-custom"
                        placeholder="🔍  Buscar membro por nome ou email..."
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                        style={{ maxWidth: '340px' }}
                      />
                    </div>

                    {/* Alerta de membros problemáticos */}
                    {totalAlerta > 0 && (
                      <div style={{
                        background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)',
                        borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.25rem',
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                      }}>
                        <span style={{ fontSize: '1.2rem' }}>🚨</span>
                        <div>
                          <strong style={{ color: '#f97316', fontSize: '0.9rem' }}>
                            {totalAlerta} membro{totalAlerta > 1 ? 's' : ''} com histórico preocupante
                          </strong>
                          <div style={{ color: 'var(--cor-texto-suave)', fontSize: '0.8rem' }}>
                            3+ faltas e taxa abaixo de 50%.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tabela de ranking */}
                    <div className="card-custom">
                      <div style={{ overflowX: 'auto' }}>
                        <table className="table-custom">
                          <thead>
                            <tr>
                              <th>Membro</th>
                              <th style={{ textAlign: 'center' }}>Score</th>
                              <th style={{ textAlign: 'center' }}>Presenças</th>
                              <th style={{ textAlign: 'center' }}>Faltas</th>
                              <th style={{ textAlign: 'center' }}>Giras</th>
                              <th>Taxa</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {rankingFiltrado.map(m => {
                              // Taxa de presença sobre giras finalizadas
                              const taxa = m.finalizadas > 0
                                ? Math.round((m.comparecimentos / m.finalizadas) * 100)
                                : 0;

                              return (
                                <tr
                                  key={m.id}
                                  style={{
                                    // Destaque sutil para membros com alerta
                                    background: m.alerta
                                      ? 'rgba(249,115,22,0.04)'
                                      : 'transparent',
                                  }}
                                >
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                                      {/* Avatar com inicial */}
                                      <div style={{
                                        width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                                        background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.25)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'var(--cor-acento)', fontFamily: 'Cinzel', fontSize: '0.8rem', fontWeight: 700,
                                      }}>
                                        {m.nome?.charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                          <Link
                                            href={`/membros/${m.id}`}
                                            style={{ color: 'var(--cor-texto)', textDecoration: 'none', fontWeight: 600, fontSize: '0.88rem' }}
                                          >
                                            {m.nome}
                                          </Link>
                                          {/* Badge de alerta visível diretamente na linha */}
                                          {m.alerta && (
                                            <span
                                              title={`${m.faltas} faltas com taxa abaixo de 50%`}
                                              style={{
                                                fontSize: '0.68rem', color: '#f97316',
                                                background: 'rgba(249,115,22,0.12)',
                                                border: '1px solid rgba(249,115,22,0.3)',
                                                borderRadius: '4px', padding: '1px 5px',
                                              }}
                                            >
                                              ⚠ {m.faltas}x faltou
                                            </span>
                                          )}
                                        </div>
                                        {/* Role abaixo do nome */}
                                        <span style={{
                                          fontSize: '0.7rem',
                                          color: ROLE_COLORS[m.role] || 'var(--cor-texto-suave)',
                                        }}>
                                          {ROLES[m.role] || m.role}
                                        </span>
                                      </div>
                                    </div>
                                  </td>

                                  <td style={{ textAlign: 'center' }}>
                                    <ScoreBadge c={m} />
                                  </td>

                                  <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 600 }}>
                                    {m.comparecimentos}
                                  </td>

                                  <td style={{
                                    textAlign: 'center',
                                    color: m.faltas >= 3 ? '#ef4444' : 'var(--cor-texto-suave)',
                                    fontWeight: m.faltas >= 3 ? 700 : 400,
                                  }}>
                                    {m.faltas}
                                  </td>

                                  <td style={{ textAlign: 'center', color: 'var(--cor-texto-suave)' }}>
                                    {m.total_inscricoes ?? 0}
                                  </td>

                                  <td style={{ minWidth: '120px' }}>
                                    {m.finalizadas > 0 ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div className="vagas-bar" style={{ flex: 1 }}>
                                          <div className="vagas-fill" style={{
                                            width: `${taxa}%`,
                                            background: (COR_SCORE[m.cor] || COR_SCORE.cinza).text,
                                          }} />
                                        </div>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--cor-texto-suave)', minWidth: '35px' }}>
                                          {taxa}%
                                        </span>
                                      </div>
                                    ) : (
                                      <span style={{ color: 'var(--cor-texto-suave)', fontSize: '0.78rem' }}>—</span>
                                    )}
                                  </td>

                                  {/* Botão de ver perfil completo */}
                                  <td>
                                    <Link
                                      href={`/membros/${m.id}`}
                                      className="btn-outline-gold"
                                      style={{ fontSize: '0.78rem', padding: '0.2rem 0.5rem', textDecoration: 'none' }}
                                      title="Ver perfil completo"
                                    >
                                      <i className="bi bi-person-lines-fill"></i>
                                    </Link>
                                  </td>
                                </tr>
                              );
                            })}

                            {rankingFiltrado.length === 0 && (
                              <tr><td colSpan="7">
                                <div className="empty-state">
                                  <i className="bi bi-bar-chart-line d-block"></i>
                                  <p>
                                    {busca
                                      ? 'Nenhum membro encontrado'
                                      : 'Nenhum dado de presença ainda'}
                                  </p>
                                </div>
                              </td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Legenda dos scores — igual à tela de consulentes */}
                      <div style={{
                        padding: '0.75rem 1rem', borderTop: '1px solid var(--cor-borda)',
                        display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center',
                      }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>
                          Score de presença:
                        </span>
                        {[
                          { emoji: '✅', label: 'Confiável ≥80%',   cor: 'verde' },
                          { emoji: '⚠️', label: 'Regular 50–79%',   cor: 'amarelo' },
                          { emoji: '🔶', label: 'Risco 20–49%',      cor: 'laranja' },
                          { emoji: '🚫', label: 'Problemático <20%', cor: 'vermelho' },
                          { emoji: '🆕', label: 'Novo (< 2 giras)',  cor: 'cinza' },
                        ].map(s => {
                          const c = COR_SCORE[s.cor];
                          return (
                            <span key={s.cor} style={{
                              fontSize: '0.7rem', color: c.text,
                              background: c.bg, border: `1px solid ${c.border}`,
                              borderRadius: '20px', padding: '1px 8px',
                            }}>
                              {s.emoji} {s.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Modal: Convidar novo membro ── */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card-custom" style={{ width: '100%', maxWidth: '460px', margin: '1rem' }}>
            <div className="card-header d-flex justify-content-between align-items-center">
              <span style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)' }}>✦ Convidar Membro</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--cor-texto-suave)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </div>
            <div className="p-4">
              {error && <div className="alert-custom alert-danger-custom mb-3">{error}</div>}
              <form onSubmit={handleConvidar}>
                <div className="mb-3">
                  <label className="form-label-custom">Nome</label>
                  <input className="form-control-custom" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
                </div>
                <div className="mb-3">
                  <label className="form-label-custom">Email</label>
                  <input type="email" className="form-control-custom" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <label className="form-label-custom">Telefone</label>
                    <input className="form-control-custom" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} />
                  </div>
                  <div className="col-6">
                    <label className="form-label-custom">Perfil</label>
                    <select className="form-control-custom" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                      <option value="membro">Membro</option>
                      <option value="operador">Operador</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="form-label-custom">Senha provisória</label>
                  <input type="password" className="form-control-custom" value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} required minLength={6} />
                </div>
                <div className="d-flex gap-2">
                  <button type="button" className="btn-outline-gold" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Cancelar</button>
                  <button type="submit" className="btn-gold" disabled={saving} style={{ flex: 1 }}>
                    {saving ? <span className="spinner-border spinner-border-sm me-1"></span> : null}
                    Convidar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Editar membro (preservado integralmente) ── */}
      {showEditModal && membroEditando && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card-custom" style={{ width: '100%', maxWidth: '460px', margin: '1rem' }}>
            <div className="card-header d-flex justify-content-between align-items-center">
              <span style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)' }}>✦ Editar Membro</span>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', color: 'var(--cor-texto-suave)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
            </div>
            <div className="p-4">
              {editError && <div className="alert-custom alert-danger-custom mb-3">{editError}</div>}
              <form onSubmit={handleEditar}>
                <div className="mb-3">
                  <label className="form-label-custom">Nome</label>
                  <input className="form-control-custom" value={editForm.nome} onChange={e => setEditForm({ ...editForm, nome: e.target.value })} required />
                </div>
                <div className="mb-3">
                  <label className="form-label-custom">Email</label>
                  <input className="form-control-custom" value={membroEditando.email} disabled style={{ opacity: 0.5 }} />
                  <small style={{ color: 'var(--cor-texto-suave)', fontSize: '0.75rem' }}>O email não pode ser alterado</small>
                </div>
                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <label className="form-label-custom">Telefone</label>
                    <input className="form-control-custom" value={editForm.telefone} onChange={e => setEditForm({ ...editForm, telefone: e.target.value })} />
                  </div>
                  <div className="col-6">
                    <label className="form-label-custom">Perfil</label>
                    <select className="form-control-custom" value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                      <option value="membro">Membro</option>
                      <option value="operador">Operador</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label-custom">Nova senha <span style={{ color: 'var(--cor-texto-suave)', fontWeight: 400 }}>(deixe em branco para manter)</span></label>
                  <input type="password" className="form-control-custom" value={editForm.senha} onChange={e => setEditForm({ ...editForm, senha: e.target.value })} minLength={6} placeholder="••••••" />
                </div>
                <div className="mb-4">
                  <label className="form-label-custom">Status</label>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    {[{ val: true, label: '✓ Ativo', cor: '#10b981' }, { val: false, label: '✗ Inativo', cor: '#ef4444' }].map(opt => (
                      <button key={String(opt.val)} type="button" onClick={() => setEditForm({ ...editForm, ativo: opt.val })}
                        style={{
                          flex: 1, padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                          border: `1px solid ${editForm.ativo === opt.val ? opt.cor : 'var(--cor-borda)'}`,
                          background: editForm.ativo === opt.val ? `rgba(${opt.val ? '16,185,129' : '239,68,68'},0.15)` : 'transparent',
                          color: editForm.ativo === opt.val ? opt.cor : 'var(--cor-texto-suave)',
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {me?.id === membroEditando.id && (
                    <small style={{ color: '#f59e0b', fontSize: '0.75rem', marginTop: '0.4rem', display: 'block' }}>
                      ⚠️ Você não pode desativar sua própria conta
                    </small>
                  )}
                </div>
                <div className="d-flex gap-2">
                  <button type="button" className="btn-outline-gold" onClick={() => setShowEditModal(false)} style={{ flex: 1 }}>Cancelar</button>
                  <button type="submit" className="btn-gold" disabled={saving} style={{ flex: 1 }}>
                    {saving ? <span className="spinner-border spinner-border-sm me-1"></span> : null}
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </>
  );
}