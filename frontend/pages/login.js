// =====================================================
// login.js — AxeFlow
// Página de autenticação do usuário.
//
// ALTERAÇÃO: adicionado link "Esqueci minha senha"
//   abaixo do campo de senha, aponta para /esqueci-senha.
//
// CORREÇÃO MULTI-TENANT (push notifications):
//   Após o login bem-sucedido, além do token JWT,
//   salvamos o terreiro_id do usuário no localStorage.
//   O _app.js usa esse valor para validar se uma
//   notificação push pertence ao terreiro logado antes
//   de navegar para a URL específica da gira.
// =====================================================

import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { login, getMe } from '../services/api';
import { handleApiError } from '../services/errorHandler';

export default function Login() {
  const router = useRouter();
  const [form, setForm]       = useState({ email: '', senha: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Autentica e salva o token JWT
      const res = await login(form.email, form.senha);
      localStorage.setItem('token', res.data.access_token);

      // 2. Busca dados do usuário para obter o terreiro_id
      //    Necessário para validar notificações push multi-tenant no _app.js
      try {
        const meRes = await getMe();
        if (meRes.data?.terreiro_id) {
          localStorage.setItem('terreiro_id', meRes.data.terreiro_id);
        }
      } catch {
        // Falha silenciosa: a falta do terreiro_id apenas desativa
        // a navegação específica nas notificações push (vai para /giras)
        console.warn('[Login] Não foi possível obter terreiro_id — push redirect será genérico.');
      }

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

          {/* ── Logo ── */}
          <div className="login-logo">
            <div className="symbol">☽✦☾</div>
            <h1>AxeFlow</h1>
            <p style={{ color: 'var(--cor-texto-suave)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Sistema de Gestão de Giras
            </p>
          </div>

          {/* ── Mensagem de erro ── */}
          {error && (
            <div className="alert-custom alert-danger-custom">
              <i className="bi bi-exclamation-circle me-2"></i>{error}
            </div>
          )}

          <form onSubmit={handleSubmit}>

            {/* Email */}
            <div className="mb-3">
              <label className="form-label-custom">Email</label>
              <input
                type="email"
                className="form-control-custom"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />
            </div>

            {/* Senha + link "Esqueci minha senha" */}
            <div className="mb-4">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                <label className="form-label-custom" style={{ margin: 0 }}>Senha</label>
                {/* Link discreto de recuperação — alinhado à direita do label */}
                <Link
                  href="/esqueci-senha"
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--cor-texto-suave)',
                    textDecoration: 'none',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.target.style.color = 'var(--cor-acento)'}
                  onMouseLeave={e => e.target.style.color = 'var(--cor-texto-suave)'}
                >
                  Esqueci minha senha
                </Link>
              </div>
              <input
                type="password"
                className="form-control-custom"
                value={form.senha}
                onChange={e => setForm({ ...form, senha: e.target.value })}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {/* Botão de login */}
            <button
              type="submit"
              className="btn-gold w-100"
              disabled={loading}
              style={{ padding: '0.75rem' }}
            >
              {loading
                ? <><span className="spinner-border spinner-border-sm me-2"></span>Entrando...</>
                : <><i className="bi bi-box-arrow-in-right me-2"></i>Entrar</>
              }
            </button>
          </form>

          {/* ── Divisor e link de registro ── */}
          <div className="divider-ornamental mt-4">
            <span style={{ fontSize: '0.8rem', color: 'var(--cor-texto-suave)' }}>ou</span>
          </div>

          <Link
            href="/registro"
            style={{
              display: 'block',
              textAlign: 'center',
              color: 'var(--cor-acento)',
              fontSize: '0.9rem',
              textDecoration: 'none',
            }}
          >
            Criar novo terreiro
          </Link>

        </div>
      </div>
    </>
  );
}