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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    // Busca consulentes agregando das inscrições de todas as giras
    api.get('/giras').then(async (girasRes) => {
      const giras = girasRes.data;
      const todos = {};
      await Promise.all(giras.map(async (g) => {
        try {
          const inscRes = await api.get(`/giras/${g.id}/inscricoes`);
          inscRes.data.forEach(i => {
            if (i.consulente_telefone && !todos[i.consulente_telefone]) {
              todos[i.consulente_telefone] = {
                nome: i.consulente_nome,
                telefone: i.consulente_telefone,
                totalInscricoes: 0,
                comparecimentos: 0,
              };
            }
            if (todos[i.consulente_telefone]) {
              todos[i.consulente_telefone].totalInscricoes++;
              if (i.status === 'compareceu') todos[i.consulente_telefone].comparecimentos++;
            }
          });
        } catch {}
      }));
      setConsulentes(Object.values(todos));
    }).catch(() => router.push('/login')).finally(() => setLoading(false));
  }, []);

  const filtrados = consulentes.filter(c =>
    c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone?.includes(busca)
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner-gold"></div>
    </div>
  );

  return (
    <>
      <Head><title>Consulentes | Terreiro SaaS</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>Consulentes</h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>{consulentes.length} consulentes cadastrados</small>
            </div>
            <input
              className="form-control-custom"
              placeholder="🔍  Buscar por nome ou telefone..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ width: '280px' }}
            />
          </div>

          <div className="page-content">
            <div className="card-custom">
              <div style={{ overflowX: 'auto' }}>
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Telefone</th>
                      <th>Total de Inscrições</th>
                      <th>Comparecimentos</th>
                      <th>Taxa de Presença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((c, idx) => {
                      const taxa = c.totalInscricoes > 0
                        ? Math.round((c.comparecimentos / c.totalInscricoes) * 100)
                        : 0;
                      return (
                        <tr key={idx}>
                          <td><strong>{c.nome}</strong></td>
                          <td style={{ color: 'var(--cor-texto-suave)' }}>{c.telefone}</td>
                          <td style={{ textAlign: 'center' }}>{c.totalInscricoes}</td>
                          <td style={{ textAlign: 'center', color: '#10b981' }}>{c.comparecimentos}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div className="vagas-bar" style={{ flex: 1 }}>
                                <div className="vagas-fill" style={{ width: `${taxa}%` }}></div>
                              </div>
                              <span style={{ fontSize: '0.8rem', color: 'var(--cor-texto-suave)', minWidth: '35px' }}>{taxa}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtrados.length === 0 && (
                      <tr><td colSpan="5">
                        <div className="empty-state">
                          <i className="bi bi-people d-block"></i>
                          <p>{busca ? 'Nenhum consulente encontrado' : 'Nenhum consulente ainda'}</p>
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
