import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { login } from '../services/api';
import { handleApiError } from '../services/errorHandler';

export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', senha: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await login(form.email, form.senha);
      localStorage.setItem('token', res.data.access_token);
      router.push('/dashboard');
    } catch (err) {
      setError(handleApiError(err, 'Login'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Login | AxeFlow</title></Head>
      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-logo">
            <div className="symbol">☽✦☾</div>
            <h1>AxeFlow</h1>
            <p style={{ color: 'var(--cor-texto-suave)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Sistema de Gestão de Giras
            </p>
          </div>

          {error && (
            <div className="alert-custom alert-danger-custom">
              <i className="bi bi-exclamation-circle me-2"></i>{error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label-custom">Email</label>
              <input
                type="email"
                className="form-control-custom"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="seu@email.com"
                required
              />
            </div>
            <div className="mb-4">
              <label className="form-label-custom">Senha</label>
              <input
                type="password"
                className="form-control-custom"
                value={form.senha}
                onChange={e => setForm({ ...form, senha: e.target.value })}
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" className="btn-gold w-100" disabled={loading} style={{ padding: '0.75rem' }}>
              {loading
                ? <><span className="spinner-border spinner-border-sm me-2"></span>Entrando...</>
                : <><i className="bi bi-box-arrow-in-right me-2"></i>Entrar</>
              }
            </button>
          </form>

          <div className="divider-ornamental mt-4">
            <span style={{ fontSize: '0.8rem', color: 'var(--cor-texto-suave)' }}>ou</span>
          </div>

          <a href="/registro" style={{ display: 'block', textAlign: 'center', color: 'var(--cor-acento)', fontSize: '0.9rem', textDecoration: 'none' }}>
            Criar novo terreiro
          </a>
        </div>
      </div>
    </>
  );
}
