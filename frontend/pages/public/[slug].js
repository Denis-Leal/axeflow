import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getGiraPublica, inscreverPublico } from '../../services/api';

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
    getGiraPublica(slug).then(r => setGira(r.data)).catch(() => setError('Gira não encontrada')).finally(() => setLoading(false));
  }, [slug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await inscreverPublico(slug, form);
      setResultado(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao realizar inscrição');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cor-fundo)' }}>
      <div className="spinner-gold"></div>
    </div>
  );

  if (error && !gira) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cor-fundo)' }}>
      <div style={{ textAlign: 'center', color: 'var(--cor-texto)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>☽✦☾</div>
        <h2 style={{ fontFamily: 'Cinzel' }}>{error}</h2>
      </div>
    </div>
  );

  const pct = gira ? Math.min(100, ((gira.limite_consulentes - gira.vagas_disponiveis) / gira.limite_consulentes) * 100) : 0;

  return (
    <>
      <Head>
        <title>{gira?.titulo || 'Gira'} | Inscrição</title>
      </Head>
      <div className="public-wrapper">
        <div className="public-card">
          <div className="public-header">
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>☽✦☾</div>
            <h2 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0, fontSize: '1.4rem' }}>{gira?.titulo}</h2>
            {gira?.tipo && <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: '0.25rem', marginBottom: 0 }}>{gira.tipo}</p>}
          </div>

          <div className="public-body">
            {/* Info gira */}
            <div className="row g-3 mb-4">
              <div className="col-6">
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                  <i className="bi bi-calendar3" style={{ color: 'var(--cor-acento)' }}></i>
                  <div style={{ fontSize: '0.85rem', color: 'var(--cor-texto)', marginTop: '0.25rem' }}>
                    {gira && new Date(gira.data + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                </div>
              </div>
              <div className="col-6">
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                  <i className="bi bi-clock" style={{ color: 'var(--cor-acento)' }}></i>
                  <div style={{ fontSize: '0.85rem', color: 'var(--cor-texto)', marginTop: '0.25rem' }}>{gira?.horario}</div>
                </div>
              </div>
            </div>

            {/* Vagas */}
            <div className="mb-4">
              <div className="d-flex justify-content-between mb-2">
                <span style={{ fontSize: '0.85rem', color: 'var(--cor-texto-suave)' }}>Vagas disponíveis</span>
                <span style={{ fontSize: '0.85rem', color: gira?.vagas_disponiveis === 0 ? '#ef4444' : '#10b981', fontWeight: '700' }}>
                  {gira?.vagas_disponiveis} / {gira?.limite_consulentes}
                </span>
              </div>
              <div className="vagas-bar">
                <div className="vagas-fill" style={{ width: `${pct}%` }}></div>
              </div>
            </div>

            {resultado ? (
              <div className="alert-custom alert-success-custom" style={{ textAlign: 'center', padding: '1.5rem' }}>
                <i className="bi bi-check-circle" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}></i>
                <strong>Inscrição Confirmada!</strong>
                <div style={{ marginTop: '0.5rem', fontSize: '1.1rem' }}>
                  Você está na posição <strong style={{ color: 'var(--cor-acento)', fontFamily: 'Cinzel', fontSize: '1.5rem' }}>#{resultado.posicao}</strong>
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.8 }}>{resultado.consulente_nome}</div>
              </div>
            ) : !gira?.lista_aberta ? (
              <div className="alert-custom" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#fcd34d', textAlign: 'center' }}>
                <i className="bi bi-clock-history me-2"></i>
                {gira && new Date() < new Date(gira.abertura_lista) ? 'Lista ainda não foi aberta' : 'Lista encerrada'}
              </div>
            ) : gira?.vagas_disponiveis === 0 ? (
              <div className="alert-custom alert-danger-custom" style={{ textAlign: 'center' }}>
                <i className="bi bi-x-circle me-2"></i> Vagas esgotadas
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <h6 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                  ✦ Realize sua Inscrição
                </h6>
                {error && <div className="alert-custom alert-danger-custom mb-3"><i className="bi bi-exclamation-circle me-2"></i>{error}</div>}
                <div className="mb-3">
                  <label className="form-label-custom">Nome completo</label>
                  <input className="form-control-custom" value={form.nome}
                    onChange={e => setForm({ ...form, nome: e.target.value })}
                    placeholder="Seu nome" required />
                </div>
                <div className="mb-4">
                  <label className="form-label-custom">Telefone / WhatsApp</label>
                  <input className="form-control-custom" value={form.telefone}
                    onChange={e => setForm({ ...form, telefone: e.target.value })}
                    placeholder="(11) 99999-9999" required />
                </div>
                <button type="submit" className="btn-gold w-100" disabled={submitting} style={{ padding: '0.75rem' }}>
                  {submitting ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-stars me-2"></i>}
                  Confirmar Inscrição
                </button>
              </form>
            )}

            <div style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--cor-texto-suave)', fontSize: '0.75rem' }}>
              AxeFlow · Sistema de Gestão de Giras
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
