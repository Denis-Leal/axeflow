import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Sidebar from '../../components/Sidebar';
import BottomNav from '../../components/BottomNav';
import { getGira, listInscricoes, updatePresenca, cancelarInscricao } from '../../services/api';

const COR_SCORE = {
  verde:    { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)',  text: '#10b981' },
  amarelo:  { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)',  text: '#f59e0b' },
  laranja:  { bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.35)',  text: '#f97316' },
  vermelho: { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)',   text: '#ef4444' },
  cinza:    { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.25)', text: '#94a3b8' },
};

function ScoreBadge({ score }) {
  if (!score) return null;
  const c = COR_SCORE[score.cor] || COR_SCORE.cinza;
  return (
    <span title={`${score.comparecimentos ?? 0} presenças · ${score.faltas ?? 0} faltas · ${score.finalizadas ?? 0} giras`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        background: c.bg, border: `1px solid ${c.border}`, color: c.text,
        borderRadius: '20px', padding: '1px 8px', fontSize: '0.7rem', fontWeight: 600,
        whiteSpace: 'nowrap', cursor: 'help',
      }}>
      {score.emoji} {score.score !== null ? `${score.score}%` : score.label}
    </span>
  );
}

function AlertaFalta({ score }) {
  if (!score?.alerta) return null;
  return (
    <span title={`${score.faltas} faltas registradas — ocupando vaga sem comparecer`}
      style={{
        display: 'inline-flex', alignItems: 'center',
        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
        color: '#ef4444', borderRadius: '4px', padding: '1px 6px',
        fontSize: '0.68rem', marginLeft: '4px', cursor: 'help',
      }}>
      ⚠ {score.faltas}x faltou
    </span>
  );
}

export default function GiraDetalhe() {
  const router = useRouter();
  const { id } = router.query;
  const [gira, setGira] = useState(null);
  const [inscricoes, setInscricoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [ordenar, setOrdenar] = useState('posicao'); // posicao | score_asc | score_desc | alerta

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    Promise.all([getGira(id), listInscricoes(id)])
      .then(([giraRes, inscRes]) => {
        setGira(giraRes.data);
        setInscricoes(inscRes.data);
      })
      .catch(() => router.push('/giras'))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePresenca = async (inscricaoId, status) => {
    await updatePresenca(inscricaoId, status);
    setInscricoes(prev => prev.map(i => i.id === inscricaoId ? { ...i, status } : i));
  };

  const handleCancelar = async (inscricaoId) => {
    if (!confirm('Remover esta inscrição?')) return;
    await cancelarInscricao(inscricaoId);
    setInscricoes(prev => prev.map(i => i.id === inscricaoId ? { ...i, status: 'cancelado' } : i));
  };

  const copyLink = () => {
    const link = `${window.location.origin}/public/${gira.slug_publico}`;
    navigator.clipboard.writeText(link);
    alert('Link copiado!');
  };

  const ativas = inscricoes.filter(i => i.status !== 'cancelado');
  const alertas = inscricoes.filter(i => i.score_presenca?.alerta).length;

  let filtradas = inscricoes.filter(i => filtro === 'todos' || i.status === filtro);

  // Ordenação
  filtradas = [...filtradas].sort((a, b) => {
    if (ordenar === 'posicao') return a.posicao - b.posicao;
    if (ordenar === 'alerta') {
      const aa = a.score_presenca?.alerta ? 0 : 1;
      const ba = b.score_presenca?.alerta ? 0 : 1;
      return aa - ba;
    }
    const sa = a.score_presenca?.score ?? (ordenar === 'score_asc' ? 999 : -1);
    const sb = b.score_presenca?.score ?? (ordenar === 'score_asc' ? 999 : -1);
    return ordenar === 'score_asc' ? sa - sb : sb - sa;
  });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner-gold"></div>
    </div>
  );
  if (!gira) return null;

  return (
    <>
      <Head><title>{gira.titulo} | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>{gira.titulo}</h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>
                <i className="bi bi-calendar3 me-1"></i>
                {new Date(gira.data + 'T00:00:00').toLocaleDateString('pt-BR')} às {gira.horario}
                {gira.responsavel_lista_nome && (
                  <span style={{ marginLeft: '1rem' }}>
                    <i className="bi bi-person-check me-1"></i>
                    Resp.: <strong style={{ color: 'var(--cor-acento)' }}>{gira.responsavel_lista_nome}</strong>
                  </span>
                )}
              </small>
            </div>
            <div className="d-flex gap-2 align-items-center flex-wrap">
              <span className={`badge-status badge-${gira.status}`}>{gira.status}</span>
              <Link href={`/giras/editar/${id}`} className="btn-outline-gold"
                style={{ fontSize: '0.85rem', textDecoration: 'none' }}>
                <i className="bi bi-pencil me-1"></i> Editar
              </Link>
              <button onClick={copyLink} className="btn-outline-gold" style={{ fontSize: '0.85rem' }}>
                <i className="bi bi-share me-1"></i> Compartilhar
              </button>
              <Link href="/giras" style={{ color: 'var(--cor-texto-suave)', textDecoration: 'none', fontSize: '0.9rem' }}>← Voltar</Link>
            </div>
          </div>

          <div className="page-content">
            {/* Stats */}
            <div className="row g-3 mb-4">
              <div className="col-6 col-md-3">
                <div className="stat-card">
                  <div className="stat-value">{ativas.length}</div>
                  <div className="stat-label">Inscritos</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="stat-card">
                  <div className="stat-value" style={{ color: '#10b981' }}>
                    {inscricoes.filter(i => i.status === 'compareceu').length}
                  </div>
                  <div className="stat-label">Compareceram</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="stat-card">
                  <div className="stat-value" style={{ color: '#ef4444' }}>
                    {inscricoes.filter(i => i.status === 'faltou').length}
                  </div>
                  <div className="stat-label">Faltaram</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="stat-card" style={{ position: 'relative' }}>
                  <div className="stat-value" style={{ color: alertas > 0 ? '#f97316' : 'var(--cor-texto)' }}>
                    {alertas}
                  </div>
                  <div className="stat-label">
                    {alertas > 0 ? '⚠ Faltantes crônicos' : 'Faltantes crônicos'}
                  </div>
                  {alertas > 0 && (
                    <div style={{ fontSize: '0.7rem', color: '#f97316', marginTop: '2px' }}>
                      3+ faltas, taxa &lt;50%
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Alerta de faltantes crônicos */}
            {alertas > 0 && (
              <div style={{
                background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)',
                borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.5rem',
                display: 'flex', alignItems: 'center', gap: '0.75rem',
              }}>
                <span style={{ fontSize: '1.2rem' }}>🚨</span>
                <div>
                  <strong style={{ color: '#f97316', fontSize: '0.9rem' }}>
                    {alertas} consulente{alertas > 1 ? 's' : ''} com histórico preocupante
                  </strong>
                  <div style={{ color: 'var(--cor-texto-suave)', fontSize: '0.8rem' }}>
                    Inscrito{alertas > 1 ? 's' : ''} nesta gira com 3+ faltas anteriores e taxa abaixo de 50%.
                    Considere dar prioridade a quem realmente aparece.
                  </div>
                </div>
                <button onClick={() => setOrdenar('alerta')}
                  style={{ marginLeft: 'auto', background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)',
                    color: '#f97316', borderRadius: '6px', padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  Ver primeiro
                </button>
              </div>
            )}

            <div className="card-custom">
              {/* Header com filtros e ordenação */}
              <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                  ✦ Lista de Consulentes
                </span>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginLeft: 'auto', alignItems: 'center' }}>
                  {/* Filtro por status */}
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    {['todos', 'confirmado', 'compareceu', 'faltou'].map(f => (
                      <button key={f} onClick={() => setFiltro(f)} style={{
                        background: filtro === f ? 'rgba(212,175,55,0.2)' : 'transparent',
                        border: '1px solid ' + (filtro === f ? 'var(--cor-acento)' : 'var(--cor-borda)'),
                        color: filtro === f ? 'var(--cor-acento)' : 'var(--cor-texto-suave)',
                        borderRadius: '6px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.72rem',
                      }}>
                        {f === 'todos' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                  {/* Ordenação */}
                  <select value={ordenar} onChange={e => setOrdenar(e.target.value)}
                    style={{ background: 'var(--cor-card)', border: '1px solid var(--cor-borda)',
                      color: 'var(--cor-texto-suave)', borderRadius: '6px', padding: '0.2rem 0.5rem',
                      fontSize: '0.72rem', cursor: 'pointer' }}>
                    <option value="posicao">Ordenar: Posição</option>
                    <option value="score_asc">Score: Menor primeiro</option>
                    <option value="score_desc">Score: Maior primeiro</option>
                    <option value="alerta">⚠ Alertas primeiro</option>
                  </select>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Nome</th>
                      <th>Histórico</th>
                      <th>Status</th>
                      <th className="d-none d-md-table-cell">Inscrito em</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map(i => {
                      const sc = i.score_presenca;
                      const rowBg = sc?.alerta ? 'rgba(239,68,68,0.04)' : 'transparent';
                      return (
                        <tr key={i.id} style={{ background: rowBg }}>
                          <td style={{ color: 'var(--cor-acento)', fontFamily: 'Cinzel', fontWeight: 700 }}>
                            {i.posicao}º
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <strong>{i.consulente_nome}</strong>
                              <AlertaFalta score={sc} />
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--cor-texto-suave)' }}>
                              {i.consulente_telefone}
                            </div>
                          </td>
                          <td>
                            {sc ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <ScoreBadge score={sc} />
                                {sc.finalizadas > 0 && (
                                  <span style={{ fontSize: '0.68rem', color: 'var(--cor-texto-suave)' }}>
                                    {sc.comparecimentos}✓ {sc.faltas}✗ / {sc.finalizadas} giras
                                  </span>
                                )}
                                {sc.finalizadas === 0 && (
                                  <span style={{ fontSize: '0.68rem', color: 'var(--cor-texto-suave)' }}>
                                    Sem histórico anterior
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--cor-texto-suave)', fontSize: '0.78rem' }}>—</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge-status badge-${i.status}`}>{i.status}</span>
                          </td>
                          <td className="d-none d-md-table-cell" style={{ color: 'var(--cor-texto-suave)', fontSize: '0.8rem' }}>
                            {new Date(i.created_at).toLocaleString('pt-BR')}
                          </td>
                          <td>
                            {i.status !== 'cancelado' && (
                              <div className="d-flex gap-1">
                                <button onClick={() => handlePresenca(i.id, 'compareceu')} title="Marcar presença"
                                  style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                                    color: '#10b981', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
                                  <i className="bi bi-check-lg"></i>
                                </button>
                                <button onClick={() => handlePresenca(i.id, 'faltou')} title="Marcar falta"
                                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                                    color: '#ef4444', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
                                  <i className="bi bi-x-lg"></i>
                                </button>
                                <button onClick={() => handleCancelar(i.id)} title="Remover"
                                  style={{ background: 'transparent', border: '1px solid var(--cor-borda)',
                                    color: 'var(--cor-texto-suave)', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
                                  <i className="bi bi-trash"></i>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filtradas.length === 0 && (
                      <tr><td colSpan="6">
                        <div className="empty-state">
                          <i className="bi bi-people d-block"></i>
                          <p>Nenhum consulente {filtro !== 'todos' ? `com status "${filtro}"` : 'inscrito'}</p>
                        </div>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Legenda dos scores */}
              <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--cor-borda)',
                display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>Score de presença:</span>
                {[
                  { emoji: '✅', label: 'Confiável ≥80%', cor: 'verde' },
                  { emoji: '⚠️', label: 'Regular 50–79%', cor: 'amarelo' },
                  { emoji: '🔶', label: 'Risco 20–49%', cor: 'laranja' },
                  { emoji: '🚫', label: 'Problemático <20%', cor: 'vermelho' },
                  { emoji: '🆕', label: 'Novo (< 2 giras)', cor: 'cinza' },
                ].map(s => {
                  const c = COR_SCORE[s.cor];
                  return (
                    <span key={s.cor} style={{ fontSize: '0.7rem', color: c.text,
                      background: c.bg, border: `1px solid ${c.border}`,
                      borderRadius: '20px', padding: '1px 8px' }}>
                      {s.emoji} {s.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}
