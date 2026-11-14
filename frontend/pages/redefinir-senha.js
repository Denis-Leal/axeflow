import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import axios from 'axios';
import { clearSession } from '../services/logout';
import { PASSWORD_POLICY_HINT, validateNewPassword } from '../utils/passwordPolicy';

export default function RedefinirSenha() {
  const router = useRouter();
  const [credencial, setCredencial] = useState(null);
  const tokenLido = useRef(false);
  const token = credencial?.token || '';
  const purpose = credencial?.purpose || 'reset';
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!router.isReady || tokenLido.current) return;
    tokenLido.current = true;
    const fragmento = new URLSearchParams(window.location.hash.slice(1));
    const tokenLegado = typeof router.query.token === 'string' ? router.query.token : '';
    const finalidade = fragmento.get('purpose') || router.query.purpose;
    setCredencial({
      token: fragmento.get('token') || tokenLegado,
      purpose: finalidade === 'invite' ? 'invite' : 'reset',
    });
    const urlLimpa = new URL(window.location.href);
    urlLimpa.hash = '';
    urlLimpa.searchParams.delete('token');
    urlLimpa.searchParams.delete('purpose');
    const caminhoLimpo = urlLimpa.pathname + urlLimpa.search;
    window.history.replaceState({ ...window.history.state, as: caminhoLimpo, url: caminhoLimpo }, '', caminhoLimpo);
  }, [router.isReady, router.query.token, router.query.purpose]);

  useEffect(() => {
    if (!sucesso) return;
    const timeout = setTimeout(() => window.location.replace('/login?senha=alterada'), 3000);
    return () => clearTimeout(timeout);
  }, [sucesso]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const passwordError = validateNewPassword(novaSenha);
    if (passwordError) {
      setErro(passwordError);
      return;
    }
    if (novaSenha !== confirmar) {
      setErro('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    setErro('');
    try {
      await axios.post('/api/auth/redefinir-senha', { token, nova_senha: novaSenha, purpose });
      clearSession();
      setNovaSenha('');
      setConfirmar('');
      setSucesso(true);
    } catch (error) {
      const status = error?.response?.status;
      if (status === 400) {
        setErro('Link inválido, expirado ou já utilizado. Solicite um novo link.');
      } else if (status === 429) {
        setErro('Muitas tentativas. Aguarde alguns minutos.');
      } else {
        setErro('Não foi possível definir a senha. Confira os requisitos e tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>{purpose === 'invite' ? 'Definir Senha' : 'Redefinir Senha'} | AxeFlow</title>
        <meta name="referrer" content="no-referrer" />
      </Head>
      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-logo">
            <div className="symbol">☽✦☾</div>
            <h1>AxeFlow</h1>
            <p style={{ color: 'var(--cor-texto-suave)', fontSize: '0.85rem' }}>
              {purpose === 'invite' ? 'Defina sua senha para aceitar o convite' : 'Redefina sua senha'}
            </p>
          </div>
          {!credencial ? null : !token ? (
            <div role="alert" style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--cor-texto-suave)' }}>Link inválido. Solicite um novo link para definir sua senha.</p>
              <Link href="/esqueci-senha" style={{ color: 'var(--cor-acento)' }}>Solicitar novo link</Link>
            </div>
          ) : sucesso ? (
            <div role="status" style={{ textAlign: 'center' }}>
              <h2 style={{ color: 'var(--cor-acento)', fontSize: '1.2rem' }}>Senha definida com sucesso</h2>
              <p style={{ color: 'var(--cor-texto-suave)', lineHeight: 1.7 }}>
                Faça login com sua nova senha. Você será direcionado ao login em instantes.
              </p>
              <a href="/login?senha=alterada" style={{ color: 'var(--cor-acento)' }}>Ir para o login</a>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {erro && <div role="alert" className="alert-custom alert-danger-custom mb-3">{erro}</div>}
              <div className="mb-3">
                <label htmlFor="pages-redefinir-senha-js-1" className="form-label-custom">Nova senha</label>
                <input id="pages-redefinir-senha-js-1" type={mostrarSenha ? 'text' : 'password'}
                  className="form-control-custom" value={novaSenha}
                  onChange={event => setNovaSenha(event.target.value)} required
                  autoComplete="new-password" aria-describedby="redefinir-senha-ajuda" />
                <small id="redefinir-senha-ajuda" style={{ color: 'var(--cor-texto-suave)' }}>{PASSWORD_POLICY_HINT}</small>
              </div>
              <div className="mb-3">
                <label htmlFor="pages-redefinir-senha-js-2" className="form-label-custom">Confirmar nova senha</label>
                <input id="pages-redefinir-senha-js-2" type={mostrarSenha ? 'text' : 'password'}
                  className="form-control-custom" value={confirmar}
                  onChange={event => setConfirmar(event.target.value)} required autoComplete="new-password" />
              </div>
              <label className="mb-4" style={{ color: 'var(--cor-texto-suave)', display: 'flex', gap: '0.5rem' }}>
                <input type="checkbox" checked={mostrarSenha} onChange={event => setMostrarSenha(event.target.checked)} />
                Mostrar senhas
              </label>
              <button type="submit" className="btn-gold w-100" disabled={loading} style={{ padding: '0.75rem' }}>
                {loading ? 'Salvando...' : 'Definir senha'}
              </button>
              <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                <Link href="/esqueci-senha" style={{ color: 'var(--cor-texto-suave)' }}>Solicitar novo link</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
