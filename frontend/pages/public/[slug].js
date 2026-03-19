/**
 * pages/public/[slug].js — AxeFlow
 *
 * ALTERAÇÃO: checkbox "É minha primeira vez aqui" no formulário de inscrição.
 *
 * Comportamento das duas camadas de validação:
 *   - Checkbox (declarativo): o consulente informa se é a primeira vez.
 *   - Backend (autoritativo): valida pelo telefone no banco de dados.
 *
 * O checkbox ajuda quando o consulente é novo mas esqueceu de marcar —
 * nesse caso o backend corrige automaticamente para primeira_visita=True.
 * Se o telefone já existe no banco, o backend ignora o checkbox.
 */

import { useState } from 'react';
import Head from 'next/head';
import { inscreverPublico } from '../../services/api';
import { handleApiError } from '../../services/errorHandler';

// ── Constantes ──────────────────────────────────────────────────────────────

const BACKEND_INTERNAL = process.env.BACKEND_URL || 'http://backend:8000';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://axeflow.vercel.app';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Formata "2025-06-14" → "sábado, 14 de junho de 2025" */
function formatarData(dataStr) {
  if (!dataStr) return '';
  return new Date(dataStr + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** Formata "14:00:00" → "14h" ou "14h30" */
function formatarHorario(horario) {
  if (!horario) return '';
  const [h, m] = horario.split(':');
  return `${h}h${m !== '00' ? m : ''}`;
}

// ── Branding viral ───────────────────────────────────────────────────────────

function AxeFlowBrand() {
  return (
    <div style={{ marginTop: '2rem', textAlign: 'center' }}>
      <a
        href={`${APP_URL}/registro`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: 'none', display: 'inline-block' }}
      >
        <div style={{
          display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
          gap: '5px', padding: '0.9rem 1.75rem',
          background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.18)',
          borderRadius: '14px',
        }}>
          <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Lista organizada por
          </span>
          <span style={{ fontFamily: 'Cinzel, Georgia, serif', color: '#d4af37', fontSize: '1.05rem', letterSpacing: '3px' }}>
            ☽✦☾ AxeFlow
          </span>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)' }}>
            Seu terreiro também pode usar · É grátis
          </span>
        </div>
      </a>
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────

export default function GiraPublica({ gira, erro, slug }) {
  const [form, setForm] = useState({
    nome: '',
    telefone: '',
    observacoes: '',
    // Checkbox: o consulente declara se é a primeira vez no terreiro.
    // Valor inicial null = não respondeu ainda (diferente de false = respondeu que não).
    primeira_visita: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [resultado, setResultado]   = useState(null);
  const [error, setError]           = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        nome:           form.nome.trim(),
        telefone:       form.telefone.trim(),
        // Envia o valor do checkbox para o backend.
        // O backend aplica a validação final pela busca no banco.
        primeira_visita: form.primeira_visita,
        observacoes:    form.observacoes.trim() || null,
      };
      const res = await inscreverPublico(slug, payload);
      setResultado(res.data);
    } catch (err) {
      setError(handleApiError(err, 'InscricaoPublica'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Meta tags OG ─────────────────────────────────────────────────────────

  const dataFormatada = formatarData(gira?.data);
  const horario       = formatarHorario(gira?.horario);

  const ogTitle       = gira ? gira.titulo : 'Inscrição de Gira';
  const ogDescription = gira
    ? `${dataFormatada} às ${horario} — ${gira.vagas_disponiveis} vaga(s) disponível(is). Inscreva-se!`
    : 'Inscreva-se na gira pelo AxeFlow';
  const ogUrl         = `${APP_URL}/public/${slug}`;
  const ogImage       = `${APP_URL}/og-gira-preview.png`;

  // ── Estado de erro ────────────────────────────────────────────────────────

  if (erro || !gira) {
    return (
      <>
        <Head>
          <title>Gira não encontrada | AxeFlow</title>
          <meta name="robots" content="noindex" />
        </Head>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0720' }}>
          <div style={{ textAlign: 'center', color: 'var(--cor-texto)', padding: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>☽✦☾</div>
            <h2 style={{ fontFamily: 'Cinzel' }}>{erro || 'Gira não encontrada'}</h2>
            <AxeFlowBrand />
          </div>
        </div>
      </>
    );
  }

  // ── Lógica de estado da lista ─────────────────────────────────────────────

  const agora          = new Date();
  const listaFutura    = gira.abertura_lista  && agora < new Date(gira.abertura_lista);
  const listaEncerrada = gira.fechamento_lista && agora > new Date(gira.fechamento_lista);
  const pct            = Math.min(
    100,
    ((gira.limite_consulentes - gira.vagas_disponiveis) / gira.limite_consulentes) * 100
  );

  return (
    <>
      <Head>
        <title>{ogTitle} | AxeFlow</title>
        <meta name="description"        content={ogDescription} />
        <meta property="og:type"         content="website" />
        <meta property="og:url"          content={ogUrl} />
        <meta property="og:title"        content={ogTitle} />
        <meta property="og:description"  content={ogDescription} />
        <meta property="og:image"        content={ogImage} />
        <meta property="og:image:width"  content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:locale"       content="pt_BR" />
        <meta property="og:site_name"    content="AxeFlow" />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={ogTitle} />
        <meta name="twitter:description" content={ogDescription} />
        <meta name="twitter:image"       content={ogImage} />
        {listaEncerrada && <meta name="robots" content="noindex" />}
      </Head>

      <div className="public-wrapper">
        <div className="public-card">

          {/* Header */}
          <div className="public-header">
            <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>☽✦☾</div>
            <h2 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0, fontSize: '1.4rem' }}>
              {gira.titulo}
            </h2>
            {gira.tipo && (
              <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: '0.25rem', marginBottom: 0, fontSize: '0.9rem' }}>
                {gira.tipo}
              </p>
            )}
          </div>

          <div className="public-body">

            {/* Data e Hora */}
            <div className="row g-3 mb-4">
              <div className="col-6">
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                  <i className="bi bi-calendar3" style={{ color: 'var(--cor-acento)', fontSize: '1.1rem' }}></i>
                  <div style={{ fontSize: '0.82rem', color: 'var(--cor-texto)', marginTop: '0.35rem', lineHeight: 1.3 }}>
                    {dataFormatada}
                  </div>
                </div>
              </div>
              <div className="col-6">
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                  <i className="bi bi-clock" style={{ color: 'var(--cor-acento)', fontSize: '1.1rem' }}></i>
                  <div style={{ fontSize: '0.9rem', color: 'var(--cor-texto)', marginTop: '0.35rem', fontWeight: 600 }}>
                    {gira.horario}
                  </div>
                </div>
              </div>
            </div>

            {/* Barra de vagas */}
            <div className="mb-4">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--cor-texto-suave)' }}>Vagas disponíveis</span>
                <span style={{
                  fontSize: '0.85rem', fontWeight: 700,
                  color: gira.vagas_disponiveis === 0 ? '#ef4444' : '#10b981',
                }}>
                  {gira.vagas_disponiveis} / {gira.limite_consulentes}
                </span>
              </div>
              <div className="vagas-bar">
                <div className="vagas-fill" style={{ width: `${pct}%` }}></div>
              </div>
            </div>

            {/* Estados da inscrição */}
            {resultado ? (
              /* ── Inscrito com sucesso ── */
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>✦</div>
                <div style={{ fontSize: '1rem', color: 'var(--cor-texto)', fontWeight: 600 }}>Inscrição confirmada!</div>
                <div style={{ color: 'var(--cor-texto-suave)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  {resultado.consulente_nome}, você está na posição
                </div>
                <div style={{
                  color: 'var(--cor-acento)', fontFamily: 'Cinzel',
                  fontSize: '4rem', fontWeight: 700, lineHeight: 1, margin: '0.5rem 0',
                }}>
                  #{resultado.posicao}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--cor-texto-suave)' }}>
                  Anote sua posição — nos vemos na gira!
                </div>
              </div>

            ) : listaFutura ? (
              /* ── Lista ainda não abriu ── */
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', padding: '1.25rem', textAlign: 'center' }}>
                <i className="bi bi-hourglass-split" style={{ color: '#f59e0b', fontSize: '1.5rem' }}></i>
                <div style={{ color: '#fcd34d', fontWeight: 600, marginTop: '0.5rem' }}>Lista ainda não abriu</div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Abre em {new Date(gira.abertura_lista).toLocaleString('pt-BR')}
                </div>
              </div>

            ) : listaEncerrada ? (
              /* ── Lista encerrada ── */
              <div style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '10px', padding: '1.25rem', textAlign: 'center' }}>
                <i className="bi bi-lock" style={{ color: '#94a3b8', fontSize: '1.5rem' }}></i>
                <div style={{ color: '#94a3b8', fontWeight: 600, marginTop: '0.5rem' }}>Lista encerrada</div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  As inscrições para esta gira foram fechadas
                </div>
              </div>

            ) : gira.vagas_disponiveis === 0 ? (
              /* ── Vagas esgotadas ── */
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '1.25rem', textAlign: 'center' }}>
                <i className="bi bi-x-circle" style={{ color: '#ef4444', fontSize: '1.5rem' }}></i>
                <div style={{ color: '#ef4444', fontWeight: 600, marginTop: '0.5rem' }}>Vagas esgotadas</div>
              </div>

            ) : (
              /* ── Formulário de inscrição ── */
              <div>
                <h6 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                  ✦ Realize sua Inscrição
                </h6>

                {error && (
                  <div className="alert-custom alert-danger-custom mb-3">
                    <i className="bi bi-exclamation-circle me-2"></i>{error}
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label-custom">Nome completo</label>
                  <input
                    className="form-control-custom"
                    value={form.nome}
                    onChange={e => setForm({ ...form, nome: e.target.value })}
                    placeholder="Seu nome completo"
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label-custom">WhatsApp / Telefone</label>
                  <input
                    className="form-control-custom"
                    value={form.telefone}
                    onChange={e => setForm({ ...form, telefone: e.target.value })}
                    type="tel"
                    placeholder="(11) 99999-9999"
                    required
                  />
                </div>

                {/* ── Checkbox de primeira visita ────────────────────────────
                    Camada declarativa: o consulente informa se é a 1ª vez.
                    O backend aplica a validação final pelo banco de dados.
                    Se o consulente esquecer de marcar mas for novo,
                    o sistema corrige automaticamente para primeira_visita=True.
                ── */}
                <div className="mb-3">
                  <label
                    htmlFor="primeira-visita"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.65rem',
                      cursor: 'pointer',
                      padding: '0.75rem',
                      borderRadius: '10px',
                      border: `1px solid ${form.primeira_visita
                        ? 'rgba(212,175,55,0.45)'
                        : 'var(--cor-borda)'}`,
                      background: form.primeira_visita
                        ? 'rgba(212,175,55,0.07)'
                        : 'rgba(255,255,255,0.02)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {/* Checkbox customizado visualmente */}
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '5px',
                        border: `2px solid ${form.primeira_visita
                          ? 'var(--cor-acento)'
                          : 'rgba(255,255,255,0.2)'}`,
                        background: form.primeira_visita
                          ? 'var(--cor-acento)'
                          : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '1px',
                        transition: 'all 0.15s',
                      }}
                    >
                      {form.primeira_visita && (
                        <i
                          className="bi bi-check"
                          style={{ fontSize: '0.75rem', color: '#1a0a2e', fontWeight: 700 }}
                        ></i>
                      )}
                    </div>

                    {/* Input nativo oculto — mantém acessibilidade */}
                    <input
                      id="primeira-visita"
                      type="checkbox"
                      checked={form.primeira_visita}
                      onChange={e => setForm({ ...form, primeira_visita: e.target.checked })}
                      style={{ display: 'none' }}
                    />

                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--cor-texto)', fontWeight: 500 }}>
                        É a minha primeira vez aqui 🌟
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--cor-texto-suave)', marginTop: '2px', lineHeight: 1.4 }}>
                        Marque se nunca participou de uma gira neste terreiro
                      </div>
                    </div>
                  </label>
                </div>

                {/* Campo de observações — opcional */}
                <div className="mb-4">
                  <label className="form-label-custom">
                    Observações
                    <span style={{ color: 'var(--cor-texto-suave)', fontWeight: 400, marginLeft: '0.4rem', fontSize: '0.78rem' }}>
                      (opcional)
                    </span>
                  </label>
                  <textarea
                    className="form-control-custom"
                    value={form.observacoes}
                    onChange={e => setForm({ ...form, observacoes: e.target.value })}
                    placeholder="Ex: venho com acompanhante, pedido específico, urgente..."
                    rows={2}
                    maxLength={500}
                    style={{ resize: 'vertical', minHeight: '60px' }}
                  />
                  {/* Contador de caracteres — aparece ao começar a digitar */}
                  {form.observacoes.length > 0 && (
                    <div style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--cor-texto-suave)', marginTop: '2px' }}>
                      {form.observacoes.length}/500
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSubmit}
                  className="btn-gold w-100"
                  disabled={submitting || !form.nome || !form.telefone}
                  style={{ padding: '0.85rem' }}
                >
                  {submitting
                    ? <span className="spinner-border spinner-border-sm me-2"></span>
                    : <i className="bi bi-stars me-2"></i>
                  }
                  Confirmar Inscrição
                </button>
              </div>
            )}

            <AxeFlowBrand />
          </div>
        </div>
      </div>
    </>
  );
}

// ── Server-side data fetching ───────────────────────────────────────────────

/**
 * Busca os dados da gira no servidor antes de renderizar.
 *
 * Por que getServerSideProps e não getStaticProps?
 *   - Vagas disponíveis mudam em tempo real — não pode ser cache estático
 *   - Status abertura/fechamento depende do horário atual
 *
 * Por que não useEffect (client-side)?
 *   - Bots não executam JavaScript → meta OG ficaria vazia → sem preview
 */
export async function getServerSideProps({ params }) {
  const { slug } = params;

  try {
    const res = await fetch(`${BACKEND_INTERNAL}/public/gira/${slug}`, {
      // Timeout de 5s para não travar o servidor em caso de backend lento
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return { props: { gira: null, erro: 'Gira não encontrada', slug } };
    }

    const gira = await res.json();
    return { props: { gira, erro: null, slug } };

  } catch (err) {
    console.error(`[SSR] Erro ao buscar gira "${slug}":`, err.message);
    return { props: { gira: null, erro: 'Não foi possível carregar a gira', slug } };
  }
}