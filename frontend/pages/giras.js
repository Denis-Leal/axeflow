import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import { listGiras, deleteGira, getMe } from '../services/api';

export default function Giras() {
  const router = useRouter();
  const [giras, setGiras] = useState([]);
  const [userRole, setUserRole] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    // Mostra mensagem se veio redirecionado por falta de permissão
    if (router.query.erro === 'sem-permissao') {
      setErro('Sem permissão para acessar essa página. Apenas administradores e operadores podem criar ou editar giras.');
      setTimeout(() => setErro(''), 6000);
    }

    Promise.all([listGiras(), getMe()])
      .then(([girasRes, meRes]) => {
        setGiras(girasRes.data);
        setUserRole(meRes.data.role);
      })
      .catch(err => { if (err.response?.status === 401) { localStorage.removeItem('token'); router.push('/login'); } })
      .finally(() => setLoading(false));
  }, [router.query]);

  const podeGerenciar = ['admin', 'operador'].includes(userRole);
  const podeExcluir   = userRole === 'admin';

  const [erro, setErro] = useState('');

  const handleDelete = async (id) => {
    if (!confirm('Confirmar exclusão desta gira?')) return;
    try {
      await deleteGira(id);
      setGiras(prev => prev.filter(g => g.id !== id));
    } catch (err) {
      if (err.response?.status === 403) {
        setErro('Sem permissão para excluir giras. Apenas administradores podem fazer isso.');
      } else {
        setErro('Erro ao excluir a gira. Tente novamente.');
      }
      setTimeout(() => setErro(''), 5000);
    }
  };

  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

  if (loading) return <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}><div className="spinner-gold"></div></div>;

  return (
    <>
      <Head><title>Giras | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>Giras</h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>{giras.length} giras cadastradas</small>
            </div>
            {podeGerenciar && (
              <Link href="/giras/nova" className="btn-gold">
                <i className="bi bi-plus-lg me-1"></i> Nova Gira
              </Link>
            )}
          </div>
          <div className="page-content">
            {erro && (
              <div style={{
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: '10px', padding: '0.85rem 1.2rem', marginBottom: '1rem',
                color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}>
                <i className="bi bi-exclamation-triangle-fill"></i> {erro}
              </div>
            )}
            <div className="card-custom">
              <div style={{ overflowX: 'auto' }}>
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>Título</th>
                      <th>Tipo</th>
                      <th>Data</th>
                      <th>Horário</th>
                      <th>Vagas</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {giras.map(g => (
                      <tr key={g.id}>
                        <td><strong>{g.titulo}</strong></td>
                        <td style={{ color: 'var(--cor-texto-suave)' }}>{g.tipo || '—'}</td>
                        <td>{new Date(g.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                        <td>{g.horario}</td>
                        <td>
                          {g.acesso === 'fechada' ? (
                            <span
                              style={{
                                color: g.total_inscritos >= g.limite_membros
                                  ? '#ef4444'
                                  : 'var(--cor-sucesso)'
                              }}
                            >
                              {g.total_inscritos}/{g.limite_membros}
                            </span>
                          ) : (
                            <span
                              style={{
                                color: g.total_inscritos >= g.limite_consulentes
                                  ? '#ef4444'
                                  : 'var(--cor-sucesso)'
                              }}
                            >
                              {g.total_inscritos}/{g.limite_consulentes}
                            </span>
                          )}
                        </td>
                        <td><span className={`badge-status badge-${g.status}`}>{g.status}</span></td>
                        <td>
                          <div className="d-flex gap-1">
                            <Link href={`/giras/${g.id}`} className="btn-outline-gold" title="Ver inscrições" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>
                              <i className="bi bi-list-ul"></i>
                            </Link>
                            {podeGerenciar && (
                              <Link href={`/giras/editar/${g.id}`} className="btn-outline-gold" title="Editar gira" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>
                                <i className="bi bi-pencil"></i>
                              </Link>
                            )}
                            {g.slug_publico && (
                              <a href={`/public/${g.slug_publico}`} target="_blank" className="btn-outline-gold" title="Página pública" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>
                                <i className="bi bi-share"></i>
                              </a>
                            )}
                            {podeExcluir && (
                              <button onClick={() => handleDelete(g.id)} title="Excluir"
                                style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', borderRadius: '8px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                                <i className="bi bi-trash"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {giras.length === 0 && (
                      <tr><td colSpan="7">
                        <div className="empty-state">
                          <i className="bi bi-stars d-block"></i>
                          <p>Nenhuma gira cadastrada</p>
                          <Link href="/giras/nova" className="btn-gold">Criar primeira gira</Link>
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

// NOTE: ver também /giras/[id].js para detalhes e presença