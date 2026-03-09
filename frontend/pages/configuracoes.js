import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import api from '../services/api';
import { handleApiError } from '../services/errorHandler';

export default function Configuracoes() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formSenha, setFormSenha] = useState({ senha_atual: '', nova_senha: '', confirmar: '' });
  const [msg, setMsg] = useState({ tipo: '', texto: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    api.get('/auth/me').then(r => setUser(r.data)).catch(() => router.push('/login')).finally(() => setLoading(false));
  }, []);

  const handleSenha = async (e) => {
    e.preventDefault();
    if (formSenha.nova_senha !== formSenha.confirmar) {
      setMsg({ tipo: 'erro', texto: 'As senhas não coincidem' });
      return;
    }
    setSaving(true);
    setMsg({ tipo: '', texto: '' });
    try {
      await api.patch('/auth/senha', { senha_atual: formSenha.senha_atual, nova_senha: formSenha.nova_senha });
      setMsg({ tipo: 'ok', texto: 'Senha alterada com sucesso!' });
      setFormSenha({ senha_atual: '', nova_senha: '', confirmar: '' });
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err.response?.data?.detail || 'Erro ao alterar senha' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner-gold"></div>
    </div>
  );

  return (
    <>
      <Head><title>Configurações | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>Configurações</h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>Gerenciar conta e preferências</small>
            </div>
          </div>

          <div className="page-content">
            <div className="row g-4">
              {/* Perfil */}
              <div className="col-md-6">
                <div className="card-custom">
                  <div className="card-header">
                    <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>✦ Meu Perfil</span>
                  </div>
                  <div className="p-4">
                    <div style={{
                      width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 1.5rem',
                      background: 'rgba(212,175,55,0.15)', border: '2px solid rgba(212,175,55,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--cor-acento)', fontFamily: 'Cinzel', fontWeight: '700', fontSize: '1.5rem'
                    }}>
                      {user?.nome?.charAt(0).toUpperCase()}
                    </div>

                    <div className="mb-3">
                      <label className="form-label-custom">Nome</label>
                      <input className="form-control-custom" value={user?.nome || ''} readOnly
                        style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label-custom">Email</label>
                      <input className="form-control-custom" value={user?.email || ''} readOnly
                        style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label-custom">Terreiro</label>
                      <input className="form-control-custom" value={user?.terreiro_nome || ''} readOnly
                        style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                    </div>
                    <div>
                      <label className="form-label-custom">Perfil</label>
                      <input className="form-control-custom" value={user?.role || ''} readOnly
                        style={{ opacity: 0.7, cursor: 'not-allowed', textTransform: 'capitalize' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Alterar senha */}
              <div className="col-md-6">
                <div className="card-custom">
                  <div className="card-header">
                    <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>✦ Alterar Senha</span>
                  </div>
                  <div className="p-4">
                    {msg.texto && (
                      <div className={`alert-custom ${msg.tipo === 'ok' ? 'alert-success-custom' : 'alert-danger-custom'} mb-3`}>
                        <i className={`bi ${msg.tipo === 'ok' ? 'bi-check-circle' : 'bi-exclamation-circle'} me-2`}></i>
                        {msg.texto}
                      </div>
                    )}
                    <form onSubmit={handleSenha}>
                      <div className="mb-3">
                        <label className="form-label-custom">Senha atual</label>
                        <input type="password" className="form-control-custom"
                          value={formSenha.senha_atual}
                          onChange={e => setFormSenha({ ...formSenha, senha_atual: e.target.value })}
                          required />
                      </div>
                      <div className="mb-3">
                        <label className="form-label-custom">Nova senha</label>
                        <input type="password" className="form-control-custom"
                          value={formSenha.nova_senha}
                          onChange={e => setFormSenha({ ...formSenha, nova_senha: e.target.value })}
                          required minLength={6} />
                      </div>
                      <div className="mb-4">
                        <label className="form-label-custom">Confirmar nova senha</label>
                        <input type="password" className="form-control-custom"
                          value={formSenha.confirmar}
                          onChange={e => setFormSenha({ ...formSenha, confirmar: e.target.value })}
                          required minLength={6} />
                      </div>
                      <button type="submit" className="btn-gold w-100" disabled={saving}>
                        {saving ? <span className="spinner-border spinner-border-sm me-2"></span> : null}
                        Alterar Senha
                      </button>
                    </form>
                  </div>
                </div>

                {/* Sair */}
                <div className="card-custom mt-4">
                  <div className="card-header">
                    <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: '#ef4444' }}>✦ Sessão</span>
                  </div>
                  <div className="p-4">
                    <p style={{ color: 'var(--cor-texto-suave)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                      Encerrar sessão atual neste dispositivo.
                    </p>
                    <button onClick={handleLogout}
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '8px', padding: '0.5rem 1.25rem', cursor: 'pointer', width: '100%' }}>
                      <i className="bi bi-box-arrow-right me-2"></i> Sair da conta
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}
