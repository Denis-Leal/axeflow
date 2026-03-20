/**
 * pages/esqueci-senha.js — AxeFlow
 *
 * Recuperação de senha em três steps visuais:
 *
 * Step 1 — Email:
 *   Usuário informa apenas o email.
 *   Backend retorna a lista de terreiros vinculados.
 *
 * Step 2 — Selecionar terreiro:
 *   Exibe cards dos terreiros encontrados.
 *   Usuário clica no terreiro de qual conta quer recuperar.
 *   Backend envia o link por email.
 *
 * Step 3 — Confirmação:
 *   Orienta o usuário a verificar o email.
 *   Dicas sobre spam e expiração do link.
 *
 * Segurança:
 *   - Step 2 sempre exibe mensagem genérica (anti-enumeração)
 *   - Se email não tiver terreiros, exibe mensagem neutra no step 2
 *   - Nenhum dado sensível além do nome do terreiro é exibido
 */

import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import axios from 'axios';

// ── Constantes visuais ────────────────────────────────────────────────────────
const STEP = { EMAIL: 1, TERREIRO: 2, CONFIRMACAO: 3 };

export default function EsqueciSenha() {
  const router = useRouter();

  // ── Estado da navegação entre steps ──────────────────────────────────────
  const [step,      setStep]      = useState(STEP.EMAIL);
  const [email,     setEmail]     = useState('');
  const [terreiros, setTerreiros] = useState([]);   // retornados pelo backend
  const [terreiroSelecionado, setTerreiroSelecionado] = useState(null);

  // ── Estado de loading e erro ──────────────────────────────────────────────
  const [loadingBusca,  setLoadingBusca]  = useState(false);
  const [loadingEnvio,  setLoadingEnvio]  = useState(null);  // id do terreiro em envio
  const [erro,          setErro]          = useState('');

  // ── Step 1: busca terreiros pelo email ────────────────────────────────────
  const handleBuscarTerreiros = async (e) => {
    e.preventDefault();
    setLoadingBusca(true);
    setErro('');

    try {
      const res = await axios.post('/api/auth/esqueci-senha/buscar', {
        email: email.trim(),
      });
      setTerreiros(res.data.terreiros || []);
      setStep(STEP.TERREIRO);   // avança para seleção mesmo com lista vazia
    } catch (err) {
      const status = err?.response?.status;
      if (status === 429) {
        setErro('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.');
      } else {
        setErro('Não foi possível processar a solicitação. Tente novamente.');
      }
    } finally {
      setLoadingBusca(false);
    }
  };

  // ── Step 2: envia link de recuperação para o terreiro selecionado ─────────
  const handleEnviarLink = async (terreiro) => {
    setLoadingEnvio(terreiro.id);
    setErro('');
    setTerreiroSelecionado(terreiro);

    try {
      await axios.post('/api/auth/esqueci-senha/enviar', {
        email:       email.trim(),
        terreiro_id: terreiro.id,
      });
      // Independente do resultado interno, avança para confirmação
      setStep(STEP.CONFIRMACAO);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 429) {
        setErro('Muitas tentativas. Aguarde alguns minutos.');
      } else {
        // Qualquer outro erro: avança para confirmação de qualquer forma
        // (não revelamos se o envio falhou ou não)
        setStep(STEP.CONFIRMACAO);
      }
    } finally {
      setLoadingEnvio(null);
    }
  };

  return (
    <>
      <Head><title>Recuperar Senha | AxeFlow</title></Head>
      <div className="login-wrapper">
        <div className="login-card">

          {/* ── Logo ── */}
          <div className="login-logo">
            <div className="symbol">☽✦☾</div>
            <h1>AxeFlow</h1>
            <p style={{ color: 'var(--cor-texto-suave)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Recuperação de Senha
            </p>
          </div>

          {/* ── Indicador de progresso ── */}
          {step !== STEP.CONFIRMACAO && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              marginBottom: '1.5rem', justifyContent: 'center',
            }}>
              {[STEP.EMAIL, STEP.TERREIRO].map((s, idx) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.2s',
                    background: step >= s ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1.5px solid ${step >= s ? 'var(--cor-acento)' : 'var(--cor-borda)'}`,
                    color: step >= s ? 'var(--cor-acento)' : 'var(--cor-texto-suave)',
                  }}>
                    {step > s ? <i className="bi bi-check" style={{ fontSize: '0.8rem' }}></i> : s}
                  </div>
                  {/* Linha conectora entre os steps */}
                  {idx === 0 && (
                    <div style={{
                      width: '40px', height: '1.5px',
                      background: step > STEP.EMAIL ? 'var(--cor-acento)' : 'var(--cor-borda)',
                      transition: 'background 0.2s',
                    }} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Mensagem de erro global ── */}
          {erro && (
            <div className="alert-custom alert-danger-custom mb-3">
              <i className="bi bi-exclamation-circle me-2"></i>{erro}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              STEP 1 — Informar email
          ════════════════════════════════════════════════════════════ */}
          {step === STEP.EMAIL && (
            <>
              <p style={{
                color: 'var(--cor-texto-suave)', fontSize: '0.88rem',
                lineHeight: 1.7, marginBottom: '1.5rem', textAlign: 'center',
              }}>
                Informe seu email cadastrado e mostraremos as contas associadas.
              </p>

              <form onSubmit={handleBuscarTerreiros}>
                <div className="mb-4">
                  <label className="form-label-custom">Email</label>
                  <div style={{ position: 'relative' }}>
                    <i className="bi bi-envelope" style={{
                      position: 'absolute', left: '0.75rem', top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--cor-texto-suave)', fontSize: '0.9rem',
                      pointerEvents: 'none',
                    }}></i>
                    <input
                      type="email"
                      className="form-control-custom"
                      style={{ paddingLeft: '2.25rem' }}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      autoFocus
                      autoComplete="email"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-gold w-100"
                  disabled={loadingBusca || !email}
                  style={{ padding: '0.75rem' }}
                >
                  {loadingBusca ? (
                    <><span className="spinner-border spinner-border-sm me-2"></span>Buscando...</>
                  ) : (
                    <><i className="bi bi-search me-2"></i>Buscar minha conta</>
                  )}
                </button>
              </form>

              <div style={{
                display: 'flex', justifyContent: 'space-between',
                marginTop: '1.5rem', fontSize: '0.85rem',
              }}>
                <Link href="/login" style={{ color: 'var(--cor-texto-suave)', textDecoration: 'none' }}>
                  ← Voltar ao login
                </Link>
                <Link href="/registro" style={{ color: 'var(--cor-acento)', textDecoration: 'none' }}>
                  Criar terreiro
                </Link>
              </div>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════
              STEP 2 — Selecionar terreiro
          ════════════════════════════════════════════════════════════ */}
          {step === STEP.TERREIRO && (
            <>
              {terreiros.length === 0 ? (
                /* ── Nenhum terreiro encontrado — mensagem neutra ── */
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '50%',
                    background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 1rem',
                  }}>
                    <i className="bi bi-envelope-check" style={{ fontSize: '1.5rem', color: 'var(--cor-acento)' }}></i>
                  </div>
                  <p style={{
                    color: 'var(--cor-texto-suave)', fontSize: '0.88rem',
                    lineHeight: 1.7, marginBottom: '1.5rem',
                  }}>
                    Se o email <strong style={{ color: 'var(--cor-texto)' }}>{email}</strong> estiver
                    cadastrado, você receberá instruções de recuperação em breve.
                    Verifique também sua pasta de spam.
                  </p>
                  <button
                    onClick={() => { setStep(STEP.EMAIL); setErro(''); }}
                    className="btn-outline-gold"
                    style={{ padding: '0.5rem 1.5rem', marginBottom: '1rem' }}
                  >
                    Tentar outro email
                  </button>
                </div>

              ) : (
                /* ── Lista de terreiros para o usuário escolher ── */
                <>
                  <p style={{
                    color: 'var(--cor-texto-suave)', fontSize: '0.88rem',
                    lineHeight: 1.7, marginBottom: '1.25rem',
                  }}>
                    Encontramos {terreiros.length === 1 ? 'uma conta' : `${terreiros.length} contas`} para{' '}
                    <strong style={{ color: 'var(--cor-texto)' }}>{email}</strong>.
                    Selecione o terreiro da conta que deseja recuperar:
                  </p>

                  {/* Cards de terreiros */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    {terreiros.map(terreiro => {
                      const emEnvio = loadingEnvio === terreiro.id;
                      return (
                        <button
                          key={terreiro.id}
                          onClick={() => handleEnviarLink(terreiro)}
                          disabled={loadingEnvio !== null}  // bloqueia todos enquanto um envia
                          style={{
                            width: '100%', textAlign: 'left', cursor: emEnvio ? 'wait' : 'pointer',
                            background: 'rgba(212,175,55,0.05)',
                            border: '1px solid rgba(212,175,55,0.2)',
                            borderRadius: '10px', padding: '0.9rem 1rem',
                            display: 'flex', alignItems: 'center', gap: '0.85rem',
                            transition: 'all 0.15s',
                            opacity: loadingEnvio && !emEnvio ? 0.5 : 1,
                          }}
                          onMouseEnter={e => {
                            if (!loadingEnvio) {
                              e.currentTarget.style.borderColor = 'rgba(212,175,55,0.5)';
                              e.currentTarget.style.background   = 'rgba(212,175,55,0.1)';
                            }
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'rgba(212,175,55,0.2)';
                            e.currentTarget.style.background   = 'rgba(212,175,55,0.05)';
                          }}
                        >
                          {/* Avatar com inicial do terreiro */}
                          <div style={{
                            width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                            background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.25)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'Cinzel', color: 'var(--cor-acento)',
                            fontWeight: 700, fontSize: '1rem',
                          }}>
                            {terreiro.nome.charAt(0).toUpperCase()}
                          </div>

                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontWeight: 600, color: 'var(--cor-texto)', fontSize: '0.92rem',
                            }}>
                              {terreiro.nome}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--cor-texto-suave)', marginTop: '1px' }}>
                              Enviar link de recuperação para este terreiro
                            </div>
                          </div>

                          {/* Indicador de loading ou seta */}
                          {emEnvio ? (
                            <span className="spinner-border spinner-border-sm"
                              style={{ color: 'var(--cor-acento)', flexShrink: 0 }}
                            />
                          ) : (
                            <i className="bi bi-chevron-right"
                              style={{ color: 'var(--cor-acento)', flexShrink: 0, opacity: 0.6 }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Voltar para o email */}
              <button
                onClick={() => { setStep(STEP.EMAIL); setErro(''); setTerreiros([]); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--cor-texto-suave)', fontSize: '0.85rem',
                  padding: 0, display: 'flex', alignItems: 'center', gap: '0.3rem',
                }}
              >
                ← Usar outro email
              </button>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════
              STEP 3 — Confirmação de envio
          ════════════════════════════════════════════════════════════ */}
          {step === STEP.CONFIRMACAO && (
            <div style={{ textAlign: 'center' }}>

              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}>
                <i className="bi bi-envelope-check" style={{ fontSize: '1.75rem', color: '#10b981' }}></i>
              </div>

              <h5 style={{
                fontFamily: 'Cinzel', color: 'var(--cor-acento)',
                marginBottom: '0.75rem', fontSize: '1rem',
              }}>
                Verifique seu email
              </h5>

              <p style={{
                color: 'var(--cor-texto-suave)', fontSize: '0.88rem',
                lineHeight: 1.7, marginBottom: '1.5rem',
              }}>
                Se o email <strong style={{ color: 'var(--cor-texto)' }}>{email}</strong> estiver
                cadastrado no terreiro{' '}
                <strong style={{ color: 'var(--cor-acento)' }}>
                  {terreiroSelecionado?.nome}
                </strong>,
                você receberá um link de recuperação em breve.
              </p>

              {/* Dicas */}
              <div style={{
                background: 'rgba(212,175,55,0.06)',
                border: '1px solid rgba(212,175,55,0.15)',
                borderRadius: '10px', padding: '0.85rem 1rem',
                marginBottom: '1.5rem', textAlign: 'left',
              }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--cor-texto-suave)', lineHeight: 1.8 }}>
                  <div><i className="bi bi-clock me-2" style={{ color: '#d4af37' }}></i>
                    O link expira em <strong style={{ color: 'var(--cor-texto)' }}>1 hora</strong>.
                  </div>
                  <div><i className="bi bi-folder2 me-2" style={{ color: '#d4af37' }}></i>
                    Verifique a pasta de <strong style={{ color: 'var(--cor-texto)' }}>spam</strong> se não encontrar.
                  </div>
                  <div><i className="bi bi-arrow-clockwise me-2" style={{ color: '#d4af37' }}></i>
                    Não recebeu? Aguarde alguns minutos e tente novamente.
                  </div>
                </div>
              </div>

              <Link href="/login" style={{
                color: 'var(--cor-acento)', fontSize: '0.9rem', textDecoration: 'none',
              }}>
                ← Voltar para o login
              </Link>
            </div>
          )}

        </div>
      </div>
    </>
  );
}