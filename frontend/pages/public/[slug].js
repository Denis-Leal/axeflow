import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getGiraPublica, inscreverPublico } from '../../services/api';
import { handleApiError } from '../../services/errorHandler';

// Rodapé viral — aparece em TODOS os estados da página
function AxeFlowBrand() {
  return (
    <div style={{ marginTop: '2rem', textAlign: 'center' }}>
      <a
        href="https://axeflow.vercel.app/registro"
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: 'none', display: 'inline-block' }}
      >
        <div style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '5px',
          padding: '0.9rem 1.75rem',
          background: 'rgba(212,175,55,0.06)',
          border: '1px solid rgba(212,175,55,0.18)',
          borderRadius: '14px',
        }}>
          <span style={{
            fontSize: '0.62rem',
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: '2px',
            textTransform: 'uppercase',
          }}>
            Lista organizada por
          </span>
          <span style={{
            fontFamily: 'Cinzel, Georgia, serif',
            color: '#d4af37',
            fontSize: '1.05rem',
            letterSpacing: '3px',
          }}>
            ☽✦☾ AxeFlow
          </span>
          <span style={{
            fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.25)',
          }}>
            Seu terreiro também pode usar · É grátis
          </span>
        </div>
      </a>
    </div>
  );
}

export default function GiraPublica() {
  const router = useRouter();
  const { slug } = router.query;
  const [gira, setGira] = useState(null);
  const [form, setForm] = useState({ nome: '', telefone: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    getGiraPublica(slug)
      .then(r => setGira(r.data))
      .catch(() => setError('Gira não encontrada'))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await inscreverPublico(slug, form);
      setResultado(res.data);
    } catch (err) {
      setError(handleApiError(err, 'InscricaoPublica'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0720' }}>
      <div className="spinner-gold"></div>
    </div>
  );

  if (error && !gira) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0720' }}>
      <div style={{ textAlign: 'center', color: 'var(--cor-texto)', padding: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>☽✦☾</div>
        <h2 style={{ fontFamily: 'Cinzel' }}>{error}</h2>
        <AxeFlowBrand />
      </div>
    </div>
  );

  const pct = gira ? Math.min(100, ((gira.limite_consulentes - gira.vagas_disponiveis) / gira.limite_consulentes) * 100) : 0;
  const listaFutura = gira && new Date() < new Date(gira.abertura_lista);
  const listaEncerrada = gira && new Date() > new Date(gira.fechamento_lista);

  return (
    <>
      <Head>
        <title>{gira?.titulo || 'Inscrição'} | AxeFlow</title>
        <meta name="description" content={`Inscreva-se na ${gira?.titulo} — lista organizada pelo AxeFlow`} />
      </Head>

      <div className="public-wrapper">
        <div className="public-card">

          {/* Header */}
          <div className="public-header">
            <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>☽✦☾</div>
            <h2 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0, fontSize: '1.4rem' }}>
              {gira?.titulo}
            </h2>
            {gira?.tipo && (
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
                    {gira && new Date(gira.data + 'T00:00:00').toLocaleDateString('pt-BR', {
                      weekday: 'long', day: 'numeric', month: 'long'
                    })}
                  </div>
                </div>
              </div>
              <div className="col-6">
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                  <i className="bi bi-clock" style={{ color: 'var(--cor-acento)', fontSize: '1.1rem' }}></i>
                  <div style={{ fontSize: '0.9rem', color: 'var(--cor-texto)', marginTop: '0.35rem', fontWeight: 600 }}>
                    {gira?.horario}
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
                  color: gira?.vagas_disponiveis === 0 ? '#ef4444' : '#10b981',
                }}>
                  {gira?.vagas_disponiveis} / {gira?.limite_consulentes}
                </span>
              </div>
              <div className="vagas-bar">
                <div className="vagas-fill" style={{ width: `${pct}%` }}></div>
              </div>
            </div>

            {/* Estado: inscrito com sucesso */}
            {resultado ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                {resultado.status === 'lista_espera' ? (
                  <>
                    <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>⏳</div>
                    <div style={{ fontSize: '1rem', color: '#f59e0b', fontWeight: 600 }}>
                      Você entrou na lista de espera!
                    </div>
                    <div style={{ color: 'var(--cor-texto-suave)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      {resultado.consulente_nome}, as vagas estão esgotadas, mas você está na fila:
                    </div>
                    <div style={{
                      color: '#f59e0b', fontFamily: 'Cinzel',
                      fontSize: '4rem', fontWeight: 700, lineHeight: 1,
                      margin: '0.5rem 0',
                    }}>
                      #{resultado.posicao}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--cor-texto-suave)' }}>
                      Se alguém cancelar, você será promovido automaticamente.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>✦</div>
                    <div style={{ fontSize: '1rem', color: 'var(--cor-texto)', fontWeight: 600 }}>
                      Inscrição confirmada!
                    </div>
                    <div style={{ color: 'var(--cor-texto-suave)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      {resultado.consulente_nome}, você está na posição
                    </div>
                    <div style={{
                      color: 'var(--cor-acento)', fontFamily: 'Cinzel',
                      fontSize: '4rem', fontWeight: 700, lineHeight: 1,
                      margin: '0.5rem 0',
                    }}>
                      #{resultado.posicao}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--cor-texto-suave)' }}>
                      Anote sua posição — nos vemos na gira!
                    </div>
                  </>
                )}
              </div>

            /* Estado: lista ainda não abriu */
            ) : listaFutura ? (
              <div style={{
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: '10px', padding: '1.25rem', textAlign: 'center',
              }}>
                <i className="bi bi-hourglass-split" style={{ color: '#f59e0b', fontSize: '1.5rem' }}></i>
                <div style={{ color: '#fcd34d', fontWeight: 600, marginTop: '0.5rem' }}>
                  Lista ainda não abriu
                </div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Abre em {new Date(gira.abertura_lista).toLocaleString('pt-BR')}
                </div>
              </div>

            /* Estado: lista encerrada */
            ) : listaEncerrada ? (
              <div style={{
                background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: '10px', padding: '1.25rem', textAlign: 'center',
              }}>
                <i className="bi bi-lock" style={{ color: '#94a3b8', fontSize: '1.5rem' }}></i>
                <div style={{ color: '#94a3b8', fontWeight: 600, marginTop: '0.5rem' }}>
                  Lista encerrada
                </div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  As inscrições para esta gira foram fechadas
                </div>
              </div>

            /* Estado: vagas esgotadas */
            ) : gira?.vagas_disponiveis === 0 ? (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: '10px', padding: '1.25rem', textAlign: 'center',
              }}>
                <i className="bi bi-x-circle" style={{ color: '#ef4444', fontSize: '1.5rem' }}></i>
                <div style={{ color: '#ef4444', fontWeight: 600, marginTop: '0.5rem' }}>
                  Vagas esgotadas
                </div>
              </div>

            /* Estado: formulário de inscrição */
            ) : (
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
                  <input className="form-control-custom" value={form.nome}
                    onChange={e => setForm({ ...form, nome: e.target.value })}
                    placeholder="Seu nome completo" required />
                </div>
                <div className="mb-4">
                  <label className="form-label-custom">WhatsApp / Telefone</label>
                  <input className="form-control-custom" value={form.telefone}
                    onChange={e => setForm({ ...form, telefone: e.target.value })}
                    type="tel" placeholder="(11) 99999-9999" required />
                </div>
                <button onClick={handleSubmit} className="btn-gold w-100"
                  disabled={submitting || !form.nome || !form.telefone}
                  style={{ padding: '0.85rem' }}>
                  {submitting
                    ? <span className="spinner-border spinner-border-sm me-2"></span>
                    : <i className="bi bi-stars me-2"></i>
                  }
                  Confirmar Inscrição
                </button>
              </div>
            )}

            {/* Rodapé viral — presente em TODOS os estados */}
            <AxeFlowBrand />

          </div>
        </div>
      </div>
    </>
  );
}
