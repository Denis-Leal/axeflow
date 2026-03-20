/**
 * pages/contato.js — AxeFlow
 *
 * Página de contato para feedback dos usuários.
 * Permite enviar sugestões, reportar bugs e elogios diretamente ao desenvolvedor.
 *
 * Fluxo:
 *   1. Usuário preenche o formulário (tipo, assunto, mensagem)
 *   2. POST /auth/me para obter dados do usuário logado (nome, email, terreiro)
 *   3. POST /contato para enviar a mensagem via backend → email do dev
 *
 * Tipos de feedback:
 *   - 🐛 Bug report
 *   - 💡 Sugestão
 *   - ⭐ Elogio
 *   - ❓ Dúvida
 *   - 🔧 Outro
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import { getMe, enviarContato } from '../services/api';

// ── Tipos de feedback disponíveis ──────────────────────────────────────────────
const TIPOS_FEEDBACK = [
  { value: 'bug',       emoji: '🐛', label: 'Reportar Bug',   desc: 'Algo não está funcionando' },
  { value: 'sugestao',  emoji: '💡', label: 'Sugestão',       desc: 'Ideia para melhorar o app' },
  { value: 'elogio',    emoji: '⭐', label: 'Elogio',         desc: 'Compartilhe o que amou' },
  { value: 'duvida',    emoji: '❓', label: 'Dúvida',         desc: 'Precisa de ajuda' },
  { value: 'outro',     emoji: '🔧', label: 'Outro',          desc: 'Qualquer outra mensagem' },
];

// ── Cores por tipo de feedback ──────────────────────────────────────────────────
const COR_TIPO = {
  bug:      { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.4)',   text: '#ef4444' },
  sugestao: { bg: 'rgba(212,175,55,0.12)',  border: 'rgba(212,175,55,0.4)',  text: '#d4af37' },
  elogio:   { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.4)', text: '#10b981' },
  duvida:   { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.4)', text: '#818cf8' },
  outro:    { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.3)', text: '#94a3b8' },
};

export default function Contato() {
  const router = useRouter();

  // ── Estado do usuário logado ──────────────────────────────────────────────
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Estado do formulário ──────────────────────────────────────────────────
  const [form, setForm] = useState({
    tipo:     '',        // tipo de feedback selecionado
    assunto:  '',        // assunto da mensagem
    mensagem: '',        // corpo da mensagem
  });

  // ── Estado de envio ───────────────────────────────────────────────────────
  const [enviando, setEnviando] = useState(false);
  const [enviado,  setEnviado]  = useState(false);  // exibe tela de sucesso
  const [erro,     setErro]     = useState('');

  // ── Carrega dados do usuário ao montar ────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    getMe()
      .then(r => setUser(r.data))
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, []);

  // ── Handler de envio ──────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validações básicas antes de enviar
    if (!form.tipo) {
      setErro('Selecione o tipo de feedback antes de enviar.');
      return;
    }
    if (form.mensagem.trim().length < 10) {
      setErro('A mensagem precisa ter pelo menos 10 caracteres.');
      return;
    }

    setEnviando(true);
    setErro('');

    try {
      await enviarContato({
        tipo:      form.tipo,
        assunto:   form.assunto.trim() || `[${form.tipo.toUpperCase()}] Feedback via AxeFlow`,
        mensagem:  form.mensagem.trim(),
        // Dados do usuário enriquecidos no payload para contexto no email
        usuario: {
          nome:          user?.nome,
          email:         user?.email,
          terreiro_nome: user?.terreiro_nome,
          terreiro_id:   user?.terreiro_id,
        },
      });

      // Sucesso: limpa form e exibe tela de confirmação
      setEnviado(true);
      setForm({ tipo: '', assunto: '', mensagem: '' });

    } catch (err) {
      const detalhe = err?.response?.data?.detail;
      setErro(detalhe || 'Erro ao enviar mensagem. Tente novamente em instantes.');
    } finally {
      setEnviando(false);
    }
  };

  // ── Reset para enviar outro feedback ──────────────────────────────────────
  const handleNovoFeedback = () => {
    setEnviado(false);
    setErro('');
    setForm({ tipo: '', assunto: '', mensagem: '' });
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner-gold"></div>
    </div>
  );

  return (
    <>
      <Head><title>Contato | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">

          {/* ── Topbar ── */}
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>
                Contato
              </h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>
                Fale com o desenvolvedor
              </small>
            </div>
          </div>

          <div className="page-content">
            <div style={{ maxWidth: '680px' }}>

              {/* ── Tela de sucesso pós-envio ── */}
              {enviado ? (
                <div className="card-custom" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                  <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>✦</div>
                  <h4 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', marginBottom: '0.75rem' }}>
                    Mensagem enviada!
                  </h4>
                  <p style={{ color: 'var(--cor-texto-suave)', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '2rem' }}>
                    Obrigado pelo seu feedback,{' '}
                    <strong style={{ color: 'var(--cor-texto)' }}>{user?.nome?.split(' ')[0]}</strong>!
                    <br />
                    Sua mensagem foi recebida e será analisada em breve.
                  </p>
                  <button
                    onClick={handleNovoFeedback}
                    className="btn-outline-gold"
                    style={{ padding: '0.6rem 1.75rem' }}
                  >
                    Enviar outro feedback
                  </button>
                </div>

              ) : (

                /* ── Formulário de contato ── */
                <div className="card-custom">
                  <div className="card-header">
                    <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                      ✦ Enviar Mensagem
                    </span>
                  </div>
                  <div style={{ padding: '1.5rem' }}>

                    {/* Mensagem de erro */}
                    {erro && (
                      <div className="alert-custom alert-danger-custom mb-4">
                        <i className="bi bi-exclamation-circle me-2"></i>{erro}
                      </div>
                    )}

                    {/* Informação de contexto do usuário */}
                    <div style={{
                      background: 'rgba(212,175,55,0.06)',
                      border: '1px solid rgba(212,175,55,0.15)',
                      borderRadius: '10px',
                      padding: '0.85rem 1rem',
                      marginBottom: '1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                    }}>
                      {/* Avatar com inicial do nome */}
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'Cinzel', color: 'var(--cor-acento)', fontWeight: 700,
                      }}>
                        {user?.nome?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--cor-texto)', fontWeight: 600 }}>
                          {user?.nome}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--cor-texto-suave)' }}>
                          {user?.email} · {user?.terreiro_nome}
                        </div>
                      </div>
                      <span style={{
                        marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--cor-texto-suave)',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--cor-borda)',
                        borderRadius: '6px', padding: '2px 8px',
                      }}>
                        enviando como você
                      </span>
                    </div>

                    <form onSubmit={handleSubmit}>

                      {/* Seleção de tipo de feedback */}
                      <div style={{ marginBottom: '1.5rem' }}>
                        <label className="form-label-custom">Tipo de feedback *</label>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                          gap: '0.5rem',
                          marginTop: '0.4rem',
                        }}>
                          {TIPOS_FEEDBACK.map(tipo => {
                            const ativo = form.tipo === tipo.value;
                            const cor   = COR_TIPO[tipo.value];
                            return (
                              <button
                                key={tipo.value}
                                type="button"
                                onClick={() => setForm({ ...form, tipo: tipo.value })}
                                style={{
                                  padding: '0.65rem 0.5rem',
                                  borderRadius: '10px',
                                  cursor: 'pointer',
                                  textAlign: 'center',
                                  transition: 'all 0.15s',
                                  background: ativo ? cor.bg : 'rgba(255,255,255,0.02)',
                                  border: `1.5px solid ${ativo ? cor.border : 'var(--cor-borda)'}`,
                                }}
                              >
                                <div style={{ fontSize: '1.3rem', marginBottom: '3px' }}>
                                  {tipo.emoji}
                                </div>
                                <div style={{
                                  fontSize: '0.78rem', fontWeight: 600,
                                  color: ativo ? cor.text : 'var(--cor-texto)',
                                }}>
                                  {tipo.label}
                                </div>
                                <div style={{
                                  fontSize: '0.68rem',
                                  color: ativo ? cor.text : 'var(--cor-texto-suave)',
                                  opacity: ativo ? 0.8 : 1,
                                  marginTop: '2px',
                                }}>
                                  {tipo.desc}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Assunto (opcional) */}
                      <div style={{ marginBottom: '1rem' }}>
                        <label className="form-label-custom">
                          Assunto
                          <span style={{ color: 'var(--cor-texto-suave)', fontWeight: 400, marginLeft: '0.4rem', fontSize: '0.78rem' }}>
                            (opcional)
                          </span>
                        </label>
                        <input
                          className="form-control-custom"
                          value={form.assunto}
                          onChange={e => setForm({ ...form, assunto: e.target.value })}
                          placeholder="Ex: Bug na tela de giras, Sugestão de filtro..."
                          maxLength={120}
                        />
                      </div>

                      {/* Mensagem principal */}
                      <div style={{ marginBottom: '1.5rem' }}>
                        <label className="form-label-custom">Mensagem *</label>
                        <textarea
                          className="form-control-custom"
                          value={form.mensagem}
                          onChange={e => setForm({ ...form, mensagem: e.target.value })}
                          placeholder={
                            form.tipo === 'bug'
                              ? 'Descreva o bug: o que aconteceu, o que esperava acontecer, e como reproduzir...'
                              : form.tipo === 'sugestao'
                              ? 'Descreva sua ideia: qual problema ela resolve e como funcionaria...'
                              : form.tipo === 'elogio'
                              ? 'Conta o que você amou no AxeFlow...'
                              : 'Escreva sua mensagem aqui...'
                          }
                          rows={5}
                          maxLength={2000}
                          required
                          style={{ resize: 'vertical', minHeight: '120px' }}
                        />
                        {/* Contador de caracteres */}
                        <div style={{
                          display: 'flex', justifyContent: 'space-between',
                          marginTop: '0.3rem',
                        }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>
                            Mínimo 10 caracteres
                          </span>
                          <span style={{
                            fontSize: '0.72rem',
                            color: form.mensagem.length > 1800 ? '#f59e0b' : 'var(--cor-texto-suave)',
                          }}>
                            {form.mensagem.length}/2000
                          </span>
                        </div>
                      </div>

                      {/* Botão de envio */}
                      <button
                        type="submit"
                        className="btn-gold"
                        disabled={enviando || !form.tipo || form.mensagem.trim().length < 10}
                        style={{ padding: '0.65rem 2rem', width: '100%' }}
                      >
                        {enviando ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Enviando...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-send me-2"></i>
                            Enviar mensagem
                          </>
                        )}
                      </button>

                    </form>

                    {/* Rodapé informativo */}
                    <div style={{
                      marginTop: '1.25rem', paddingTop: '1rem',
                      borderTop: '1px solid var(--cor-borda)',
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                    }}>
                      <i className="bi bi-shield-check" style={{ color: 'var(--cor-texto-suave)', fontSize: '0.9rem' }}></i>
                      <span style={{ fontSize: '0.75rem', color: 'var(--cor-texto-suave)', lineHeight: 1.5 }}>
                        Sua mensagem é enviada com seus dados de conta para contexto.
                        Usamos essas informações apenas para responder ao seu feedback.
                      </span>
                    </div>

                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}