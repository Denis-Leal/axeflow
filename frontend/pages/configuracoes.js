// =====================================================
// configuracoes.js — AxeFlow
// Página de configurações de conta.
//
// CORREÇÃO: handleLogout agora usa o helper centralizado
//   de logout (services/logout.js), que remove a push
//   subscription do browser e do backend antes de limpar
//   o localStorage e redirecionar para /login.
// =====================================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import { getMe, changePassword } from '../services/api';
import { handleApiError } from '../services/errorHandler';
import { logout } from '../services/logout';

export default function Configuracoes() {
  const router   = useRouter();
  const [user, setUser]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [formSenha, setFormSenha] = useState({ senha_atual: '', nova_senha: '', confirmar: '' });
  const [msg, setMsg]             = useState({ tipo: '', texto: '' });
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    getMe()
      .then(r => setUser(r.data))
      .catch(err => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('terreiro_id');
          router.push('/login');
        }
      })
      .finally(() => setLoading(false));
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
      await changePassword({
        senha_atual: formSenha.senha_atual,
        nova_senha:  formSenha.nova_senha,
      });
      setMsg({ tipo: 'ok', texto: 'Senha alterada com sucesso!' });
      setFormSenha({ senha_atual: '', nova_senha: '', confirmar: '' });
    } catch (err) {
      handleApiError(err, setMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    // Evita duplo clique durante o processo de logout
    if (loggingOut) return;
    setLoggingOut(true);
    // Remove push subscription + limpa localStorage + redireciona
    await logout(router);
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
                    <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>✦ Perfil</span>
                  </div>
                  <div className="p-4">
                    <div className="mb-2">
                      <span style={{ color: 'var(--cor-texto-suave)', fontSize: '0.8rem' }}>Nome</span>
                      <div style={{ color: 'var(--cor-texto)', fontSize: '1rem' }}>{user?.nome}</div>
                    </div>
                    <div className="mb-2">
                      <span style={{ color: 'var(--cor-texto-suave)', fontSize: '0.8rem' }}>Email</span>
                      <div style={{ color: 'var(--cor-texto)', fontSize: '1rem' }}>{user?.email}</div>
                    </div>
                    <div className="mb-2">
                      <span style={{ color: 'var(--cor-texto-suave)', fontSize: '0.8rem' }}>Terreiro</span>
                      <div style={{ color: 'var(--cor-texto)', fontSize: '1rem' }}>{user?.terreiro_nome}</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--cor-texto-suave)', fontSize: '0.8rem' }}>Perfil</span>
                      <div style={{ color: 'var(--cor-acento)', fontSize: '1rem', textTransform: 'capitalize' }}>{user?.role}</div>
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
                    <button
                      onClick={handleLogout}
                      disabled={loggingOut}
                      style={{
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        color: '#ef4444',
                        borderRadius: '8px',
                        padding: '0.5rem 1.25rem',
                        cursor: loggingOut ? 'not-allowed' : 'pointer',
                        width: '100%',
                        opacity: loggingOut ? 0.7 : 1,
                      }}
                    >
                      {loggingOut
                        ? <><span className="spinner-border spinner-border-sm me-2"></span>Saindo...</>
                        : <><i className="bi bi-box-arrow-right me-2"></i>Sair da conta</>
                      }
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