/**
 * pages/gira/[id]/consumo.js — AxeFlow
 *
 * Tela OPERACIONAL de consumo de uma gira específica.
 *
 * Responsabilidades:
 *   - Registrar o que cada médium usou durante a gira
 *   - Listar consumos já registrados
 *   - Finalizar a gira (debita itens do estoque de forma definitiva)
 *
 * Linguagem amigável:
 *   - "source MEDIUM"   → "Meu item (médium)"
 *   - "source TERREIRO" → "Item do terreiro"
 *   - Status PENDENTE   → "Aguardando fechamento"
 *   - Status PROCESSADO → "Registrado no estoque"
 *
 * CORREÇÃO: após finalizar a gira, o status é atualizado no GiraContext
 * via `atualizarStatusGira('concluida')` sem depender de reload de página.
 */

import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  listarItens,
  listarConsumos,
  registrarConsumo,
  editarConsumo,
  finalizarGira,
  getGira,
} from '../../../services/api';
import { handleApiError } from '../../../services/errorHandler';
import { useGiraAtual } from '../../../contexts/GiraContext';
import Sidebar from '../../../components/Sidebar';
import BottomNav from '../../../components/BottomNav';
import ConfirmModal from '../../../components/ConfirmModal';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Formata 'YYYY-MM-DD' em 'DD/MM/YYYY' sem problemas de fuso horário */
function formatarData(dataStr) {
  if (!dataStr) return '';
  const [y, m, d] = dataStr.split('-');
  return `${d}/${m}/${y}`;
}

// ── Labels amigáveis para origem do consumo ───────────────────────────────────
const LABEL_ORIGEM = {
  TERREIRO: { label: 'Item do terreiro', emoji: '🏛️', cor: '#60a5fa' },
  MEDIUM:   { label: 'Meu item (médium)', emoji: '🙋', cor: '#a78bfa' },
};

// ── Labels amigáveis para status do consumo ───────────────────────────────────
const LABEL_STATUS = {
  PENDENTE:   { label: 'Aguardando fechamento', cor: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  PROCESSADO: { label: 'Registrado no estoque', cor: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  CANCELADO:  { label: 'Cancelado',             cor: '#94a3b8', bg: 'rgba(148,163,184,0.1)'  },
};

// ── Banner de status da gira ───────────────────────────────────────────────────
function BannerStatusGira({ gira }) {
  if (!gira) return null;

  const configs = {
    aberta: {
      bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.3)', text: '#10b981',
      emoji: '🟢', msg: 'Gira aberta — você pode registrar consumos.',
    },
    fechada: {
      bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)', text: '#ef4444',
      emoji: '🔴', msg: 'Gira fechada — novos consumos não são permitidos.',
    },
    concluida: {
      bg: 'rgba(107,33,168,0.1)', border: 'rgba(107,33,168,0.3)', text: '#a78bfa',
      emoji: '✅', msg: 'Gira concluída — o estoque já foi processado.',
    },
  }[gira.status] || {};

  return (
    <div style={{
      background: configs.bg, border: `1px solid ${configs.border}`,
      borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.5rem',
      display: 'flex', alignItems: 'center', gap: '0.6rem',
      fontSize: '0.85rem', color: configs.text,
    }}>
      <span>{configs.emoji}</span>
      <span>{configs.msg}</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SEÇÃO: Registrar consumo
// ══════════════════════════════════════════════════════════════════════════════
function FormRegistrarConsumo({ giraId, itens, giraAberta, onConsumoRegistrado, setModal, fecharModal }) {
  const [form, setForm] = useState({
    item_id: '',
    source: 'TERREIRO',
    quantity: 1,
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro]       = useState('');
  const [sucesso, setSucesso] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    setSucesso('');

    try {
      await registrarConsumo(giraId, {
        inventory_item_id: form.item_id,
        source:            form.source,
        quantity:          parseInt(form.quantity),
      });

      setSucesso('Consumo registrado! Será debitado do estoque ao fechar a gira.');
      setForm(f => ({ ...f, quantity: 1 }));
      onConsumoRegistrado();

      setTimeout(() => setSucesso(''), 5000);
    } catch (err) {
      const msg = handleApiError(err, 'Registrar consumo');
      setModal({
        aberto: true,
        titulo: 'Erro ao registrar consumo',
        mensagem: msg,
        tipoBotao: 'primary',
        onConfirmar: () => fecharModal(),
      });

    } finally {
      setLoading(false);
    }
  };

  // Aviso quando a gira não está aberta
  if (!giraAberta) {
    return (
      <div style={{
        background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.2)',
        borderRadius: '10px', padding: '1.25rem',
        display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
        color: '#94a3b8', fontSize: '0.85rem',
      }}>
        <i className="bi bi-lock" style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '1px' }}></i>
        <span>
          Consumos só podem ser registrados quando a gira está <strong>aberta</strong>.
        </span>
      </div>
    );
  }

  return (
    <div className="card-custom mb-4">
      <div className="card-header">
        <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
          ✦ O que você usou?
        </span>
      </div>
      <div style={{ padding: '1.25rem' }}>

        {erro    && <div className="alert-custom alert-danger-custom mb-3"><i className="bi bi-exclamation-circle me-2"></i>{erro}</div>}
        {sucesso && <div className="alert-custom alert-success-custom mb-3"><i className="bi bi-check-circle me-2"></i>{sucesso}</div>}

        <form onSubmit={handleSubmit}>

          {/* Origem do item */}
          <div className="mb-4">
            <label className="form-label-custom">De onde veio o item?</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {Object.entries(LABEL_ORIGEM).map(([value, info]) => {
                const ativo = form.source === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set('source', value)}
                    style={{
                      flex: 1, padding: '0.75rem', borderRadius: '10px', cursor: 'pointer',
                      textAlign: 'left',
                      background: ativo ? `${info.cor}18` : 'rgba(255,255,255,0.02)',
                      border: `1.5px solid ${ativo ? info.cor + '50' : 'var(--cor-borda)'}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: '1.1rem', marginBottom: '3px' }}>{info.emoji}</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: ativo ? info.cor : 'var(--cor-texto)' }}>
                      {info.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Item usado */}
          <div className="mb-3">
            <label className="form-label-custom">Qual item? *</label>
            <select
              className="form-control-custom"
              value={form.item_id}
              required
              onChange={e => set('item_id', e.target.value)}
              style={{ appearance: 'auto' }}
            >
              <option value="" style={{ background: 'var(--cor-fundo)', color: 'var(--cor-texto)' }}>
                — Selecione o item usado —
              </option>
              {itens.map(i => (
                <option key={i.id} value={i.id} style={{ background: 'var(--cor-fundo)', color: 'var(--cor-texto)' }}>
                  {i.name} (saldo: {i.current_stock ?? '?'})
                </option>
              ))}
            </select>
          </div>

          {/* Quantidade */}
          <div className="mb-4">
            <label className="form-label-custom">Quantidade *</label>
            <input
              type="number"
              min="1"
              className="form-control-custom"
              required
              value={form.quantity}
              onChange={e => set('quantity', e.target.value)}
              style={{ maxWidth: '160px' }}
            />
          </div>

          <button className="btn-gold" type="submit" disabled={loading}>
            {loading
              ? <><span className="spinner-border spinner-border-sm me-2"></span>Registrando...</>
              : <><i className="bi bi-plus-check me-2"></i>Registrar consumo</>
            }
          </button>
        </form>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// SEÇÃO: Lista de consumos da gira
// ══════════════════════════════════════════════════════════════════════════════
function ListaConsumos({ giraId, refreshTrigger, setModal, fecharModal }) {
  const [editingId, setEditingId] = useState(null);
  const [editingQuantity, setEditingQuantity] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [erro, setErro] = useState('');

  const [consumos, setConsumos] = useState([]);
  const [loading, setLoading]   = useState(false);

  
  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listarConsumos(giraId);
      setConsumos(res.data);
    } finally {
      setLoading(false);
    }
  }, [giraId]);

  useEffect(() => { carregar(); }, [carregar, refreshTrigger]);

  return (
    <div className="card-custom mb-4">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
          ✦ O que foi usado nesta gira
        </span>
        <button
          className="btn-outline-gold"
          onClick={carregar}
          disabled={loading}
          style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem' }}
        >
          {loading ? <span className="spinner-border spinner-border-sm"></span> : '↻ Atualizar'}
        </button>
      </div>

      {consumos.length === 0 && !loading && (
        <div className="empty-state">
          <i className="bi bi-bag-check d-block"></i>
          <p>Nenhum consumo registrado ainda nesta gira.</p>
        </div>
      )}

      {consumos.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table-custom">
            <thead>
              <tr>
                <th>Médium</th>
                <th>Item</th>
                <th style={{ textAlign: 'center' }}>Quantidade</th>
                <th>Origem</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {consumos.map(c => {
                const origem = LABEL_ORIGEM[c.source] || {};
                const status = LABEL_STATUS[c.status] || {};
                const consumoId = typeof c.id === 'object' ? c.id.id : c.id;
                return (
                  <tr key={consumoId}>
                    <td style={{ fontWeight: 600 }}>{c.medium_nome || '—'}</td>
                    <td>{c.item_name || '—'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>
                      {editingId === consumoId ? (
                        <input
                          type="number"
                          min="1"
                          value={editingQuantity}
                          onChange={e => setEditingQuantity(e.target.value)}
                          className="form-control-custom"
                          style={{
                            width: '80px',
                            textAlign: 'center',
                            padding: '0.2rem 0.4rem',
                            fontSize: '0.85rem'
                          }}
                        />
                      ) : (
                        c.quantity
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.78rem', color: origem.cor }}>
                        {origem.emoji} {origem.label}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 600,
                        color: status.cor, background: status.bg,
                        borderRadius: '20px', padding: '2px 8px',
                      }}>
                        {status.label}
                      </span>
                    </td>
                    <td style={{ display: 'flex', gap: '0.3rem' }}>
                      {c.status === 'PENDENTE' && (
                        editingId === consumoId ? (
                          <>
                            <button
                              className="btn-outline-gold"
                              title="Salvar"
                              style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                              onClick={async () => {
                                setSavingId(consumoId);
                                setErro('');
                                try {
                                  await editarConsumo(giraId, consumoId, {
                                    quantity: parseInt(editingQuantity),
                                  });

                                  setEditingId(null);
                                  setEditingQuantity('');
                                  carregar(); // recarrega lista
                                } catch (err) {
                                  const msg = handleApiError(err, 'Editar consumo');
                                  setModal({
                                    aberto: true,
                                    titulo: 'Erro ao editar consumo',
                                    mensagem: msg,
                                    tipoBotao: 'primary',
                                    onConfirmar: () => fecharModal(),
                                  });
                                } finally {
                                  setSavingId(null);
                                }
                              }}
                            >
                              {savingId === consumoId
                                ? <span className="spinner-border spinner-border-sm"></span>
                                : <i className="bi bi-floppy"></i>
                              }
                            </button>

                            <button className="btn-outline-gold"
                                    title="Cancelar"
                                    style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                              onClick={() => {
                                setEditingId(null);
                                setEditingQuantity('');
                              }}
                            >
                              <i className="bi bi-x-circle"></i>
                            </button>
                          </>
                        ) : (
                          <button className="btn-outline-gold"
                                  title="Editar consumo"
                                  style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                            onClick={() => {
                              setEditingId(consumoId);
                              setEditingQuantity(c.quantity);
                            }}
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SEÇÃO: Fechar a gira
// ══════════════════════════════════════════════════════════════════════════════
function SecaoFecharGira({ giraId, giraAberta, onFinalizado, setModal, fecharModal }) {
  const [loading, setLoading]     = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro]           = useState('');
  const [confirmando, setConfirmando] = useState(false);

  const handleFinalizar = async () => {
    setLoading(true);
    setErro('');
    setConfirmando(false);

    try {
      const res = await finalizarGira(giraId);
      setResultado(res.data);
      onFinalizado(); // atualiza GiraContext com status 'concluida'
    } catch (err) {
      const msg = handleApiError(err, 'Fechar gira');
      setModal({
        aberto: true,
        titulo: 'Erro ao fechar gira',
        mensagem: msg,
        tipoBotao: 'primary',
        onConfirmar: () => fecharModal(),
      });
    } finally {
      setLoading(false);
    }
  };

  // Gira já concluída — mostra apenas info
  if (!giraAberta) {
    return (
      <div className="card-custom mb-4">
        <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--cor-texto-suave)' }}>
          <i className="bi bi-check-circle-fill" style={{ fontSize: '2rem', color: '#a78bfa', marginBottom: '0.5rem', display: 'block' }}></i>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            Esta gira já foi encerrada. O estoque foi processado.
          </p>
          <Link href="/inventario" style={{ color: 'var(--cor-acento)', fontSize: '0.85rem', marginTop: '0.75rem', display: 'inline-block' }}>
            Ver estoque atualizado →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card-custom mb-4">
      <div className="card-header">
        <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: '#ef4444' }}>
          ✦ Encerrar a gira
        </span>
      </div>
      <div style={{ padding: '1.25rem' }}>

        {erro && <div className="alert-custom alert-danger-custom mb-3"><i className="bi bi-exclamation-circle me-2"></i>{erro}</div>}

        {/* Resultado após finalizar */}
        {resultado && (
          <div className="alert-custom alert-success-custom mb-3">
            <strong><i className="bi bi-check-circle me-2"></i>Gira encerrada com sucesso!</strong>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span>✓ {resultado.consumos_processados} consumo(s) debitados do estoque</span>
              <span>✓ {resultado.movimentacoes_geradas} movimentação(ões) registrada(s)</span>
              {resultado.mediums_sem_consumo?.length > 0 && (
                <span style={{ color: '#f59e0b' }}>
                  ⚠ Sem consumo registrado: {resultado.mediums_sem_consumo.join(', ')}
                </span>
              )}
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <Link href="/inventario" style={{ color: 'var(--cor-acento)', fontSize: '0.85rem' }}>
                Ver estoque atualizado →
              </Link>
            </div>
          </div>
        )}

        {/* Explicação da ação */}
        <div style={{
          background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem',
        }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--cor-texto-suave)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--cor-texto)' }}>O que acontece ao encerrar?</strong><br />
            Todos os consumos registrados serão debitados definitivamente do estoque.
            Essa ação não pode ser desfeita.
          </p>
        </div>

        {/* Confirmação em 2 etapas */}
        {!confirmando ? (
          <button
            onClick={() => setConfirmando(true)}
            disabled={loading || !!resultado}
            style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)',
              color: '#ef4444', borderRadius: '8px', padding: '0.65rem 1.75rem',
              cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
              opacity: resultado ? 0.4 : 1,
            }}
          >
            <i className="bi bi-lock me-2"></i>Encerrar gira
          </button>
        ) : (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '10px', padding: '1rem',
          }}>
            <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9rem' }}>
              Tem certeza? Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setConfirmando(false)}
                className="btn-outline-gold"
                style={{ fontSize: '0.85rem' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleFinalizar}
                disabled={loading}
                style={{
                  background: '#ef4444', color: '#fff', border: 'none',
                  borderRadius: '8px', padding: '0.5rem 1.5rem',
                  cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
                }}
              >
                {loading
                  ? <><span className="spinner-border spinner-border-sm me-2"></span>Encerrando...</>
                  : 'Sim, encerrar gira'
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function ConsumoGiraPage() {
  const router                                = useRouter();
  const { id }                                = router.query;
  const { giraAtual, setGiraAtual, atualizarStatusGira } = useGiraAtual();

  const [gira, setGira]       = useState(null);
  const [itens, setItens]     = useState([]);
  const [loading, setLoading] = useState(true);
  // Trigger para recarregar a lista de consumos após registrar um novo
  const [consumoRefresh, setConsumoRefresh] = useState(0);
  const [modal, setModal] = useState({
  aberto: false,
  titulo: '',
  mensagem: '',
  tipoBotao: 'primary',
  onConfirmar: null,
});

  // ── Carregamento inicial ─────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    Promise.all([getGira(id), listarItens()])
      .then(([giraRes, itensRes]) => {
        const g = giraRes.data;
        setGira(g);
        setItens(itensRes.data);

        // Sincroniza GiraContext com dados frescos do servidor
        if (giraAtual?.id === id) {
          setGiraAtual({ ...giraAtual, status: g.status, titulo: g.titulo });
        }
      })
      .catch(() => router.push('/giras'))
      .finally(() => setLoading(false));
  // Intencionalmente sem giraAtual nas deps para evitar loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  const fecharModal = () => {
    setModal(m => ({ ...m, aberto: false, onConfirmar: null }));
  };
  /**
   * Chamado após finalizar a gira com sucesso.
   * Atualiza o status no GiraContext sem recarregar a página — evita UI stale.
   */
  const handleFinalizado = useCallback(() => {
    // Atualiza o estado local desta página
    setGira(g => g ? { ...g, status: 'concluida' } : g);
    // Atualiza o GiraContext compartilhado (corrige o bug de UI)
    atualizarStatusGira('concluida');
    // Recarrega lista de consumos para mostrar status PROCESSADO
    setConsumoRefresh(n => n + 1);
  }, [atualizarStatusGira]);

  const handleConsumoRegistrado = () => {
    setConsumoRefresh(n => n + 1);
    // Recarrega saldos dos itens para mostrar valores atualizados
    listarItens().then(res => setItens(res.data)).catch(() => {});
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading || !gira) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner-gold"></div>
      </div>
    );
  }

  const giraAberta = gira.status === 'aberta';

  return (
    <>
      <Head><title>Consumo — {gira.titulo} | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">

          {/* ── Topbar ── */}
          <div className="topbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>
                {gira.titulo}
              </h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>
                <i className="bi bi-calendar3 me-1"></i>
                {formatarData(gira.data)} · Consumo da gira
              </small>
            </div>
            <Link
              href="/giras"
              style={{ color: 'var(--cor-texto-suave)', textDecoration: 'none', fontSize: '0.9rem' }}
            >
              ← Voltar para giras
            </Link>
          </div>

          <div className="page-content">

            {/* Banner com status da gira */}
            <BannerStatusGira gira={gira} />

            {/* Formulário de registro de consumo */}
            <FormRegistrarConsumo
              giraId={id}
              itens={itens}
              giraAberta={giraAberta}
              onConsumoRegistrado={handleConsumoRegistrado}
              setModal={setModal}
              fecharModal={fecharModal}
            />

            {/* Lista de consumos */}
            <ListaConsumos 
            giraId={id} 
            refreshTrigger={consumoRefresh} 
            setModal={setModal}
            fecharModal={fecharModal}
            />

            {/* Encerrar gira */}
            <SecaoFecharGira
              giraId={id}
              giraAberta={giraAberta}
              onFinalizado={handleFinalizado}
              setModal={setModal}
              fecharModal={fecharModal}
            />

          </div>
        </div>
      </div>
      <BottomNav />

      <ConfirmModal
        aberto={modal.aberto}
        titulo={modal.titulo}
        mensagem={modal.mensagem}
        tipoBotao={modal.tipoBotao || 'perigo'}
        labelConfirmar={modal.labelConfirmar || 'Confirmar'}
        onConfirmar={modal.onConfirmar}
        onCancelar={fecharModal}
      />
    </>
  );
}