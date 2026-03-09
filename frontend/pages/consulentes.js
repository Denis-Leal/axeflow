import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import api from '../services/api';

export default function Consulentes() {
  const router = useRouter();
  const [consulentes, setConsulentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos'); // todos | primeira | retornante

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    api.get('/membros/consulentes-lista')
      .then(res => setConsulentes(res.data))
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, []);

  const filtrados = consulentes.filter(c => {
    const buscaOk = c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
                    c.telefone?.includes(busca);
    const filtroOk = filtro === 'todos'
      ? true
      : filtro === 'primeira'
        ? c.primeira_visita === true
        : c.primeira_visita === false;
    return buscaOk && filtroOk;
  });

  const totalPrimeira   = consulentes.filter(c => c.primeira_visita).length;
  const totalRetornante = consulentes.filter(c => !c.primeira_visita).length;

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

          {/* Topbar */}
          <div className="topbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>Consulentes</h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>{consulentes.length} consulente{consulentes.length !== 1 ? 's' : ''} cadastrado{consulentes.length !== 1 ? 's' : ''}</small>
            </div>
            <input
              className="form-control-custom"
              placeholder="🔍  Buscar por nome ou telefone..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ width: '260px', maxWidth: '100%' }}
            />
          </div>

          <div className="page-content">

            {/* Cards de resumo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <button
                onClick={() => setFiltro('todos')}
                className="stat-card"
                style={{ textAlign: 'left', cursor: 'pointer', border: filtro === 'todos' ? '1px solid var(--cor-acento)' : undefined }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--cor-texto-suave)', marginBottom: '0.25rem' }}>Total</div>
                <div className="stat-value">{consulentes.length}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--cor-texto-suave)' }}>Consulentes</div>
              </button>

              <button
                onClick={() => setFiltro('primeira')}
                className="stat-card"
                style={{ textAlign: 'left', cursor: 'pointer', border: filtro === 'primeira' ? '1px solid #f59e0b' : undefined }}
              >
                <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginBottom: '0.25rem' }}>
                  <i className="bi bi-star me-1"></i>Primeira Visita
                </div>
                <div className="stat-value" style={{ color: '#f59e0b' }}>{totalPrimeira}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--cor-texto-suave)' }}>Nunca retornaram</div>
              </button>

              <button
                onClick={() => setFiltro('retornante')}
                className="stat-card"
                style={{ textAlign: 'left', cursor: 'pointer', border: filtro === 'retornante' ? '1px solid #10b981' : undefined }}
              >
                <div style={{ fontSize: '0.75rem', color: '#10b981', marginBottom: '0.25rem' }}>
                  <i className="bi bi-arrow-repeat me-1"></i>Retornantes
                </div>
                <div className="stat-value" style={{ color: '#10b981' }}>{totalRetornante}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--cor-texto-suave)' }}>Já retornaram</div>
              </button>
            </div>

            {/* Tabela */}
            <div className="card-custom">
              {filtro !== 'todos' && (
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--cor-borda)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--cor-texto-suave)' }}>
                    Filtrando: <strong style={{ color: filtro === 'primeira' ? '#f59e0b' : '#10b981' }}>
                      {filtro === 'primeira' ? '⭐ Primeira Visita' : '🔄 Retornantes'}
                    </strong> — {filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => setFiltro('todos')}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--cor-texto-suave)', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    ✕ Limpar filtro
                  </button>
                </div>
              )}

              <div style={{ overflowX: 'auto' }}>
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Telefone</th>
                      <th style={{ textAlign: 'center' }}>Visita</th>
                      <th style={{ textAlign: 'center' }}>Inscrições</th>
                      <th style={{ textAlign: 'center' }}>Comparecimentos</th>
                      <th>Taxa de Presença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((c) => {
                      const taxa = c.total_inscricoes > 0
                        ? Math.round((c.comparecimentos / c.total_inscricoes) * 100)
                        : 0;
                      return (
                        <tr key={c.id}>
                          <td>
                            <strong>{c.nome}</strong>
                          </td>
                          <td style={{ color: 'var(--cor-texto-suave)', fontSize: '0.85rem' }}>
                            {c.telefone}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {c.primeira_visita ? (
                              <span style={{
                                background: 'rgba(245,158,11,0.15)',
                                color: '#f59e0b',
                                border: '1px solid rgba(245,158,11,0.3)',
                                borderRadius: '20px',
                                padding: '2px 10px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}>
                                ⭐ 1ª visita
                              </span>
                            ) : (
                              <span style={{
                                background: 'rgba(16,185,129,0.12)',
                                color: '#10b981',
                                border: '1px solid rgba(16,185,129,0.25)',
                                borderRadius: '20px',
                                padding: '2px 10px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}>
                                🔄 Retornante
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>{c.total_inscricoes}</td>
                          <td style={{ textAlign: 'center', color: '#10b981' }}>{c.comparecimentos}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div className="vagas-bar" style={{ flex: 1 }}>
                                <div className="vagas-fill" style={{ width: `${taxa}%` }}></div>
                              </div>
                              <span style={{ fontSize: '0.8rem', color: 'var(--cor-texto-suave)', minWidth: '35px' }}>
                                {taxa}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtrados.length === 0 && (
                      <tr><td colSpan="6">
                        <div className="empty-state">
                          <i className="bi bi-people d-block"></i>
                          <p>{busca || filtro !== 'todos' ? 'Nenhum consulente encontrado' : 'Nenhum consulente ainda'}</p>
                          <small style={{ color: 'var(--cor-texto-suave)' }}>
                            Os consulentes aparecem aqui após realizarem inscrições em giras
                          </small>
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
