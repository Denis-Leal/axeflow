import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Sidebar from '../../components/Sidebar';
import BottomNav from '../../components/BottomNav';
import { getGira, listInscricoes, updatePresenca, cancelarInscricao } from '../../services/api';

export default function GiraDetalhe() {
  const router = useRouter();
  const { id } = router.query;
  const [gira, setGira] = useState(null);
  const [inscricoes, setInscricoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');

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

  const filtradas = inscricoes.filter(i => filtro === 'todos' || i.status === filtro);

  if (loading) return <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}><div className="spinner-gold"></div></div>;
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
            <div className="d-flex gap-2 align-items-center">
              <span className={`badge-status badge-${gira.status}`}>{gira.status}</span>
              <button onClick={copyLink} className="btn-outline-gold" style={{ fontSize: '0.85rem' }}>
                <i className="bi bi-share me-1"></i> Compartilhar
              </button>
              <Link href="/giras" style={{ color: 'var(--cor-texto-suave)', textDecoration: 'none', fontSize: '0.9rem' }}>← Voltar</Link>
            </div>
          </div>
          <div className="page-content">
            {/* Stats row */}
            <div className="row g-3 mb-4">
              <div className="col-md-3">
                <div className="stat-card">
                  <div className="stat-value">{inscricoes.filter(i => i.status !== 'cancelado').length}</div>
                  <div className="stat-label">Inscritos</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="stat-card">
                  <div className="stat-value" style={{ color: '#10b981' }}>{inscricoes.filter(i => i.status === 'compareceu').length}</div>
                  <div className="stat-label">Compareceram</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="stat-card">
                  <div className="stat-value" style={{ color: '#ef4444' }}>{inscricoes.filter(i => i.status === 'faltou').length}</div>
                  <div className="stat-label">Faltaram</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="stat-card">
                  <div className="stat-value">{Math.max(0, gira.limite_consulentes - inscricoes.filter(i => i.status !== 'cancelado').length)}</div>
                  <div className="stat-label">Vagas Livres</div>
                </div>
              </div>
            </div>

            <div className="card-custom">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>✦ Lista de Consulentes</span>
                <div className="d-flex gap-2">
                  {['todos', 'confirmado', 'compareceu', 'faltou', 'cancelado'].map(f => (
                    <button key={f} onClick={() => setFiltro(f)}
                      style={{
                        background: filtro === f ? 'rgba(212,175,55,0.2)' : 'transparent',
                        border: '1px solid ' + (filtro === f ? 'var(--cor-acento)' : 'var(--cor-borda)'),
                        color: filtro === f ? 'var(--cor-acento)' : 'var(--cor-texto-suave)',
                        borderRadius: '6px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem'
                      }}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Nome</th>
                      <th>Telefone</th>
                      <th>Status</th>
                      <th>Inscrito em</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map(i => (
                      <tr key={i.id}>
                        <td style={{ color: 'var(--cor-acento)', fontFamily: 'Cinzel', fontWeight: '700' }}>{i.posicao}º</td>
                        <td><strong>{i.consulente_nome}</strong></td>
                        <td style={{ color: 'var(--cor-texto-suave)' }}>{i.consulente_telefone}</td>
                        <td><span className={`badge-status badge-${i.status}`}>{i.status}</span></td>
                        <td style={{ color: 'var(--cor-texto-suave)', fontSize: '0.8rem' }}>
                          {new Date(i.created_at).toLocaleString('pt-BR')}
                        </td>
                        <td>
                          {i.status !== 'cancelado' && (
                            <div className="d-flex gap-1">
                              <button onClick={() => handlePresenca(i.id, 'compareceu')} title="Marcar presença"
                                style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
                                <i className="bi bi-check-lg"></i>
                              </button>
                              <button onClick={() => handlePresenca(i.id, 'faltou')} title="Marcar falta"
                                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
                                <i className="bi bi-x-lg"></i>
                              </button>
                              <button onClick={() => handleCancelar(i.id)} title="Remover"
                                style={{ background: 'transparent', border: '1px solid var(--cor-borda)', color: 'var(--cor-texto-suave)', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
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
            </div>
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}
