import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Sidebar from '../../../components/Sidebar';
import BottomNav from '../../../components/BottomNav';
import ConfirmModal from '../../../components/ConfirmModal';
import { useGiraPublica, useGiras } from '../../../hooks/useGiras';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { inscreverInterno } from '../../../services/api';
import { handleApiError } from '../../../services/errorHandler';
import { formatDate, formatPhone, formatTime, formatDateTime } from '../../../utils/format';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Spinner, StatCard } from '../../../components/ui';
import debounce from 'lodash.debounce';
import { useMemo } from 'react';
import { buscarNome } from '../../../services/api';
import { buildGiraItem } from '../../../viewModels/giraViewModel';

function FormularioInscricao({ listaEspera, posicaoFila, giraId }) {
  const [sugestoes, setSugestoes] = useState([]);

  const buscarConsulentes = async (value) => {
  if (value.length < 2) {
    setSugestoes([]);
    return;
  }

  try {
    const res = await buscarNome(value);

    console.log("Resultado da busca:", res);

    setSugestoes(res.data); // ✅ CORRETO
  } catch (err) {
    console.error("Erro na busca:", err);
    setSugestoes([]);
  }
};

  const buscarDebounced = useMemo(() => {
  return debounce((value) => {
    buscarConsulentes(value);
  }, 300);
}, []);

  useEffect(() => {
    return () => {
      buscarDebounced.cancel();
    };
  }, [buscarDebounced]);

  const [form, setForm] = useState({
    nome:           '',
    telefone:       '',
    observacoes:    '',
    primeira_visita: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [resultado,  setResultado]  = useState(null);
  const [error,      setError]      = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        nome:            form.nome.trim(),
        telefone:        form.telefone.trim(),
        primeira_visita: form.primeira_visita,
        observacoes:     form.observacoes.trim() || null,
      };
      const res = await inscreverInterno(giraId, payload);
      setResultado(res.data);
    } catch (err) {
      // Mensagem específica para inscrição cancelada — orienta contatar o terreiro
      const detail = err?.response?.data?.detail || '';
      if (detail.includes('cancelada')) {
        setError(detail);  // usa a mensagem do backend diretamente (já amigável)
      } else {
        setError(handleApiError(err, 'Inscricao Interna'));
      }
    } finally {
      setSubmitting(false);
    }
  };
// ── Confirmação pós-inscrição ────────────────────────────────────────────
  if (resultado) {
    const naFila = resultado.status === 'lista_espera';
    return (
      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>
          {naFila ? '⏳' : '✦'}
        </div>
        <div style={{ fontSize: '1rem', color: 'var(--cor-texto)', fontWeight: 600 }}>
          {naFila ? 'Você está na lista de espera!' : 'Inscrição confirmada!'}
        </div>
        <div style={{ color: 'var(--cor-texto-suave)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          {resultado.consulente_nome}, você está na posição
        </div>
        <div style={{
          color: naFila ? '#f59e0b' : 'var(--cor-acento)',
          fontFamily: 'Cinzel',
          fontSize: '4rem', fontWeight: 700, lineHeight: 1, margin: '0.5rem 0',
        }}>
          #{resultado.posicao}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--cor-texto-suave)' }}>
          {naFila
            ? 'Você será notificado caso uma vaga abra. Anote sua posição!'
            : 'Anote sua posição — nos vemos na gira!'}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Aviso de lista de espera (visível apenas quando vagas esgotadas) ── */}
      {listaEspera && (
        <div style={{
          background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: '10px',
          padding: '1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
        }}>
          <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>⏳</span>
          <div>
            <div style={{ color: '#fcd34d', fontWeight: 600, fontSize: '0.9rem' }}>
              Vagas esgotadas — entre na fila de espera
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', marginTop: '3px', lineHeight: 1.4 }}>
              {posicaoFila > 0
                ? `Já há ${posicaoFila} pessoa${posicaoFila > 1 ? 's' : ''} na fila. Você será o(a) ${posicaoFila + 1}º.`
                : 'Você será o(a) primeiro(a) na fila de espera.'}
              {' '}Caso alguém cancele, sua vaga será confirmada.
            </div>
          </div>
        </div>
      )}

      <h6 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
        ✦ {listaEspera ? 'Colocar consulente na Fila de Espera' : 'Realizar inscrição do consulente'}
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
          onChange={e => {
            const value = e.target.value;

            setForm(prev => ({ ...prev, nome: value }));
            buscarDebounced(value);
          }}
          placeholder="Seu nome completo"
          required
        />
      </div>
      {sugestoes.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.75rem'}}>
          <div className="autocomplete-box" style={{ fontSize: '0.82rem', color: 'var(--cor-texto)', marginTop: '0.35rem', lineHeight: 2 }}>
            {sugestoes.map(c => (
              <div className="form-control-custom" style={{marginBottom: '5px'}}
                key={c.id}
                onClick={() => {
                  setForm(prev => ({
                    ...prev,
                    nome: c.nome,
                    telefone: c.telefone || prev.telefone, // mantém o telefone digitado se o cadastro não tiver telefone
                  }));
                  setSugestoes([]);
                }}
              >
                {c.nome} — {formatPhone(c.telefone)}
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* ── Checkbox: primeira visita ─────────────────────────────────────────
          Camada declarativa — o backend valida pelo banco como camada final.
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
              width: '20px', height: '20px', borderRadius: '5px',
              border: `2px solid ${form.primeira_visita
                ? 'var(--cor-acento)'
                : 'rgba(255,255,255,0.2)'}`,
              background: form.primeira_visita ? 'var(--cor-acento)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: '1px', transition: 'all 0.15s',
            }}
          >
            {form.primeira_visita && (
              <i className="bi bi-check" style={{ fontSize: '0.75rem', color: '#1a0a2e', fontWeight: 700 }}></i>
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
              É a primeira vez do consulente 🌟
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--cor-texto-suave)', marginTop: '2px', lineHeight: 1.4 }}>
              Marque se ele nunca participou de uma gira neste terreiro
            </div>
          </div>
        </label>
      </div>

      {/* ── Campo de observações — opcional ─────────────────────────────────── */}
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
        {form.observacoes.length > 0 && (
          <div style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--cor-texto-suave)', marginTop: '2px' }}>
            {form.observacoes.length}/500
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        className="btn-gold w-100"
        disabled={submitting || !form.nome}
        style={{
          padding: '0.85rem',
          // Cor diferenciada para lista de espera (âmbar em vez de dourado)
          background: listaEspera ? 'rgba(245,158,11,0.85)' : undefined,
        }}
      >
        {submitting
          ? <span className="spinner-border spinner-border-sm me-2"></span>
          : <i className={`bi ${listaEspera ? 'bi-hourglass-split' : 'bi-stars'} me-2`}></i>
        }
        {listaEspera ? 'Entrar na Fila de Espera' : 'Confirmar Inscrição'}
      </button>
    </div>
  );
}

export default function Inscricao() {
    const router = useRouter();
    const isMobile = useIsMobile();
    const { gira, loading, error } = useGiraPublica(router.query.id);

    const dataFormatada = formatDate(gira?.data);
    const horario       = formatTime(gira?.horario);
    const ogTitle       = gira ? gira.titulo : 'Inscrição de Gira';
    // ── Estado de erro ────────────────────────────────────────────────────────
    if (error || !gira) {
        return (
        <>
            <Head>
            <title>Gira não encontrada | AxeFlow</title>
            <meta name="robots" content="noindex" />
            </Head>
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0720' }}>
            <div style={{ textAlign: 'center', color: 'var(--cor-texto)', padding: '2rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>☽✦☾</div>
                <h2 style={{ fontFamily: 'Cinzel' }}>
                    {typeof error === 'string'
                        ? error
                        : error?.message || 'Gira não encontrada'}
                </h2>
            </div>
            </div>
        </>
        );
    }

    // ── Lógica de estado da lista ─────────────────────────────────────────────

    const agora          = new Date();
    const listaFutura    = gira.abertura_lista  && agora < new Date(gira.abertura_lista);
    const listaEncerrada = gira.fechamento_lista && agora > new Date(gira.fechamento_lista);
    // Percentual de ocupação (considera vagas + lista de espera para a barra visual)
    const ocupadas = gira.limite_consulentes - gira.vagas_disponiveis;
    const pct      = Math.min(100, (ocupadas / gira.limite_consulentes) * 100);

    // Se vagas == 0 mas a lista está aberta → modo lista de espera
    const vagasEsgotadas = gira.vagas_disponiveis === 0;
    const podeListaEspera = vagasEsgotadas && !listaFutura && !listaEncerrada && gira.lista_aberta;

    if (loading) return <Spinner center />;

    return (
        <>
            <Head>
                <title>{gira?.titulo}</title>
            </Head>

            <div style={{ display: 'flex' }}>
                <Sidebar></Sidebar>
                <div className="main-content">
                    <div className="topbar">
                        <div className='d-flex gap-2 align-items-center flex-wrap'>
                            <h5>{gira?.titulo}</h5>
                            <Badge preset={gira.status}>{gira.status}</Badge>
                        </div>
                        <Link href={`/giras/${gira.id}`} style={{ color: 'var(--cor-texto-suave)', textDecoration: 'none' }}>
                            <i className="bi bi-arrow-left me-1" /> Voltar
                        </Link>
                    </div>

                    <div className="page-content">
                        {/* ── Data e Hora ── */}
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

                        {/* ── Barra de vagas ── */}
                        <div className="mb-4">
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                            <span style={{ fontSize: '0.82rem', color: 'var(--cor-texto-suave)' }}>
                              Vagas disponíveis
                            </span>
                            <span style={{
                              fontSize: '0.85rem', fontWeight: 700,
                              color: vagasEsgotadas ? '#ef4444' : '#10b981',
                            }}>
                              {gira.vagas_disponiveis} / {gira.limite_consulentes}
                            </span>
                          </div>
                          <div className="vagas-bar">
                            <div className="vagas-fill" style={{ width: `${pct}%` }}></div>
                          </div>

                          {/* Indicador de fila de espera — visível quando há pessoas aguardando */}
                          {gira.lista_espera > 0 && (
                            <div style={{
                              marginTop: '0.5rem', fontSize: '0.75rem',
                              color: '#f59e0b', textAlign: 'right',
                            }}>
                              ⏳ {gira.lista_espera} pessoa{gira.lista_espera > 1 ? 's' : ''} na fila de espera
                            </div>
                          )}
                        </div>
                        {/* ── Estados da inscrição ── */}
                        {/* lista futura */}
                        {listaFutura ? (
                        /* Lista ainda não abriu */
                        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', padding: '1.25rem', textAlign: 'center' }}>
                            <i className="bi bi-hourglass-split" style={{ color: '#f59e0b', fontSize: '1.5rem' }}></i>
                            <div style={{ color: '#fcd34d', fontWeight: 600, marginTop: '0.5rem' }}>Lista ainda não abriu</div>
                            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            Abre em {new Date(gira.abertura_lista).toLocaleString('pt-BR')}
                            </div>
                        </div>

                        ) : listaEncerrada ? (
                        /* Lista encerrada */
                        <div style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '10px', padding: '1.25rem', textAlign: 'center' }}>
                            <i className="bi bi-lock" style={{ color: '#94a3b8', fontSize: '1.5rem' }}></i>
                            <div style={{ color: '#94a3b8', fontWeight: 600, marginTop: '0.5rem' }}>Lista encerrada</div>
                            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            As inscrições para esta gira foram fechadas
                            </div>
                        </div>

                        ) : (
                        /*
                        * Formulário de inscrição — renderizado para:
                        *   - Gira com vagas: modo normal
                        *   - Vagas esgotadas + lista aberta: modo lista de espera
                        *
                        * O componente FormularioInscricao recebe `listaEspera` para
                        * ajustar textos, cores e mensagem pós-inscrição.
                        */
                        <FormularioInscricao
                            listaEspera={podeListaEspera}
                            posicaoFila={gira.lista_espera}
                            giraId={gira.id}
                        />
                        )}
                    </div>
                </div>
                <BottomNav></BottomNav>
            </div>
        </>
    )
}