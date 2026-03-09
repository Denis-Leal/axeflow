import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import api from '../services/api';

const ROLES = { admin: 'Admin', operador: 'Operador', membro: 'Membro' };
const ROLE_COLORS = { admin: '#d4af37', operador: '#a78bfa', membro: '#60a5fa' };

export default function Membros() {
  const router = useRouter();
  const [membros, setMembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', senha: '', telefone: '', role: 'membro' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [me, setMe] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    api.get('/auth/me').then(r => {
      setMe(r.data);
      return api.get(`/membros`);
    }).then(r => setMembros(r.data))
      .catch(() => {
        // endpoint de membros será criado; por ora usa só o próprio user
        api.get('/auth/me').then(r => setMembros([r.data]));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleConvidar = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      // Convida membro para o mesmo terreiro
      await api.post('/membros', form);
      setShowModal(false);
      setForm({ nome: '', email: '', senha: '', telefone: '', role: 'membro' });
      // Recarrega lista
      const r = await api.get('/membros');
      setMembros(r.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao convidar membro');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner-gold"></div>
    </div>
  );

  return (
    <>
      <Head><title>Membros | Terreiro SaaS</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>Membros</h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>Usuários do seu terreiro</small>
            </div>
            {me?.role === 'admin' && (
              <button className="btn-gold" onClick={() => setShowModal(true)}>
                <i className="bi bi-person-plus me-1"></i> Convidar Membro
              </button>
            )}
          </div>

          <div className="page-content">
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
                            <strong>{m.nome}</strong>
                            {me?.id === m.id && <span style={{ fontSize: '0.7rem', color: 'var(--cor-texto-suave)' }}>(você)</span>}
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
          </div>
        </div>
      </div>

      {/* Modal Convidar */}
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
      <BottomNav />
    </>
  );
}
