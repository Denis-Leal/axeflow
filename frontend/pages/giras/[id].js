/**
 * pages/giras/[id].js — AxeFlow
 *
 * ALTERAÇÕES nesta versão:
 *
 * 1. handleCancelar — recebe o retorno do backend com `promovido`:
 *    - Atualiza o status do cancelado para 'cancelado' no estado local
 *    - Atualiza o status do promovido para 'confirmado' no estado local
 *    - Abre o WhatsApp AUTOMATICAMENTE com mensagem pré-preenchida
 *    - Exibe um toast de confirmação informando que o WA foi aberto
 *
 * 2. ToastPromovido — componente de notificação inline:
 *    - Aparece após a promoção confirmando que o WhatsApp foi aberto
 *    - Botão secundário para reabrir o WhatsApp caso o admin feche por engano
 *    - Fecha automaticamente em 20s ou manualmente
 *
 * 3. Badge lista_espera — estilo visual adicionado (estava sem cor definida)
 *
 * 4. Botão WhatsApp inline — na linha de cada inscrição com status lista_espera:
 *    - Ícone 📱 que abre wa.me com mensagem pré-preenchida
 *    - Permite o admin contatar manualmente sem sair da página
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Sidebar from '../../components/Sidebar';
import BottomNav from '../../components/BottomNav';
import ConfirmModal from '../../components/ConfirmModal';
import { getGira, listInscricoes, updatePresenca, cancelarInscricao } from '../../services/api';
import api from '../../services/api';

// ── Paleta de cores por classificação de score ────────────────────────────────
const COR_SCORE = {
  verde:    { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)',  text: '#10b981' },
  amarelo:  { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)',  text: '#f59e0b' },
  laranja:  { bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.35)',  text: '#f97316' },
  vermelho: { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)',   text: '#ef4444' },
  cinza:    { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.25)', text: '#94a3b8' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Formata telefone E.164 (sem '+') para link wa.me.
 * Ex: "5511999999999" → "https://wa.me/5511999999999?text=..."
 */
function linkWhatsApp(telefone, mensagem) {
  // Remove qualquer não-dígito que possa ter vindo do banco
  const digitos = String(telefone).replace(/\D/g, '');
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensagem)}`;
}

// ── Componente: toast de promoção automática ──────────────────────────────────

/**
 * Exibido após promoção automática, confirmando que o WhatsApp já foi aberto.
 * Fecha automaticamente em 20 segundos.
 * Inclui botão para REABRIR o WhatsApp caso o admin tenha fechado por engano.
 */
function ToastPromovido({ promovido, giraTitulo, onClose }) {
  // Fecha automaticamente após 20s (ação já foi feita, não precisa de muito tempo)
  useEffect(() => {
    const timer = setTimeout(onClose, 20_000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!promovido) return null;

  const mensagemWA = (
    `Olá ${promovido.nome}! Uma vaga foi liberada na gira "${giraTitulo}". ` +
    `Você estava na lista de espera e agora está confirmado(a)! 🎉`
  );

  return (
    <div style={{
      background: 'rgba(16,185,129,0.12)',
      border: '1px solid rgba(16,185,129,0.4)',
      borderRadius: '12px',
      padding: '1rem 1.25rem',
      marginBottom: '1.25rem',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.75rem',
    }}>
      <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>✅</span>

      <div style={{ flex: 1 }}>
        <div style={{ color: '#10b981', fontWeight: 700, fontSize: '0.9rem' }}>
          {promovido.nome} foi promovido(a) — WhatsApp aberto automaticamente!
        </div>
        <div style={{ color: 'var(--cor-texto-suave)', fontSize: '0.78rem', marginTop: '3px' }}>
          A mensagem de confirmação de vaga foi enviada para {promovido.nome}.
        </div>

        {/* Botão para REABRIR o WhatsApp caso o admin tenha fechado por engano */}
        <a
          href={linkWhatsApp(promovido.telefone, mensagemWA)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            marginTop: '0.6rem',
            background: 'rgba(37,211,102,0.10)',
            border: '1px solid rgba(37,211,102,0.3)',
            color: '#25d366',
            borderRadius: '8px',
            padding: '0.3rem 0.75rem',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.78rem',
          }}
        >
          <i className="bi bi-whatsapp"></i>
          Reabrir WhatsApp
        </a>
      </div>

      {/* Fechar toast */}
      <button
        onClick={onClose}
        style={{
          background: 'none', border: 'none',
          color: 'var(--cor-texto-suave)', cursor: 'pointer',
          fontSize: '1rem', lineHeight: 1, padding: '0',
        }}
        title="Fechar"
      >
        ×
      </button>
    </div>
  );
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function ScoreBadge({ score }) {
  if (!score) return null;
  const c = COR_SCORE[score.cor] || COR_SCORE.cinza;
  return (
    <span
      title={`${score.comparecimentos ?? 0} presenças · ${score.faltas ?? 0} faltas · ${score.finalizadas ?? 0} giras`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        background: c.bg, border: `1px solid ${c.border}`, color: c.text,
        borderRadius: '20px', padding: '1px 8px', fontSize: '0.7rem', fontWeight: 600,
        whiteSpace: 'nowrap', cursor: 'help',
      }}
    >
      {score.emoji} {score.score !== null ? `${score.score}%` : score.label}
    </span>
  );
}

function AlertaFalta({ score }) {
  if (!score?.alerta) return null;
  return (
    <span
      title={`${score.faltas} faltas registradas — ocupando vaga sem comparecer`}
      style={{
        display: 'inline-flex', alignItems: 'center',
        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
        color: '#ef4444', borderRadius: '4px', padding: '1px 6px',
        fontSize: '0.68rem', marginLeft: '4px', cursor: 'help',
      }}
    >
      ⚠ {score.faltas}x faltou
    </span>
  );
}

function ObservacaoBadge({ texto }) {
  if (!texto) return null;
  return (
    <div
      title={texto}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '4px',
        marginTop: '4px',
        background: 'rgba(212,175,55,0.07)',
        border: '1px solid rgba(212,175,55,0.2)',
        borderRadius: '6px',
        padding: '3px 7px',
        maxWidth: '260px',
      }}
    >
      <i className="bi bi-chat-left-text" style={{ fontSize: '0.65rem', color: '#d4af37', marginTop: '2px', flexShrink: 0 }}></i>
      <span style={{
        fontSize: '0.72rem', color: '#d4af37', lineHeight: '1.4',
        display: '-webkit-box', WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {texto}
      </span>
    </div>
  );
}

// ── Painel de presença de membros ─────────────────────────────────────────────
function PainelPresencaMembros({ giraId, acesso, membrosPresenca, onUpdateMembro }) {
  const confirmados = membrosPresenca.filter(m => m.status === 'compareceu').length;
  const confirmando = membrosPresenca.filter(m => m.status === 'confirmado').length;

  return (
    <div className="card-custom mb-4">
      <div className="card-header">
        <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
          {acesso === 'fechada' ? '🔒 Presença dos Membros' : '👥 Confirmação dos Membros'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', fontSize: '0.78rem' }}>
          <span style={{ color: '#10b981' }}>✓ {confirmados} compareceram</span>
          <span style={{ color: '#f59e0b' }}>⏳ {confirmando} vão comparecer</span>
          <span style={{ color: 'var(--cor-texto-suave)' }}>· {membrosPresenca.length} total</span>
        </div>
      </div>

      <div style={{
        padding: '0.6rem 1rem',
        background: 'rgba(212,175,55,0.04)',
        borderBottom: '1px solid var(--cor-borda)',
        fontSize: '0.72rem', color: 'var(--cor-texto-suave)',
        display: 'flex', gap: '1.5rem', flexWrap: 'wrap',
      }}>
        <span>⏳ <strong style={{ color: 'var(--cor-texto)' }}>Confirmado</strong> — membro confirmou presença</span>
        <span>✅ <strong style={{ color: 'var(--cor-texto)' }}>Compareceu</strong> — admin finalizou após a gira</span>
        <span>❌ <strong style={{ color: 'var(--cor-texto)' }}>Faltou</strong> — confirmou mas não apareceu</span>
      </div>

      <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {membrosPresenca.length === 0 && (
          <div className="empty-state"><p>Nenhum membro encontrado</p></div>
        )}
        {membrosPresenca.map(m => {
          const statusCor = {
            compareceu: { bg: 'rgba(16,185,129,0.07)',  border: 'rgba(16,185,129,0.2)',  text: '#10b981', label: '✓ Compareceu' },
            faltou:     { bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.18)',  text: '#ef4444', label: '✗ Faltou' },
            confirmado: { bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.2)',  text: '#f59e0b', label: '⏳ Vai comparecer' },
            pendente:   { bg: 'rgba(255,255,255,0.02)', border: 'var(--cor-borda)',       text: '#94a3b8', label: '— Pendente' },
          }[m.status] || { bg: 'transparent', border: 'var(--cor-borda)', text: '#94a3b8', label: '— Pendente' };

          return (
            <div key={m.membro_id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.6rem 0.75rem', borderRadius: '8px',
              background: statusCor.bg, border: `1px solid ${statusCor.border}`,
            }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--cor-texto)' }}>{m.nome}</span>
                <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: 'var(--cor-texto-suave)', textTransform: 'capitalize' }}>{m.role}</span>
                <span style={{ marginLeft: '0.75rem', fontSize: '0.72rem', color: statusCor.text, fontWeight: 600 }}>{statusCor.label}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button onClick={() => onUpdateMembro(m.membro_id, m.status === 'compareceu' ? 'pendente' : 'compareceu')} title="Marcar compareceu"
                  style={{ background: m.status === 'compareceu' ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.08)', border: `1px solid ${m.status === 'compareceu' ? 'rgba(16,185,129,0.6)' : 'rgba(16,185,129,0.2)'}`, color: '#10b981', borderRadius: '6px', padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                  <i className="bi bi-check-lg"></i>
                </button>
                <button onClick={() => onUpdateMembro(m.membro_id, m.status === 'faltou' ? 'pendente' : 'faltou')} title="Marcar faltou"
                  style={{ background: m.status === 'faltou' ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.06)', border: `1px solid ${m.status === 'faltou' ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.15)'}`, color: '#ef4444', borderRadius: '6px', padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function GiraDetalhe() {
  const router = useRouter();
  const { id } = router.query;

  const [gira, setGira]                       = useState(null);
  const [inscricoes, setInscricoes]           = useState([]);
  const [membrosPresenca, setMembrosPresenca] = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [filtro, setFiltro]                   = useState('todos');
  const [ordenar, setOrdenar]                 = useState('posicao');
  const [linkCopiado, setLinkCopiado]         = useState(false);
  // Estado do toast de promoção automática — null = oculto
  const [promovido, setPromovido]             = useState(null);
  // Estado do modal de confirmação/alerta
  const [modal, setModal] = useState({
    aberto: false, titulo: '', mensagem: '',
    apenasOk: false, tipoBotao: 'perigo',
    labelConfirmar: 'Confirmar',
    onConfirmar: null,
  });

  // ── Carregamento inicial ────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    Promise.all([getGira(id), listInscricoes(id)])
      .then(([giraRes, inscRes]) => {
        const g = giraRes.data;
        setGira(g);
        setInscricoes(inscRes.data);

        const endpoint = g.acesso === 'fechada'
          ? `/membros/giras/${id}/presenca-membros`
          : `/membros/giras/${id}/presenca-membros-publica`;

        return api.get(endpoint).then(r => setMembrosPresenca(r.data)).catch(() => {});
      })
      .catch(() => router.push('/giras'))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handlePresenca = async (inscricaoId, status) => {
    await updatePresenca(inscricaoId, status);
    setInscricoes(prev => prev.map(i => i.id === inscricaoId ? { ...i, status } : i));
  };

  const handlePresencaMembro = async (membroId, status) => {
    await api.post(`/membros/giras/${id}/presenca-membros/${membroId}`, { status });
    setMembrosPresenca(prev => prev.map(m =>
      m.membro_id === membroId ? { ...m, status } : m
    ));
  };

  const copyLink = async () => {
    const link = `${window.location.origin}/public/${gira.slug_publico}`;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2500);
    } catch {
      window.prompt('Copie o link abaixo:', link);
    }
  };

  /** Fecha o modal e limpa o estado */
  const fecharModal = useCallback(() => {
    setModal(m => ({ ...m, aberto: false, onConfirmar: null }));
  }, []);

  const handleCancelar = (inscricaoId, nomeConsulente) => {
    setModal({
      aberto: true,
      titulo: 'Cancelar inscrição',
      mensagem: `Tem certeza que deseja cancelar a inscrição de "${nomeConsulente}"?\n\nEsta ação não pode ser desfeita.`,
      apenasOk: false,
      tipoBotao: 'perigo',
      labelConfirmar: 'Cancelar inscrição',
      onConfirmar: async () => {
        fecharModal();
        const res = await cancelarInscricao(inscricaoId);
        const resultado = res.data;

        setInscricoes(prev => prev.map(i =>
          i.id === inscricaoId ? { ...i, status: 'cancelado' } : i
        ));

        if (resultado?.promovido) {
          const { nome, telefone, posicao } = resultado.promovido;
          setInscricoes(prev => prev.map(i => {
            if (i.consulente_telefone === telefone && i.status === 'lista_espera') {
              return { ...i, status: 'confirmado' };
            }
            return i;
          }));
          const mensagemWA = (
            `Olá ${nome}! Uma vaga foi liberada na gira "${gira.titulo}". ` +
            `Você estava na lista de espera e agora está confirmado(a)! 🎉`
          );
          window.open(linkWhatsApp(telefone, mensagemWA), '_blank', 'noopener,noreferrer');
          setPromovido({ nome, telefone, posicao });
        }
      },
    });
  };

  const handleReativar = (inscricaoId, nomeConsulente) => {
    setModal({
      aberto: true,
      titulo: 'Reativar inscrição',
      mensagem: `Reativar a inscrição de "${nomeConsulente}"?\n\nSe ainda houver vaga, voltará como confirmado. Se lotada, entrará na fila de espera.`,
      apenasOk: false,
      tipoBotao: 'sucesso',
      labelConfirmar: 'Reativar',
      onConfirmar: async () => {
        fecharModal();
        const res = await api.post(`/inscricao/${inscricaoId}/reativar`);
        const { status, mensagem } = res.data;
        setInscricoes(prev => prev.map(i =>
          i.id === inscricaoId ? { ...i, status } : i
        ));
        // Exibe resultado como alerta no padrão visual
        setModal({
          aberto: true,
          titulo: status === 'confirmado' ? '✅ Inscrição reativada' : '⏳ Adicionado à fila',
          mensagem,
          apenasOk: true,
          tipoBotao: status === 'confirmado' ? 'sucesso' : 'padrao',
          labelConfirmar: 'OK',
          onConfirmar: fecharModal,
        });
      },
    });
  };

  // ── Métricas ────────────────────────────────────────────────────────────────
  const ativas        = inscricoes.filter(i => i.status !== 'cancelado');
  const alertas       = inscricoes.filter(i => i.score_presenca?.alerta).length;
  const comObservacao = inscricoes.filter(i => i.observacoes).length;
  const naFila        = inscricoes.filter(i => i.status === 'lista_espera').length;

  let filtradas = inscricoes.filter(i => filtro === 'todos' || i.status === filtro);
  filtradas = [...filtradas].sort((a, b) => {
    if (ordenar === 'posicao') return a.posicao - b.posicao;
    if (ordenar === 'alerta') {
      return (a.score_presenca?.alerta ? 0 : 1) - (b.score_presenca?.alerta ? 0 : 1);
    }
    const sa = a.score_presenca?.score ?? (ordenar === 'score_asc' ? 999 : -1);
    const sb = b.score_presenca?.score ?? (ordenar === 'score_asc' ? 999 : -1);
    return ordenar === 'score_asc' ? sa - sb : sb - sa;
  });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner-gold"></div>
    </div>
  );
  if (!gira) return null;

  return (
    <>
      <Head><title>{gira.titulo} | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">

          {/* ── Topbar ── */}
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {gira.titulo}
                <span style={{
                  fontSize: '0.65rem', fontFamily: 'sans-serif', fontWeight: 600, letterSpacing: '0.5px',
                  padding: '2px 8px', borderRadius: '20px',
                  background: gira.acesso === 'fechada' ? 'rgba(148,163,184,0.12)' : 'rgba(16,185,129,0.1)',
                  border: `1px solid ${gira.acesso === 'fechada' ? 'rgba(148,163,184,0.3)' : 'rgba(16,185,129,0.3)'}`,
                  color: gira.acesso === 'fechada' ? '#94a3b8' : '#10b981',
                }}>
                  {gira.acesso === 'fechada' ? '🔒 Fechada' : '🌐 Pública'}
                </span>
              </h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>
                <i className="bi bi-calendar3 me-1"></i>
                {new Date(gira.data + 'T00:00:00').toLocaleDateString('pt-BR')} às {gira.horario}
                {gira.responsavel_lista_nome && (
                  <span style={{ marginLeft: '1rem' }}>
                    <i className="bi bi-person-check me-1"></i>
                    Resp.: <strong style={{ color: 'var(--cor-acento)' }}>{gira.responsavel_lista_nome}</strong>
                  </span>
                )}
              </small>
            </div>
            <div className="d-flex gap-2 align-items-center flex-wrap">
              <span className={`badge-status badge-${gira.status}`}>{gira.status}</span>
              <Link href={`/giras/editar/${id}`} className="btn-outline-gold"
                style={{ fontSize: '0.85rem', textDecoration: 'none' }}>
                <i className="bi bi-pencil me-1"></i> Editar
              </Link>
              {gira.acesso !== 'fechada' && (
                <button
                  onClick={copyLink}
                  className="btn-outline-gold"
                  style={{
                    fontSize: '0.85rem',
                    background: linkCopiado ? 'rgba(16,185,129,0.15)' : undefined,
                    borderColor: linkCopiado ? '#10b981' : undefined,
                    color: linkCopiado ? '#10b981' : undefined,
                  }}
                  title="Copiar link de inscrição"
                >
                  <i className={`bi ${linkCopiado ? 'bi-check-lg' : 'bi-clipboard'} me-1`}></i>
                  {linkCopiado ? 'Link copiado!' : 'Copiar link'}
                </button>
              )}
              <Link href="/giras" style={{ color: 'var(--cor-texto-suave)', textDecoration: 'none', fontSize: '0.9rem' }}>
                ← Voltar
              </Link>
            </div>
          </div>

          <div className="page-content">

            {/* ── Cards de estatísticas ── */}
            <div className="row g-3 mb-4">
              <div className="col-6 col-md-3">
                <div className="stat-card">
                  <div className="stat-value">{ativas.length}</div>
                  <div className="stat-label">
                    {gira.acesso === 'fechada' ? 'Membros inscritos' : 'Consulentes inscritos'}
                  </div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="stat-card">
                  <div className="stat-value" style={{ color: '#10b981' }}>
                    {inscricoes.filter(i => i.status === 'compareceu').length}
                  </div>
                  <div className="stat-label">Compareceram</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="stat-card">
                  <div className="stat-value" style={{ color: '#ef4444' }}>
                    {inscricoes.filter(i => i.status === 'faltou').length}
                  </div>
                  <div className="stat-label">Faltaram</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="stat-card">
                  {/* Mostra fila de espera se houver, senão mostra alertas */}
                  {naFila > 0 ? (
                    <>
                      <div className="stat-value" style={{ color: '#f59e0b' }}>{naFila}</div>
                      <div className="stat-label">⏳ Na fila de espera</div>
                    </>
                  ) : (
                    <>
                      <div className="stat-value" style={{ color: alertas > 0 ? '#f97316' : 'var(--cor-texto)' }}>
                        {alertas}
                      </div>
                      <div className="stat-label">
                        {alertas > 0 ? '⚠ Faltantes crônicos' : 'Faltantes crônicos'}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── Alerta de faltantes crônicos ── */}
            {alertas > 0 && (
              <div style={{
                background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)',
                borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.5rem',
                display: 'flex', alignItems: 'center', gap: '0.75rem',
              }}>
                <span style={{ fontSize: '1.2rem' }}>🚨</span>
                <div>
                  <strong style={{ color: '#f97316', fontSize: '0.9rem' }}>
                    {alertas} consulente{alertas > 1 ? 's' : ''} com histórico preocupante
                  </strong>
                  <div style={{ color: 'var(--cor-texto-suave)', fontSize: '0.8rem' }}>
                    Inscrito{alertas > 1 ? 's' : ''} nesta gira com 3+ faltas e taxa abaixo de 50%.
                  </div>
                </div>
                <button
                  onClick={() => setOrdenar('alerta')}
                  style={{
                    marginLeft: 'auto', background: 'rgba(249,115,22,0.15)',
                    border: '1px solid rgba(249,115,22,0.4)', color: '#f97316',
                    borderRadius: '6px', padding: '0.3rem 0.75rem', cursor: 'pointer',
                    fontSize: '0.8rem', whiteSpace: 'nowrap',
                  }}
                >
                  Ver primeiro
                </button>
              </div>
            )}

            {/* ── Painel de membros (FECHADA: único | PÚBLICA: complementar) ── */}
            {gira.acesso === 'fechada' ? (
              <PainelPresencaMembros
                giraId={id} acesso={gira.acesso}
                membrosPresenca={membrosPresenca} onUpdateMembro={handlePresencaMembro}
              />
            ) : (
              <>
                {/* ── GIRA PÚBLICA: lista de consulentes ── */}
                <div className="card-custom mb-4">
                  <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                      ✦ Lista de Consulentes
                    </span>

                    {/* Badge: fila de espera — visível apenas quando há pessoas aguardando */}
                    {naFila > 0 && (
                      <span style={{
                        fontSize: '0.72rem', color: '#f59e0b',
                        background: 'rgba(245,158,11,0.1)',
                        border: '1px solid rgba(245,158,11,0.3)',
                        borderRadius: '20px', padding: '1px 8px',
                      }}>
                        ⏳ {naFila} na fila de espera
                      </span>
                    )}

                    {comObservacao > 0 && (
                      <span style={{
                        fontSize: '0.72rem', color: '#d4af37',
                        background: 'rgba(212,175,55,0.1)',
                        border: '1px solid rgba(212,175,55,0.25)',
                        borderRadius: '20px', padding: '1px 8px',
                      }}>
                        <i className="bi bi-chat-left-text me-1"></i>
                        {comObservacao} com observaç{comObservacao > 1 ? 'ões' : 'ão'}
                      </span>
                    )}

                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginLeft: 'auto', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        {['todos', 'confirmado', 'lista_espera', 'compareceu', 'faltou'].map(f => (
                          <button key={f} onClick={() => setFiltro(f)} style={{
                            background: filtro === f ? 'rgba(212,175,55,0.2)' : 'transparent',
                            border: '1px solid ' + (filtro === f ? 'var(--cor-acento)' : 'var(--cor-borda)'),
                            color: filtro === f ? 'var(--cor-acento)' : 'var(--cor-texto-suave)',
                            borderRadius: '6px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.72rem',
                          }}>
                            {f === 'todos'       ? 'Todos'
                             : f === 'lista_espera' ? '⏳ Fila'
                             : f.charAt(0).toUpperCase() + f.slice(1)}
                          </button>
                        ))}
                      </div>
                      <select value={ordenar} onChange={e => setOrdenar(e.target.value)} style={{
                        background: 'var(--cor-card)', border: '1px solid var(--cor-borda)',
                        color: 'var(--cor-texto-suave)', borderRadius: '6px',
                        padding: '0.2rem 0.5rem', fontSize: '0.72rem', cursor: 'pointer',
                      }}>
                        <option value="posicao">Ordenar: Posição</option>
                        <option value="score_asc">Score: Menor primeiro</option>
                        <option value="score_desc">Score: Maior primeiro</option>
                        <option value="alerta">⚠ Alertas primeiro</option>
                      </select>
                    </div>
                  </div>

                  {/* ── Toast de promoção automática ── */}
                  {promovido && (
                    <div style={{ padding: '0.75rem 1rem 0' }}>
                      <ToastPromovido
                        promovido={promovido}
                        giraTitulo={gira.titulo}
                        onClose={handleFecharToast}
                      />
                    </div>
                  )}

                  <div style={{ overflowX: 'auto' }}>
                    <table className="table-custom">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Nome</th>
                          <th>Histórico</th>
                          <th>Status</th>
                          <th className="d-none d-md-table-cell">Inscrito em</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtradas.map(i => {
                          const sc = i.score_presenca;
                          const eListaEspera = i.status === 'lista_espera';

                          // Mensagem padrão para WhatsApp de quem está na fila
                          const mensagemWA = (
                            `Olá ${i.consulente_nome}! Uma vaga foi liberada na gira "${gira.titulo}". ` +
                            `Você estava na fila de espera e agora está confirmado(a)! 🎉`
                          );

                          return (
                            <tr key={i.id} style={{
                              background: sc?.alerta
                                ? 'rgba(239,68,68,0.04)'
                                : eListaEspera
                                  ? 'rgba(245,158,11,0.03)'  // fundo levíssimo para fila
                                  : 'transparent',
                            }}>

                              {/* Posição na fila */}
                              <td style={{
                                color: eListaEspera ? '#f59e0b' : 'var(--cor-acento)',
                                fontFamily: 'Cinzel', fontWeight: 700,
                              }}>
                                {i.posicao}º
                              </td>

                              {/* Nome + telefone + observação inline */}
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <strong>{i.consulente_nome}</strong>
                                  <AlertaFalta score={sc} />
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--cor-texto-suave)' }}>
                                  {i.consulente_telefone}
                                </div>
                                <ObservacaoBadge texto={i.observacoes} />
                              </td>

                              {/* Score de histórico */}
                              <td>
                                {sc ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <ScoreBadge score={sc} />
                                    {sc.finalizadas > 0 ? (
                                      <span style={{ fontSize: '0.68rem', color: 'var(--cor-texto-suave)' }}>
                                        {sc.comparecimentos}✓ {sc.faltas}✗ / {sc.finalizadas} giras
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '0.68rem', color: 'var(--cor-texto-suave)' }}>
                                        Sem histórico anterior
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--cor-texto-suave)', fontSize: '0.78rem' }}>—</span>
                                )}
                              </td>

                              {/* Status badge */}
                              <td>
                                {eListaEspera ? (
                                  /* Badge customizado para lista_espera (cor âmbar) */
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    padding: '0.3rem 0.7rem', borderRadius: '20px',
                                    fontSize: '0.75rem', fontWeight: 600,
                                    background: 'rgba(245,158,11,0.15)',
                                    color: '#f59e0b',
                                    border: '1px solid rgba(245,158,11,0.3)',
                                  }}>
                                    ⏳ fila de espera
                                  </span>
                                ) : (
                                  <span className={`badge-status badge-${i.status}`}>{i.status}</span>
                                )}
                              </td>

                              {/* Data de inscrição */}
                              <td className="d-none d-md-table-cell" style={{ color: 'var(--cor-texto-suave)', fontSize: '0.8rem' }}>
                                {new Date(i.created_at).toLocaleString('pt-BR')}
                              </td>

                              {/* Ações */}
                              <td>
                                {i.status === 'cancelado' ? (
                                  /* Inscrição cancelada — apenas botão reativar */
                                  <button
                                    onClick={() => handleReativar(i.id, i.consulente_nome || 'este consulente')}
                                    title="Reativar inscrição"
                                    style={{
                                      background: 'rgba(212,175,55,0.1)',
                                      border: '1px solid rgba(212,175,55,0.35)',
                                      color: 'var(--cor-acento)',
                                      borderRadius: '6px',
                                      padding: '0.25rem 0.6rem',
                                      cursor: 'pointer',
                                      fontSize: '0.78rem',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.3rem',
                                    }}
                                  >
                                    <i className="bi bi-arrow-counterclockwise"></i>
                                    Reativar
                                  </button>
                                ) : (
                                  <div className="d-flex gap-1">
                                    {/* Botão WhatsApp — apenas para quem está na fila de espera */}
                                    {eListaEspera && i.consulente_telefone && (
                                      <a
                                        href={linkWhatsApp(i.consulente_telefone, mensagemWA)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Avisar via WhatsApp que a vaga foi liberada"
                                        style={{
                                          display: 'inline-flex', alignItems: 'center',
                                          background: 'rgba(37,211,102,0.12)',
                                          border: '1px solid rgba(37,211,102,0.35)',
                                          color: '#25d366', borderRadius: '6px',
                                          padding: '0.25rem 0.5rem', fontSize: '0.85rem',
                                          textDecoration: 'none',
                                        }}
                                      >
                                        <i className="bi bi-whatsapp"></i>
                                      </a>
                                    )}
                                    {/* Marcar presença — irrelevante para lista_espera, mas disponível */}
                                    {!eListaEspera && (
                                      <>
                                        <button onClick={() => handlePresenca(i.id, 'compareceu')} title="Marcar presença"
                                          style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
                                          <i className="bi bi-check-lg"></i>
                                        </button>
                                        <button onClick={() => handlePresenca(i.id, 'faltou')} title="Marcar falta"
                                          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
                                          <i className="bi bi-x-lg"></i>
                                        </button>
                                      </>
                                    )}
                                    {/* Cancelar — disponível para todos ativos */}
                                    <button
                                      onClick={() => handleCancelar(i.id, i.consulente_nome || 'este consulente')}
                                      title="Cancelar inscrição"
                                      style={{ background: 'transparent', border: '1px solid var(--cor-borda)', color: 'var(--cor-texto-suave)', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}
                                    >
                                      <i className="bi bi-trash"></i>
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {filtradas.length === 0 && (
                          <tr><td colSpan="6">
                            <div className="empty-state">
                              <i className="bi bi-people d-block"></i>
                              <p>Nenhum consulente {filtro !== 'todos' ? `com status "${filtro}"` : 'inscrito'}</p>
                            </div>
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Legenda dos scores */}
                  <div style={{
                    padding: '0.75rem 1rem', borderTop: '1px solid var(--cor-borda)',
                    display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>Score de presença:</span>
                    {[
                      { emoji: '✅', label: 'Confiável ≥80%', cor: 'verde' },
                      { emoji: '⚠️', label: 'Regular 50–79%', cor: 'amarelo' },
                      { emoji: '🔶', label: 'Risco 20–49%', cor: 'laranja' },
                      { emoji: '🚫', label: 'Problemático <20%', cor: 'vermelho' },
                      { emoji: '🆕', label: 'Novo (< 2 giras)', cor: 'cinza' },
                    ].map(s => {
                      const c = COR_SCORE[s.cor];
                      return (
                        <span key={s.cor} style={{
                          fontSize: '0.7rem', color: c.text,
                          background: c.bg, border: `1px solid ${c.border}`,
                          borderRadius: '20px', padding: '1px 8px',
                        }}>
                          {s.emoji} {s.label}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* ── Painel de membros (complementar em giras públicas) ── */}
                <PainelPresencaMembros
                  giraId={id} acesso={gira.acesso}
                  membrosPresenca={membrosPresenca} onUpdateMembro={handlePresencaMembro}
                />
              </>
            )}

          </div>
        </div>
      </div>
      <BottomNav />

      {/* Modal de confirmação/alerta — cobre todos os window.confirm e window.alert */}
      <ConfirmModal
        aberto={modal.aberto}
        titulo={modal.titulo}
        mensagem={modal.mensagem}
        apenasOk={modal.apenasOk}
        tipoBotao={modal.tipoBotao}
        labelConfirmar={modal.labelConfirmar}
        onConfirmar={modal.onConfirmar}
        onCancelar={fecharModal}
      />
    </>
  );
}