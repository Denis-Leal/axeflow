/**
 * pages/redefinir-senha.js — AxeFlow
 *
 * Página acessada pelo link enviado no email de recuperação.
 * URL: /redefinir-senha?token=<token_urlsafe>
 *
 * Estados possíveis:
 *   1. Token ausente na URL → redireciona para /esqueci-senha
 *   2. Formulário de nova senha → usuário digita e confirma
 *   3. Sucesso → exibe confirmação e redireciona para /login após 3s
 *   4. Erro (token inválido/expirado) → orienta a solicitar novo link
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import axios from 'axios';
import { handleApiError } from '../services/errorHandler';

export default function RedefinirSenha() {
  const router = useRouter();

  // ── Extrai token da query string ──────────────────────────────────────────
  const { token } = router.query;

  // ── Estado da página ──────────────────────────────────────────────────────
  const [novaSenha,    setNovaSenha]    = useState('');
  const [confirmar,    setConfirmar]    = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);  // toggle visibilidade
  const [loading,      setLoading]      = useState(false);
  const [sucesso,      setSucesso]      = useState(false);
  const [erro,         setErro]         = useState('');
  const [countdown,    setCountdown]    = useState(3);  // contagem regressiva pós-sucesso

  // ── Redireciona para login após sucesso ───────────────────────────────────
  useEffect(() => {
    if (!sucesso) return;

    // Countdown de 3s antes de redirecionar
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          router.push('/login');
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sucesso]);

  // ── Validação local antes de enviar ──────────────────────────────────────
  const senhaValida   = novaSenha.length >= 6;
  const senhasIguais  = novaSenha === confirmar && confirmar.length > 0;
  const podeEnviar    = senhaValida && senhasIguais && !loading;

  // ── Envio do formulário ───────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!senhaValida) {
      setErro(handleApiError({ response: { data: { detail: 'A senha deve ter no mínimo 6 caracteres.' } } }, 'Redefinir Senha'));
      return;
    }
    if (!senhasIguais) {
      setErro(handleApiError({ response: { data: { detail: 'As senhas não coincidem.' } } }, 'Redefinir Senha'));
      return;
    }

    setLoading(true);
    setErro('');

    try {
      await axios.post('/api/auth/redefinir-senha', {
        token:      token,
        nova_senha: novaSenha,
      });
      setSucesso(true);
    } catch (err) {
      const status  = err?.response?.status;
      const detalhe = err?.response?.data?.detail;

      if (status === 400) {
        setErro(handleApiError({ response: { data: { detail: detalhe || 'Link inválido ou expirado. Solicite um novo.' } } }, 'Redefinir Senha'));
      } else if (status === 429) {
        setErro(handleApiError({ response: { data: { detail: 'Muitas tentativas. Aguarde alguns minutos.' } } }, 'Redefinir Senha'));
      } else {
        setErro(handleApiError({ response: { data: { detail: 'Erro ao redefinir a senha. Tente novamente.' } } }, 'Redefinir Senha'));
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Token ausente: aguarda router.isReady ─────────────────────────────────
  if (!router.isReady) return null;

  // ── Token não informado na URL ────────────────────────────────────────────
  if (!token) {
    return (
      <>
        <Head><title>Link Inválido | AxeFlow</title></Head>
        <div className="login-wrapper">
          <div className="login-card" style={{ textAlign: 'center' }}>
            <div className="login-logo">
              <div className="symbol">☽✦☾</div>
              <h1>AxeFlow</h1>
            </div>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem',
            }}>
              <i className="bi bi-x-circle" style={{ fontSize: '1.5rem', color: '#ef4444' }}></i>
            </div>
            <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', marginBottom: '0.75rem' }}>
              Link inválido
            </h5>
            <p style={{ color: 'var(--cor-texto-suave)', fontSize: '0.88rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Este link de recuperação é inválido ou já foi utilizado.
              Solicite um novo link para redefinir sua senha.
            </p>
            <Link href="/esqueci-senha" className="btn-gold" style={{
              display: 'inline-block', textDecoration: 'none', padding: '0.65rem 1.5rem',
            }}>
              Solicitar novo link
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head><title>Redefinir Senha | AxeFlow</title></Head>
      <div className="login-wrapper">
        <div className="login-card">

          {/* ── Logo ── */}
          <div className="login-logo">
            <div className="symbol">☽✦☾</div>
            <h1>AxeFlow</h1>
            <p style={{ color: 'var(--cor-texto-suave)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Nova Senha
            </p>
          </div>

          {/* ════════════════════════════════════════════════════════════
              TELA DE SUCESSO
          ════════════════════════════════════════════════════════════ */}
          {sucesso ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}>
                <i className="bi bi-check-lg" style={{ fontSize: '1.75rem', color: '#10b981' }}></i>
              </div>

              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', marginBottom: '0.75rem' }}>
                Senha redefinida!
              </h5>
              <p style={{ color: 'var(--cor-texto-suave)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                Sua senha foi alterada com sucesso.
                Redirecionando para o login em{' '}
                <strong style={{ color: 'var(--cor-acento)' }}>{countdown}s</strong>...
              </p>

              <Link href="/login" style={{
                color: 'var(--cor-acento)', fontSize: '0.9rem', textDecoration: 'none',
              }}>
                Ir para o login agora →
              </Link>
            </div>

          ) : (

          /* ════════════════════════════════════════════════════════════
              FORMULÁRIO DE NOVA SENHA
          ════════════════════════════════════════════════════════════ */
            <>
              <p style={{
                color: 'var(--cor-texto-suave)', fontSize: '0.88rem',
                lineHeight: 1.7, marginBottom: '1.5rem', textAlign: 'center',
              }}>
                Digite e confirme sua nova senha abaixo.
              </p>

              {/* Mensagem de erro */}
              {erro && (
                <div className="alert-custom alert-danger-custom mb-3">
                  <i className="bi bi-exclamation-circle me-2"></i>
                  {erro}
                  {/* Se o erro for de link expirado, oferece novo link */}
                  {(erro.includes('inválido') || erro.includes('expirado')) && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <Link href="/esqueci-senha" style={{ color: '#d4af37', fontSize: '0.82rem' }}>
                        Solicitar novo link →
                      </Link>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit}>

                {/* Nova senha */}
                <div className="mb-3">
                  <label className="form-label-custom">Nova senha</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      className="form-control-custom"
                      style={{ paddingRight: '2.75rem' }}
                      value={novaSenha}
                      onChange={e => setNovaSenha(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    {/* Toggle de visibilidade da senha */}
                    <button
                      type="button"
                      onClick={() => setMostrarSenha(v => !v)}
                      style={{
                        position: 'absolute', right: '0.75rem', top: '50%',
                        transform: 'translateY(-50%)', background: 'none',
                        border: 'none', cursor: 'pointer', padding: 0,
                        color: 'var(--cor-texto-suave)', fontSize: '0.9rem',
                      }}
                      tabIndex={-1}
                      aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      <i className={`bi bi-eye${mostrarSenha ? '-slash' : ''}`}></i>
                    </button>
                  </div>

                  {/* Indicador de força da senha */}
                  {novaSenha.length > 0 && (
                    <div style={{ marginTop: '0.4rem' }}>
                      <div style={{
                        height: '3px', borderRadius: '2px',
                        background: 'rgba(255,255,255,0.08)',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', borderRadius: '2px',
                          transition: 'width 0.3s, background 0.3s',
                          width: novaSenha.length < 6  ? '25%'
                               : novaSenha.length < 10 ? '60%'
                               : '100%',
                          background: novaSenha.length < 6  ? '#ef4444'
                                    : novaSenha.length < 10 ? '#f59e0b'
                                    : '#10b981',
                        }} />
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--cor-texto-suave)', marginTop: '2px' }}>
                        {novaSenha.length < 6  ? 'Muito curta'
                         : novaSenha.length < 10 ? 'Razoável'
                         : 'Boa senha'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirmar senha */}
                <div className="mb-4">
                  <label className="form-label-custom">Confirmar nova senha</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      className="form-control-custom"
                      style={{
                        paddingRight: '2.75rem',
                        borderColor: confirmar.length > 0
                          ? senhasIguais ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'
                          : undefined,
                      }}
                      value={confirmar}
                      onChange={e => setConfirmar(e.target.value)}
                      placeholder="Repita a senha"
                      required
                      autoComplete="new-password"
                    />
                    {/* Ícone de feedback de confirmação */}
                    {confirmar.length > 0 && (
                      <span style={{
                        position: 'absolute', right: '0.75rem', top: '50%',
                        transform: 'translateY(-50%)',
                        color: senhasIguais ? '#10b981' : '#ef4444',
                        fontSize: '0.9rem',
                      }}>
                        <i className={`bi bi-${senhasIguais ? 'check-circle' : 'x-circle'}`}></i>
                      </span>
                    )}
                  </div>
                  {confirmar.length > 0 && !senhasIguais && (
                    <small style={{ color: '#ef4444', fontSize: '0.75rem' }}>
                      As senhas não coincidem
                    </small>
                  )}
                </div>

                {/* Botão de envio */}
                <button
                  type="submit"
                  className="btn-gold w-100"
                  disabled={!podeEnviar}
                  style={{ padding: '0.75rem' }}
                >
                  {loading ? (
                    <><span className="spinner-border spinner-border-sm me-2"></span>Redefinindo...</>
                  ) : (
                    <><i className="bi bi-lock me-2"></i>Redefinir senha</>
                  )}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                <Link href="/login" style={{ color: 'var(--cor-texto-suave)', fontSize: '0.85rem', textDecoration: 'none' }}>
                  ← Voltar ao login
                </Link>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}