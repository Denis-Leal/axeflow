import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import { listGiras, deleteGira } from '../services/api';

export default function Giras() {
  const router = useRouter();
  const [giras, setGiras] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    listGiras().then(r => setGiras(r.data)).catch(() => router.push('/login')).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Confirmar exclusão desta gira?')) return;
    await deleteGira(id);
    setGiras(prev => prev.filter(g => g.id !== id));
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
            <Link href="/giras/nova" className="btn-gold">
              <i className="bi bi-plus-lg me-1"></i> Nova Gira
            </Link>
          </div>
          <div className="page-content">
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
                          <span style={{ color: g.total_inscritos >= g.limite_consulentes ? '#ef4444' : 'var(--cor-sucesso)' }}>
                            {g.total_inscritos}/{g.limite_consulentes}
                          </span>
                        </td>
                        <td><span className={`badge-status badge-${g.status}`}>{g.status}</span></td>
                        <td>
                          <div className="d-flex gap-1">
                            <Link href={`/giras/${g.id}`} className="btn-outline-gold" title="Ver inscrições" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>
                              <i className="bi bi-list-ul"></i>
                            </Link>
                            <a href={`/public/${g.slug_publico}`} target="_blank" className="btn-outline-gold" title="Página pública" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>
                              <i className="bi bi-share"></i>
                            </a>
                            <button onClick={() => handleDelete(g.id)} title="Excluir"
                              style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', borderRadius: '8px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                              <i className="bi bi-trash"></i>
                            </button>
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
