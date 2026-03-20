/**
 * pages/giras/editar/[id].js — AxeFlow
 *
 * ALTERAÇÃO: ao salvar edição que aumenta vagas, o backend promove
 * automaticamente quem estava na lista de espera, mas o WhatsApp
 * NÃO é aberto automaticamente. Em vez disso, um painel aparece
 * com botões manuais para o admin notificar cada promovido.
 *
 * WhatsApp automático só ocorre no cancelamento de inscrição (giras/[id].js).
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Sidebar from '../../../components/Sidebar';
import BottomNav from '../../../components/BottomNav';
import { getGira, getMe } from '../../../services/api';
import { handleApiError } from '../../../services/errorHandler';
import api from '../../../services/api';

// ── Helper: monta link wa.me com mensagem pré-preenchida ────────────────────

function linkWhatsApp(telefone, mensagem) {
  const digitos = String(telefone).replace(/\D/g, '');
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensagem)}`;
}

// ── Painel de promovidos: aparece após salvar quando há promoções ────────────

/**
 * Exibe cards para cada consulente promovido da fila de espera.
 * O admin clica no botão WhatsApp de cada um manualmente.
 * Ao clicar em "Continuar", redireciona para a página da gira.
 */
function PainelPromovidos({ promovidos, giraTitulo, onContinuar }) {
  // Rastreia quais botões já foram clicados para feedback visual
  const [notificados, setNotificados] = useState({});

  const marcarNotificado = (telefone) => {
    setNotificados(prev => ({ ...prev, [telefone]: true }));
  };

  const todosNotificados = promovidos.every(p => notificados[p.telefone]);

  return (
    <div style={{
      background: 'rgba(16,185,129,0.08)',
      border: '1px solid rgba(16,185,129,0.35)',
      borderRadius: '14px',
      padding: '1.25rem',
      marginBottom: '1.5rem',
    }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
        <span style={{ fontSize: '1.3rem' }}>🎉</span>
        <div>
          <div style={{ color: '#10b981', fontWeight: 700, fontSize: '0.95rem' }}>
            {promovidos.length} pessoa{promovidos.length > 1 ? 's' : ''} promovida{promovidos.length > 1 ? 's' : ''} da lista de espera!
          </div>
          <div style={{ color: 'var(--cor-texto-suave)', fontSize: '0.78rem', marginTop: '2px' }}>
            Avise cada uma pelo WhatsApp que a vaga foi confirmada.
          </div>
        </div>
      </div>

      {/* Card de cada promovido */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
        {promovidos.map((p) => {
          const jaNotificado = notificados[p.telefone];
          const mensagemWA = (
            `Olá ${p.nome}! Uma vaga foi liberada na gira "${giraTitulo}". ` +
            `Você estava na lista de espera e agora está confirmado(a)! 🎉`
          );

          return (
            <div key={p.telefone} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.65rem 0.85rem',
              borderRadius: '10px',
              background: jaNotificado ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${jaNotificado ? 'rgba(16,185,129,0.3)' : 'var(--cor-borda)'}`,
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--cor-texto)' }}>
                  {p.nome}
                </span>
                <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--cor-texto-suave)' }}>
                  #{p.posicao} na fila
                </span>
                {jaNotificado && (
                  <span style={{
                    marginLeft: '0.5rem', fontSize: '0.7rem',
                    color: '#10b981', fontWeight: 600,
                  }}>
                    ✓ Notificado
                  </span>
                )}
              </div>

              <a
                href={linkWhatsApp(p.telefone, mensagemWA)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => marcarNotificado(p.telefone)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: jaNotificado ? 'rgba(37,211,102,0.08)' : 'rgba(37,211,102,0.15)',
                  border: `1px solid ${jaNotificado ? 'rgba(37,211,102,0.2)' : 'rgba(37,211,102,0.45)'}`,
                  color: jaNotificado ? 'rgba(37,211,102,0.5)' : '#25d366',
                  borderRadius: '8px',
                  padding: '0.35rem 0.85rem',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  pointerEvents: jaNotificado ? 'none' : 'auto',
                }}
              >
                <i className="bi bi-whatsapp"></i>
                {jaNotificado ? 'Enviado' : 'Avisar via WhatsApp'}
              </a>
            </div>
          );
        })}
      </div>

      {/* Botão continuar */}
      <button
        onClick={onContinuar}
        className="btn-gold w-100"
        style={{ padding: '0.65rem' }}
      >
        {todosNotificados
          ? <><i className="bi bi-check-lg me-2"></i>Todos notificados — Continuar</>
          : <><i className="bi bi-arrow-right me-2"></i>Continuar sem notificar todos</>
        }
      </button>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────

export default function EditarGira() {
  const router = useRouter();
  const { id } = router.query;

  const [form, setForm]           = useState(null);
  const [membros, setMembros]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  // Lista de promovidos retornada pelo backend após salvar
  const [promovidos, setPromovidos] = useState([]);
  // Título da gira para montar a mensagem de WA
  const [giraTitulo, setGiraTitulo] = useState('');

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    getMe()
      .then(meRes => {
        if (!['admin', 'operador'].includes(meRes.data.role)) {
          router.push('/giras?erro=sem-permissao');
          return Promise.reject('sem-permissao');
        }
        return Promise.all([getGira(id), api.get('/membros')]);
      })
      .then(results => {
        if (!results) return;
        const [giraRes, membrosRes] = results;
        const g = giraRes.data;
        setGiraTitulo(g.titulo || '');
        setForm({
          titulo:               g.titulo || '',
          tipo:                 g.tipo || '',
          acesso:               g.acesso || 'publica',
          data:                 g.data || '',
          horario:              g.horario ? g.horario.slice(0, 5) : '',
          limite_consulentes:   g.limite_consulentes || 20,
          limite_membros:       g.limite_membros || null,
          abertura_lista:       g.abertura_lista ? g.abertura_lista.slice(0, 16) : '',
          fechamento_lista:     g.fechamento_lista ? g.fechamento_lista.slice(0, 16) : '',
          responsavel_lista_id: g.responsavel_lista_id || '',
          status:               g.status || 'aberta',
        });
        setMembros(membrosRes.data);
      })
      .catch(err => { if (err !== 'sem-permissao') router.push('/giras'); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        titulo:  form.titulo,
        tipo:    form.tipo,
        acesso:  form.acesso,
        data:    form.data,
        horario: form.horario.length === 5 ? form.horario + ':00' : form.horario,
        status:  form.status,
      };

      if (form.acesso === 'fechada') {
        payload.limite_membros       = parseInt(form.limite_membros);
        payload.abertura_lista       = null;
        payload.fechamento_lista     = null;
        payload.responsavel_lista_id = null;
        payload.limite_consulentes   = null;
      } else {
        payload.limite_consulentes   = parseInt(form.limite_consulentes);
        payload.limite_membros       = null;
        payload.abertura_lista       = form.abertura_lista || null;
        payload.fechamento_lista     = form.fechamento_lista || null;
        payload.responsavel_lista_id = form.responsavel_lista_id || null;
      }

      const res = await api.put(`/giras/${id}`, payload);
      const resultado = res.data;

      const listaPromovidos = resultado.promovidos_fila || [];

      if (listaPromovidos.length > 0) {
        // Há promovidos — exibe o painel manual antes de redirecionar
        setGiraTitulo(resultado.titulo || form.titulo);
        setPromovidos(listaPromovidos);
      } else {
        // Sem promovidos — redireciona direto
        router.push(`/giras/${id}`);
      }
    } catch (err) {
      setError(handleApiError(err, 'EditarGira'));
    } finally {
      setSaving(false);
    }
  };

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  if (loading || !form) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner-gold"></div>
    </div>
  );

  return (
    <>
      <Head><title>Editar Gira | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>Editar Gira</h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>{form.titulo}</small>
            </div>
            <Link href={`/giras/${id}`} style={{ color: 'var(--cor-texto-suave)', textDecoration: 'none', fontSize: '0.9rem' }}>
              ← Voltar
            </Link>
          </div>

          <div className="page-content">
            <div className="card-custom" style={{ maxWidth: '680px' }}>
              <div className="card-header">
                <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>✦ Dados da Gira</span>
              </div>
              <div style={{ padding: '1.5rem' }}>

                {error && (
                  <div className="alert-custom alert-danger-custom mb-4">
                    <i className="bi bi-exclamation-circle me-2"></i>{error}
                  </div>
                )}

                {/* Painel de promovidos — aparece após salvar, substitui o formulário */}
                {promovidos.length > 0 ? (
                  <PainelPromovidos
                    promovidos={promovidos}
                    giraTitulo={giraTitulo}
                    onContinuar={() => router.push(`/giras/${id}`)}
                  />
                ) : (
                  <form onSubmit={handleSubmit}>
                    <div className="row g-3">

                      {/* Tipo de acesso */}
                      <div className="col-12">
                        <label className="form-label-custom">Tipo de Gira</label>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          {[
                            { value: 'publica', emoji: '🌐', label: 'Aberta ao público' },
                            { value: 'fechada', emoji: '🔒', label: 'Fechada (membros)' },
                          ].map(opt => (
                            <button key={opt.value} type="button"
                              onClick={() => set('acesso', opt.value)}
                              style={{
                                flex: 1, padding: '0.65rem', borderRadius: '8px', cursor: 'pointer',
                                background: form.acesso === opt.value ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)',
                                border: `1.5px solid ${form.acesso === opt.value ? 'var(--cor-acento)' : 'var(--cor-borda)'}`,
                                color: form.acesso === opt.value ? 'var(--cor-acento)' : 'var(--cor-texto)',
                                fontWeight: 600, fontSize: '0.85rem',
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                              }}>
                              {opt.emoji} {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="col-12">
                        <label className="form-label-custom">Título *</label>
                        <input className="form-control-custom" value={form.titulo} required
                          onChange={e => set('titulo', e.target.value)} />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label-custom">Tipo</label>
                        <input className="form-control-custom" value={form.tipo}
                          onChange={e => set('tipo', e.target.value)} placeholder="Ex: Umbanda, Candomblé..." />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label-custom">Status</label>
                        <select className="form-control-custom" value={form.status}
                          onChange={e => set('status', e.target.value)}>
                          <option value="aberta">Aberta</option>
                          <option value="fechada">Fechada</option>
                          <option value="concluida">Concluída</option>
                        </select>
                      </div>

                      <div className="col-md-6">
                        <label className="form-label-custom">Data *</label>
                        <input type="date" className="form-control-custom" value={form.data} required
                          onChange={e => set('data', e.target.value)} />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label-custom">Horário *</label>
                        <input type="time" className="form-control-custom" value={form.horario} required
                          onChange={e => set('horario', e.target.value)} />
                      </div>

                      {form.acesso === 'fechada' && (
                        <div className="col-md-6">
                          <label className="form-label-custom">Limite de membros *</label>
                          <input type="number" className="form-control-custom" value={form.limite_membros} required
                            min="1" max="999" onChange={e => set('limite_membros', e.target.value)} />
                        </div>
                      )}

                      {form.acesso !== 'fechada' && (
                        <div className="col-md-6">
                          <label className="form-label-custom">
                            Limite de consulentes *
                            <span style={{ color: 'var(--cor-texto-suave)', fontWeight: 400, marginLeft: '0.4rem', fontSize: '0.78rem' }}>
                              (aumentar libera vagas da fila de espera)
                            </span>
                          </label>
                          <input type="number" className="form-control-custom" value={form.limite_consulentes} required
                            min="1" max="999" onChange={e => set('limite_consulentes', e.target.value)} />
                        </div>
                      )}

                      {form.acesso !== 'fechada' && (
                        <>
                          <div className="col-md-6">
                            <label className="form-label-custom">Responsável pela lista</label>
                            <select className="form-control-custom" value={form.responsavel_lista_id}
                              onChange={e => set('responsavel_lista_id', e.target.value)}>
                              <option value="">— Nenhum —</option>
                              {membros.map(m => (
                                <option key={m.id} value={m.id}>{m.nome}</option>
                              ))}
                            </select>
                          </div>

                          <div className="col-md-6">
                            <label className="form-label-custom">Abertura da lista *</label>
                            <input type="datetime-local" className="form-control-custom" value={form.abertura_lista}
                              onChange={e => set('abertura_lista', e.target.value)} required />
                          </div>

                          <div className="col-md-6">
                            <label className="form-label-custom">Fechamento da lista *</label>
                            <input type="datetime-local" className="form-control-custom" value={form.fechamento_lista}
                              onChange={e => set('fechamento_lista', e.target.value)} required />
                          </div>
                        </>
                      )}

                      <div className="col-12" style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button type="submit" className="btn-gold" disabled={saving}
                          style={{ padding: '0.65rem 2rem' }}>
                          {saving
                            ? <><span className="spinner-border spinner-border-sm me-2"></span>Salvando...</>
                            : <><i className="bi bi-check-lg me-2"></i>Salvar alterações</>}
                        </button>
                        <Link href={`/giras/${id}`} className="btn-outline-gold"
                          style={{ padding: '0.65rem 1.5rem', textDecoration: 'none' }}>
                          Cancelar
                        </Link>
                      </div>

                    </div>
                  </form>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}