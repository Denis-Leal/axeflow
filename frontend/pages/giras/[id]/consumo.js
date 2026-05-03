/**
 * pages/giras/[id]/consumo.js — AxeFlow
 *
 * Tela OPERACIONAL de consumo de uma gira específica.
 *
 * Responsabilidades:
 *   - Registrar o que cada médium usou durante a gira
 *   - Listar consumos já registrados (table desktop / card mobile)
 *   - Finalizar a gira (debita itens do estoque de forma definitiva)
 */

import Head from 'next/head';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  listarItens, listarConsumos, registrarConsumo, registrarConsumoAdmin,
  editarConsumo, finalizarGira, getGira, getMe, listMembros,
} from '../../../services/api';
import { handleApiError } from '../../../services/errorHandler';
import { useGiraAtual } from '../../../contexts/GiraContext';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import Sidebar from '../../../components/Sidebar';
import BottomNav from '../../../components/BottomNav';
import ConfirmModal from '../../../components/ConfirmModal';
import ConsumoCard from '../../../components/consumo/ConsumoCard';
import {
  Button, Card, CardHeader, CardBody,
  Badge, EmptyState, Spinner, FormField,
} from '../../../components/ui';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatarData(dataStr) {
  if (!dataStr) return '';
  const [y, m, d] = dataStr.split('-');
  return `${d}/${m}/${y}`;
}

const getLabelOrigem = (isAdmin) => ({
  TERREIRO: { label: 'Item do terreiro', emoji: '🏛️', cor: '#60a5fa' },
  MEDIUM:   { label: isAdmin ? 'Um médium' : 'Meu item (médium)', emoji: '🙋', cor: '#a78bfa' },
});

const LABEL_STATUS = {
  PENDENTE:   { label: 'Aguardando fechamento', cor: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  PROCESSADO: { label: 'Registrado no estoque', cor: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  CANCELADO:  { label: 'Cancelado',             cor: '#94a3b8', bg: 'rgba(148,163,184,0.1)'  },
};

// ── Banner de status da gira ───────────────────────────────────────────────────

function BannerStatusGira({ gira }) {
  if (!gira) return null;

  const configs = {
    aberta:   { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.3)', text: '#10b981', emoji: '🟢', msg: 'Gira aberta — você pode registrar consumos.' },
    fechada:  { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.3)',  text: '#ef4444', emoji: '🔴', msg: 'Gira fechada — novos consumos não são permitidos.' },
    concluida:{ bg: 'rgba(107,33,168,0.1)',  border: 'rgba(107,33,168,0.3)', text: '#a78bfa', emoji: '✅', msg: 'Gira concluída — o estoque já foi processado.' },
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

function FormRegistrarConsumo({ giraId, itens, giraAberta, onConsumoRegistrado, setModal, fecharModal, isAdmin, membros, onSelectMedium, me, source, onChangeSource }) {
  // const [form, setForm] = useState({ item_id: '', source: 'TERREIRO', quantity: 1, medium_id: '' });
  const [form, setForm] = useState({ item_id: '', quantity: 1, medium_id: '' });
  const [loading, setLoading] = useState(false);
  const [erro, setErro]       = useState('');
  const [sucesso, setSucesso] = useState('');
  const LABEL_ORIGEM = getLabelOrigem(isAdmin);

  const set = (k, v) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === 'source') {
        onChangeSource(v);

        if (v === 'TERREIRO') {
          next.medium_id = '';
          onSelectMedium(null);
        }

        if (v === 'MEDIUM') {
          if (!isAdmin && me?.id) {
            next.medium_id = me.id;
            onSelectMedium(me.id);
          }
        }
      }
      if (k === 'medium_id' && v) {
        // next.source = 'MEDIUM';
        onSelectMedium(v);
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isAdmin && !form.medium_id) { setErro('Selecione o médium para registrar o consumo.'); return; }

    setLoading(true);
    setErro('');
    setSucesso('');
    try {
      const payload = {
        inventory_item_id: form.item_id,
        source:            source,
        quantity:          parseInt(form.quantity),
      };

      if (isAdmin && form.medium_id) {
        await registrarConsumoAdmin(giraId, payload, form.medium_id);
      } else {
        await registrarConsumo(giraId, payload);
      }

      setSucesso('Consumo registrado! Será debitado do estoque ao fechar a gira.');
      setForm(f => ({ ...f, quantity: 1, medium_id: '' }));
      onConsumoRegistrado();
      setTimeout(() => setSucesso(''), 5000);
    } catch (err) {
      const msg = handleApiError(err, 'Registrar consumo');
      setModal({ aberto: true, titulo: 'Erro ao registrar consumo', mensagem: msg, tipoBotao: 'primary', onConfirmar: () => fecharModal() });
    } finally {
      setLoading(false);
    }
  };

  if (!giraAberta) {
    return (
      <Card style={{ marginBottom: '1.5rem' }}>
        <CardBody>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', color: '#94a3b8', fontSize: '0.85rem' }}>
            <i className="bi bi-lock" style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '1px' }} />
            <span>Consumos só podem ser registrados quando a gira está <strong>aberta</strong>.</span>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: '1.5rem' }}>
      <CardHeader>
        <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
          {isAdmin ? '✦ Registrar consumo de médium' : '✦ O que você usou?'}
        </span>
      </CardHeader>
      <CardBody>
        {erro    && <div className="alert-custom alert-danger-custom mb-3"><i className="bi bi-exclamation-circle me-2" />{erro}</div>}
        {sucesso && <div className="alert-custom alert-success-custom mb-3"><i className="bi bi-check-circle me-2" />{sucesso}</div>}

        <form onSubmit={handleSubmit}>

          {/* Origem do item */}
          <FormField label="De onde veio o item?">
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {Object.entries(LABEL_ORIGEM).map(([value, info]) => {
                const ativo = source === value;
                return (
                  <button key={value} type="button" onClick={() => set('source', value)} style={{
                    flex: 1, padding: '0.75rem', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                    background: ativo ? `${info.cor}18` : 'rgba(255,255,255,0.02)',
                    border: `1.5px solid ${ativo ? info.cor + '50' : 'var(--cor-borda)'}`,
                    transition: 'all 0.15s',
                  }}>
                    <div style={{ fontSize: '1.1rem', marginBottom: '3px' }}>{info.emoji}</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: ativo ? info.cor : 'var(--cor-texto)' }}>
                      {info.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </FormField>

          {/* Seletor de médium — admin + source MEDIUM */}
          {isAdmin && (
            <FormField label="Para qual médium?" required>
              <select className="form-control-custom" value={form.medium_id} required
                onChange={e => { set('medium_id', e.target.value); onSelectMedium(e.target.value); }}
                style={{ appearance: 'auto' }}>
                <option value="" style={{ background: 'var(--cor-fundo)', color: 'var(--cor-texto)' }}>— Selecione o médium —</option>
                {membros.map(m => (
                  <option key={m.id} value={m.id} style={{ background: 'var(--cor-fundo)', color: 'var(--cor-texto)' }}>{m.nome}</option>
                ))}
              </select>
            </FormField>
          )}

          {/* Item usado */}
          <FormField label="Qual item?" required>
            <select className="form-control-custom" value={form.item_id} required
              onChange={e => set('item_id', e.target.value)} style={{ appearance: 'auto' }}>
              <option value="" style={{ background: 'var(--cor-fundo)', color: 'var(--cor-texto)' }}>— Selecione o item usado —</option>
              {itens.map(i => (
                <option key={i.id} value={i.id} style={{ background: 'var(--cor-fundo)', color: 'var(--cor-texto)' }}>
                  {i.name} (saldo: {i.current_stock ?? '?'})
                </option>
              ))}
            </select>
          </FormField>

          {/* Quantidade */}
          <FormField label="Quantidade" required>
            <input type="number" min="1" className="form-control-custom" required
              value={form.quantity} onChange={e => set('quantity', e.target.value)}
              style={{ maxWidth: '160px' }} />
          </FormField>

          <Button type="submit" variant="primary" loading={loading} disabled={loading}>
            <i className="bi bi-plus-check" /> Registrar consumo
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SEÇÃO: Lista de consumos da gira
// ══════════════════════════════════════════════════════════════════════════════

function ListaConsumos({ giraId, refreshTrigger, setModal, fecharModal, isAdmin }) {
  const [editingId, setEditingId]         = useState(null);
  const [editingQuantity, setEditingQuantity] = useState('');
  const [savingId, setSavingId]           = useState(null);
  const [consumos, setConsumos]           = useState([]);
  const [loading, setLoading]             = useState(false);
  const isMobile                          = useIsMobile();
  const LABEL_ORIGEM                      = getLabelOrigem(isAdmin);

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

  const handleSalvarEdicao = async (consumoId) => {
    setSavingId(consumoId);
    try {
      await editarConsumo(giraId, consumoId, { quantity: parseInt(editingQuantity) });
      setEditingId(null);
      setEditingQuantity('');
      carregar();
    } catch (err) {
      const msg = handleApiError(err, 'Editar consumo');
      setModal({ aberto: true, titulo: 'Erro ao editar consumo', mensagem: msg, tipoBotao: 'primary', onConfirmar: () => fecharModal() });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card style={{ marginBottom: '1.5rem' }}>
      <CardHeader style={{ justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
          ✦ O que foi usado nesta gira
        </span>
        <Button variant="outline" size="sm" onClick={carregar} disabled={loading} loading={loading}>
          ↻ Atualizar
        </Button>
      </CardHeader>

      {loading && <CardBody><div style={{ textAlign: 'center', padding: '1rem' }}><Spinner /></div></CardBody>}

      {!loading && consumos.length === 0 && (
        <EmptyState icon="bag-check" title="Nenhum consumo registrado ainda nesta gira." />
      )}

      {!loading && consumos.length > 0 && (
        isMobile ? (
          <CardBody>
            {consumos.map(c => {
              const consumoId = typeof c.id === 'object' ? c.id.id : c.id;
              return (
                <ConsumoCard
                  key={consumoId}
                  consumo={c}
                  giraId={giraId}
                  onSaved={carregar}
                  setModal={setModal}
                  fecharModal={fecharModal}
                />
              );
            })}
          </CardBody>
        ) : (
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
                  const origem    = LABEL_ORIGEM[c.source] || {};
                  const status    = LABEL_STATUS[c.status] || {};
                  const consumoId = typeof c.id === 'object' ? c.id.id : c.id;
                  return (
                    <tr key={consumoId}>
                      <td style={{ fontWeight: 600 }}>{c.medium_nome || '—'}</td>
                      <td>{c.item_name || '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>
                        {editingId === consumoId ? (
                          <input type="number" min="1" value={editingQuantity}
                            onChange={e => setEditingQuantity(e.target.value)}
                            className="form-control-custom"
                            style={{ width: '80px', textAlign: 'center', padding: '0.2rem 0.4rem', fontSize: '0.85rem' }} />
                        ) : c.quantity}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.78rem', color: origem.cor }}>
                          {origem.emoji} {origem.label}
                        </span>
                      </td>
                      <td>
                        <Badge bg={status.bg} color={status.cor} style={{ border: `1px solid ${status.cor}30` }}>
                          {status.label}
                        </Badge>
                      </td>
                      <td>
                        {c.status === 'PENDENTE' && (
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            {editingId === consumoId ? (
                              <>
                                <Button variant="primary" size="sm" title="Salvar"
                                  loading={savingId === consumoId}
                                  disabled={savingId === consumoId}
                                  onClick={() => handleSalvarEdicao(consumoId)}>
                                  <i className="bi bi-floppy" />
                                </Button>
                                <Button variant="outline" size="sm" title="Cancelar"
                                  onClick={() => { setEditingId(null); setEditingQuantity(''); }}>
                                  <i className="bi bi-x-circle" />
                                </Button>
                              </>
                            ) : (
                              <Button variant="outline" size="sm" title="Editar consumo"
                                onClick={() => { setEditingId(consumoId); setEditingQuantity(c.quantity); }}>
                                <i className="bi bi-pencil" />
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SEÇÃO: Fechar a gira
// ══════════════════════════════════════════════════════════════════════════════

function SecaoFecharGira({ giraId, giraAberta, onFinalizado, setModal, fecharModal }) {
  const [loading, setLoading]         = useState(false);
  const [resultado, setResultado]     = useState(null);
  const [confirmando, setConfirmando] = useState(false);

  const handleFinalizar = async () => {
    setLoading(true);
    setConfirmando(false);
    try {
      const res = await finalizarGira(giraId);
      setResultado(res.data);
      onFinalizado();
    } catch (err) {
      const msg = handleApiError(err, 'Fechar gira');
      setModal({ aberto: true, titulo: 'Erro ao fechar gira', mensagem: msg, tipoBotao: 'primary', onConfirmar: () => fecharModal() });
    } finally {
      setLoading(false);
    }
  };

  if (!giraAberta) {
    return (
      <Card style={{ marginBottom: '1.5rem' }}>
        <CardBody style={{ textAlign: 'center' }}>
          <i className="bi bi-check-circle-fill" style={{ fontSize: '2rem', color: '#a78bfa', marginBottom: '0.5rem', display: 'block' }} />
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--cor-texto-suave)' }}>
            Esta gira já foi encerrada. O estoque foi processado.
          </p>
          <Button variant="outline" size="sm" href="/inventario">
            Ver estoque atualizado →
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: '1.5rem', borderColor: resultado ? undefined : 'rgba(239,68,68,0.2)' }}>
      <CardHeader style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
        <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: '#ef4444' }}>
          ✦ Encerrar a gira
        </span>
      </CardHeader>
      <CardBody>

        {resultado && (
          <div className="alert-custom alert-success-custom mb-3">
            <strong><i className="bi bi-check-circle me-2" />Gira encerrada com sucesso!</strong>
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
              <Button variant="outline" size="sm" href="/inventario">
                Ver estoque atualizado →
              </Button>
            </div>
          </div>
        )}

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

        {!confirmando ? (
          <Button variant="danger" onClick={() => setConfirmando(true)} disabled={loading || !!resultado}>
            <i className="bi bi-lock" /> Encerrar gira
          </Button>
        ) : (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '10px', padding: '1rem',
          }}>
            <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9rem' }}>
              Tem certeza? Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="outline" size="sm" onClick={() => setConfirmando(false)}>
                Cancelar
              </Button>
              <button onClick={handleFinalizar} disabled={loading} style={{
                background: '#ef4444', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '0.5rem 1.5rem',
                cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.85rem',
                opacity: loading ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              }}>
                {loading && <span style={{ width: '0.8rem', height: '0.8rem', border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />}
                Sim, encerrar gira
              </button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

export default function ConsumoGiraPage() {
  const router                                          = useRouter();
  const { id }                                          = router.query;
  const { giraAtual, setGiraAtual, atualizarStatusGira } = useGiraAtual();
  const [source, setSource] = useState('TERREIRO');
  const [gira, setGira]                       = useState(null);
  const [me, setMe]                           = useState(null);
  const [itens, setItens]                     = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [isAdmin, setIsAdmin]                 = useState(false);
  const [membros, setMembros]                 = useState([]);
  const [consumoRefresh, setConsumoRefresh]   = useState(0);
  const [selectedMediumId, setSelectedMediumId] = useState(null);
  const [modal, setModal] = useState({ aberto: false, titulo: '', mensagem: '', tipoBotao: 'primary', onConfirmar: null });

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    Promise.all([getGira(id), getMe(), listMembros()])
      .then(([giraRes, meRes, membrosRes]) => {
        const g = giraRes.data;
        setGira(g);
        setIsAdmin(meRes.data.role === 'admin');
        setMembros(membrosRes.data);
        setMe(meRes.data);
        if (giraAtual?.id === id) {
          setGiraAtual({ ...giraAtual, status: g.status, titulo: g.titulo });
        }
      })
      .catch(() => router.push('/giras'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

useEffect(() => {
  if (!id) return;

  const fetchItens = async () => {
    try {
      if (isAdmin && source === 'MEDIUM') {
        if (!selectedMediumId) {
          setItens([]);
          return;
        }

        const res = await listarItens(selectedMediumId);
        setItens(res.data);
        return;
      }

      const res = await listarItens();
      setItens(res.data);

    } catch (err) {
      console.error('Erro ao carregar itens:', err);
    }
  };

  fetchItens();

}, [id, selectedMediumId, source, isAdmin]);

  const fecharModal = () => setModal(m => ({ ...m, aberto: false, onConfirmar: null }));

  const handleFinalizado = useCallback(() => {
    setGira(g => g ? { ...g, status: 'concluida' } : g);
    atualizarStatusGira('concluida');
    setConsumoRefresh(n => n + 1);
  }, [atualizarStatusGira]);

  const handleConsumoRegistrado = () => {
    setConsumoRefresh(n => n + 1);
    listarItens().then(res => setItens(res.data)).catch(() => {});
  };

  if (loading || !gira) return <Spinner center />;

  const giraAberta = gira.status === 'aberta';

  return (
    <>
      <Head><title>Consumo — {gira.titulo} | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">

          <div className="topbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>{gira.titulo}</h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>
                <i className="bi bi-calendar3 me-1" />{formatarData(gira.data)} · Consumo da gira
              </small>
            </div>
            <Button variant="ghost" size="sm" href="/giras">
              ← Voltar para giras
            </Button>
          </div>

          <div className="page-content">
            <BannerStatusGira gira={gira} />

            <FormRegistrarConsumo
              giraId={id} itens={itens} giraAberta={giraAberta}
              onConsumoRegistrado={handleConsumoRegistrado}
              setModal={setModal} fecharModal={fecharModal}
              isAdmin={isAdmin} membros={membros}
              onSelectMedium={setSelectedMediumId} me={me}
              source={source}
              onChangeSource={setSource}
            />

            <ListaConsumos
              giraId={id} refreshTrigger={consumoRefresh}
              setModal={setModal} fecharModal={fecharModal}
              isAdmin={isAdmin}
            />

            <SecaoFecharGira
              giraId={id} giraAberta={giraAberta}
              onFinalizado={handleFinalizado}
              setModal={setModal} fecharModal={fecharModal}
            />
          </div>
        </div>
      </div>

      <BottomNav />

      <ConfirmModal
        aberto={modal.aberto} titulo={modal.titulo} mensagem={modal.mensagem}
        tipoBotao={modal.tipoBotao || 'perigo'} labelConfirmar={modal.labelConfirmar || 'Confirmar'}
        onConfirmar={modal.onConfirmar} onCancelar={fecharModal}
      />
    </>
  );
}