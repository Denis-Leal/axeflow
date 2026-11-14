import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import axios from 'axios';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErro('');
    try {
      await axios.post('/api/auth/esqueci-senha/enviar', { email: email.trim() });
      setEnviado(true);
    } catch (error) {
      setErro(error?.response?.status === 429
        ? 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.'
        : 'Não foi possível processar a solicitação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Recuperar Senha | AxeFlow</title></Head>
      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-logo">
            <div className="symbol">☽✦☾</div>
            <h1>AxeFlow</h1>
            <p style={{ color: 'var(--cor-texto-suave)', fontSize: '0.85rem' }}>Recuperação de senha</p>
          </div>
          {enviado ? (
            <div role="status" style={{ textAlign: 'center' }}>
              <h2 style={{ color: 'var(--cor-acento)', fontSize: '1.2rem' }}>Verifique seu email</h2>
              <p style={{ color: 'var(--cor-texto-suave)', lineHeight: 1.7 }}>
                Se o email estiver cadastrado, você receberá instruções de recuperação em breve.
                Confira também a pasta de spam.
              </p>
              <p style={{ color: 'var(--cor-texto-suave)', fontSize: '0.85rem' }}>
                O link de recuperação expira em uma hora.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p style={{ color: 'var(--cor-texto-suave)', lineHeight: 1.7 }}>
                Informe seu email para receber as instruções de recuperação.
              </p>
              {erro && <div role="alert" className="alert-custom alert-danger-custom mb-3">{erro}</div>}
              <div className="mb-4">
                <label htmlFor="recuperacao-email" className="form-label-custom">Email</label>
                <input id="recuperacao-email" type="email" className="form-control-custom"
                  value={email} onChange={event => setEmail(event.target.value)}
                  required autoComplete="email" disabled={loading} />
              </div>
              <button type="submit" className="btn-gold w-100" disabled={loading} style={{ padding: '0.75rem' }}>
                {loading ? 'Enviando...' : 'Enviar instruções'}
              </button>
            </form>
          )}
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <Link href="/login" style={{ color: 'var(--cor-acento)' }}>Voltar para o login</Link>
          </div>
        </div>
      </div>
    </>
  );
}
