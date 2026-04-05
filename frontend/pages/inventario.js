/**
 * pages/inventario.js — AxeFlow
 *
 * Frontend funcional do sistema de inventário.
 *
 * Seções:
 *   1. Config (gira_id para testes)
 *   2. Listagem de itens com saldo e alertas
 *   3. Criar item (terreiro ou médium)
 *   4. Movimentação manual (IN / OUT / ADJUSTMENT)
 *   5. Registrar consumo por gira
 *   6. Listar consumos da gira
 *   7. Finalizar gira + resultado
 *
 * Padrão do projeto:
 *   - Importa de '../services/api' (mesmo arquivo de todo o projeto)
 *   - Usa classes CSS de globals.css (card-custom, form-control-custom etc.)
 *   - Usa Sidebar + BottomNav
 *   - Usa handleApiError do errorHandler
 */

import Head from 'next/head';
import { useState, useEffect, useCallback } from 'react';
import {
  listarItens,
  criarItemTerreiro,
  criarItemMedium,
  getHistoricoItem,
  registrarMovimentacao,
  listarConsumos,
  registrarConsumo,
  finalizarGira,
} from '../services/api';
import { handleApiError } from '../services/errorHandler';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';

// ── Categorias válidas de item ─────────────────────────────────────────────────
const CATEGORIAS = ['bebida', 'charuto', 'cigarro', 'cigarro_palha', 'pemba', 'vela', 'outros'];

// ── Badge de saldo com cor contextual ─────────────────────────────────────────
function BadgeEstoque({ saldo, threshold }) {
  if (saldo === null || saldo === undefined) {
    return <span className="badge-status badge-cancelado">—</span>;
  }
  const baixo = threshold > 0 && saldo <= threshold;
  if (baixo)    return <span className="badge-status badge-faltou">{saldo} ⚠</span>;
  if (saldo === 0) return <span className="badge-status badge-cancelado">0</span>;
  return <span className="badge-status badge-compareceu">{saldo}</span>;
}

// ══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 1 — CONFIGURAÇÃO (gira_id)
// ══════════════════════════════════════════════════════════════════════════════
function SecaoConfig({ giraId, setGiraId }) {
  const [input, setInput] = useState(giraId);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => { setInput(giraId); }, [giraId]);

  const salvar = () => {
    const val = input.trim();
    setGiraId(val);
    localStorage.setItem('test_gira_id', val);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  };

  return (
    <div className="card-custom mb-4">
      <div className="card-header">
        <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
          ⚙️ Configuração
        </span>
      </div>
      <div className="p-3">
        <div className="row g-3">
          <div className="col-md-9">
            <label className="form-label-custom">Gira ID (UUID)</label>
            <input
              className="form-control-custom"
              style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              placeholder="Cole o UUID da gira para consumos e finalização"
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <small style={{ color: 'var(--cor-texto-suave)', fontSize: '0.75rem' }}>
              O token JWT é lido automaticamente do localStorage (faça login normalmente).
            </small>
          </div>
          <div className="col-md-3 d-flex align-items-end">
            <button className="btn-gold w-100" onClick={salvar}>
              {salvo ? '✓ Salvo' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 2 — LISTA DE ITENS
// ══════════════════════════════════════════════════════════════════════════════
function SecaoListaItens({ itens, loading, onRecarregar, onVerHistorico, onMovimentar }) {
  return (
    <div className="card-custom mb-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
          ✦ Itens de Estoque
        </span>
        <button
          className="btn-outline-gold"
          onClick={onRecarregar}
          disabled={loading}
          style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem' }}
        >
          {loading ? 'Carregando...' : '↻ Atualizar'}
        </button>
      </div>

      {itens.length === 0 && !loading && (
        <div className="empty-state">
          <i className="bi bi-box-seam d-block"></i>
          <p>Nenhum item cadastrado. Crie um abaixo.</p>
        </div>
      )}

      {itens.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table-custom">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Categoria</th>
                <th>Estoque</th>
                <th>Threshold</th>
                <th>Alerta</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {itens.map(item => (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong></td>
                  <td>
                    <span className="badge-status badge-confirmado">{item.category}</span>
                  </td>
                  <td>
                    <BadgeEstoque saldo={item.current_stock} threshold={item.minimum_threshold} />
                  </td>
                  <td style={{ color: 'var(--cor-texto-suave)' }}>{item.minimum_threshold}</td>
                  <td>
                    {item.low_stock
                      ? <span className="badge-status badge-faltou">⚠ BAIXO</span>
                      : <span style={{ color: 'var(--cor-texto-suave)' }}>—</span>
                    }
                  </td>
                  <td>
                    <div className="d-flex gap-1">
                      <button
                        className="btn-outline-gold"
                        onClick={() => onVerHistorico(item)}
                        style={{ fontSize: '0.78rem', padding: '0.2rem 0.6rem' }}
                      >
                        Histórico
                      </button>
                      <button
                        className="btn-gold"
                        onClick={() => onMovimentar(item)}
                        style={{ fontSize: '0.78rem', padding: '0.2rem 0.6rem' }}
                      >
                        + Mover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 3 — CRIAR ITEM
// ══════════════════════════════════════════════════════════════════════════════
function SecaoCriarItem({ onCriado }) {
  const [form, setForm] = useState({
    name: '', category: 'vela', minimum_threshold: 0, unit_cost: '', owner: 'terreiro',
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk]     = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    setOk('');
    try {
      const payload = {
        name:               form.name.trim(),
        category:           form.category,
        minimum_threshold:  parseInt(form.minimum_threshold) || 0,
        unit_cost:          form.unit_cost ? parseFloat(form.unit_cost) : null,
      };
      const fn  = form.owner === 'terreiro' ? criarItemTerreiro : criarItemMedium;
      const res = await fn(payload);
      setOk(`Item "${payload.name}" criado! ID: ${res.data.id}`);
      setForm({ name: '', category: 'vela', minimum_threshold: 0, unit_cost: '', owner: 'terreiro' });
      onCriado();
    } catch (err) {
      setErro(handleApiError(err, 'Criar item'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-custom mb-4">
      <div className="card-header">
        <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
          ✦ Criar Item de Estoque
        </span>
      </div>
      <div className="p-3">
        {erro && <div className="alert-custom alert-danger-custom mb-3"><i className="bi bi-exclamation-circle me-2"></i>{erro}</div>}
        {ok  && <div className="alert-custom alert-success-custom mb-3"><i className="bi bi-check-circle me-2"></i>{ok}</div>}

        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label-custom">Nome *</label>
              <input
                className="form-control-custom"
                value={form.name}
                placeholder="Ex: Vela branca"
                onChange={e => set('name', e.target.value)}
                required
              />
            </div>
            <div className="col-md-2">
              <label className="form-label-custom">Categoria *</label>
              <select
                className="form-control-custom"
                value={form.category}
                onChange={e => set('category', e.target.value)}
                style={{ appearance: 'auto' }}
              >
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label-custom">Threshold mínimo</label>
              <input
                type="number" min="0" className="form-control-custom"
                value={form.minimum_threshold}
                onChange={e => set('minimum_threshold', e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label-custom">Custo (R$)</label>
              <input
                type="number" step="0.01" min="0" className="form-control-custom"
                value={form.unit_cost} placeholder="0.00"
                onChange={e => set('unit_cost', e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label-custom">Dono</label>
              <select
                className="form-control-custom"
                value={form.owner}
                onChange={e => set('owner', e.target.value)}
                style={{ appearance: 'auto' }}
              >
                <option value="terreiro">Terreiro</option>
                <option value="medium">Médium (eu)</option>
              </select>
            </div>
          </div>

          <button className="btn-gold mt-3" type="submit" disabled={loading}>
            {loading
              ? <span className="spinner-border spinner-border-sm me-2"></span>
              : <i className="bi bi-plus-lg me-2"></i>
            }
            Criar item
          </button>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 4 — MOVIMENTAÇÃO MANUAL
// ══════════════════════════════════════════════════════════════════════════════
function SecaoMovimentacao({ itemSelecionado, itens, onMovimentado }) {
  const [form, setForm] = useState({ item_id: '', type: 'IN', quantity: 1, notes: '' });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk]     = useState('');

  // Quando o usuário clica "+ Mover" na listagem, pré-seleciona o item
  useEffect(() => {
    if (itemSelecionado) {
      setForm(f => ({ ...f, item_id: itemSelecionado.id }));
      document.getElementById('sec-movimentacao')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [itemSelecionado]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.item_id) { setErro('Selecione um item.'); return; }
    setLoading(true);
    setErro('');
    setOk('');
    try {
      await registrarMovimentacao(form.item_id, {
        type:     form.type,
        quantity: parseInt(form.quantity),
        notes:    form.notes.trim() || null,
      });
      setOk(`${form.type} de ${form.quantity} unidade(s) registrado!`);
      setForm(f => ({ ...f, quantity: 1, notes: '' }));
      onMovimentado();
    } catch (err) {
      setErro(handleApiError(err, 'Movimentação'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="sec-movimentacao" className="card-custom mb-4">
      <div className="card-header">
        <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
          ✦ Movimentação Manual de Estoque
        </span>
      </div>
      <div className="p-3">
        {erro && <div className="alert-custom alert-danger-custom mb-3"><i className="bi bi-exclamation-circle me-2"></i>{erro}</div>}
        {ok  && <div className="alert-custom alert-success-custom mb-3"><i className="bi bi-check-circle me-2"></i>{ok}</div>}

        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label-custom">Item *</label>
              <select
                className="form-control-custom"
                value={form.item_id}
                onChange={e => set('item_id', e.target.value)}
                required
                style={{ appearance: 'auto' }}
              >
                <option value="">— selecione —</option>
                {itens.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.category}) — estoque: {i.current_stock ?? '?'}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label-custom">Tipo *</label>
              <select
                className="form-control-custom"
                value={form.type}
                onChange={e => set('type', e.target.value)}
                style={{ appearance: 'auto' }}
              >
                <option value="IN">IN — Entrada</option>
                <option value="OUT">OUT — Saída</option>
                <option value="ADJUSTMENT">ADJUSTMENT — Ajuste</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label-custom">Quantidade *</label>
              <input
                type="number" min="1" className="form-control-custom" required
                value={form.quantity} onChange={e => set('quantity', e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label-custom">Observação</label>
              <input
                className="form-control-custom"
                value={form.notes}
                placeholder="Ex: Compra mercadão"
                onChange={e => set('notes', e.target.value)}
              />
            </div>
          </div>

          <button className="btn-gold mt-3" type="submit" disabled={loading}>
            {loading
              ? <span className="spinner-border spinner-border-sm me-2"></span>
              : <i className="bi bi-arrow-left-right me-2"></i>
            }
            Registrar movimentação
          </button>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 5 — REGISTRAR CONSUMO NA GIRA
// ══════════════════════════════════════════════════════════════════════════════
function SecaoConsumoGira({ giraId, itens, onConsumoRegistrado }) {
  const [form, setForm] = useState({ item_id: '', source: 'TERREIRO', quantity: 1 });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk]     = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!giraId) { setErro('Configure o Gira ID na seção ⚙️ acima.'); return; }
    setLoading(true);
    setErro('');
    setOk('');
    try {
      await registrarConsumo(giraId, {
        inventory_item_id: form.item_id,
        source:            form.source,
        quantity:          parseInt(form.quantity),
      });
      setOk('Consumo registrado (PENDENTE). Será debitado do estoque ao finalizar a gira.');
      setForm(f => ({ ...f, quantity: 1 }));
      onConsumoRegistrado();
    } catch (err) {
      setErro(handleApiError(err, 'Registrar consumo'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-custom mb-4">
      <div className="card-header">
        <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
          ✦ Registrar Consumo na Gira
        </span>
        {giraId && (
          <span style={{ marginLeft: '0.75rem', fontSize: '0.72rem', color: 'var(--cor-texto-suave)', fontFamily: 'monospace' }}>
            {giraId.slice(0, 8)}...
          </span>
        )}
      </div>
      <div className="p-3">
        {!giraId && (
          <div className="alert-custom alert-danger-custom mb-3">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Configure o Gira ID na seção ⚙️ acima.
          </div>
        )}
        {erro && <div className="alert-custom alert-danger-custom mb-3"><i className="bi bi-exclamation-circle me-2"></i>{erro}</div>}
        {ok  && <div className="alert-custom alert-success-custom mb-3"><i className="bi bi-check-circle me-2"></i>{ok}</div>}

        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-md-5">
              <label className="form-label-custom">Item *</label>
              <select
                className="form-control-custom"
                value={form.item_id}
                onChange={e => set('item_id', e.target.value)}
                required
                style={{ appearance: 'auto' }}
              >
                <option value="">— selecione —</option>
                {itens.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.name} — estoque: {i.current_stock ?? '?'}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label-custom">Source *</label>
              <select
                className="form-control-custom"
                value={form.source}
                onChange={e => set('source', e.target.value)}
                style={{ appearance: 'auto' }}
              >
                <option value="TERREIRO">TERREIRO</option>
                <option value="MEDIUM">MEDIUM (eu)</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label-custom">Quantidade *</label>
              <input
                type="number" min="1" className="form-control-custom" required
                value={form.quantity} onChange={e => set('quantity', e.target.value)}
              />
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button className="btn-gold w-100" type="submit" disabled={loading || !giraId}>
                {loading
                  ? <span className="spinner-border spinner-border-sm"></span>
                  : 'Registrar'
                }
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 6 — LISTA DE CONSUMOS DA GIRA
// ══════════════════════════════════════════════════════════════════════════════
function SecaoListaConsumos({ giraId, refreshTrigger }) {
  const [consumos, setConsumos] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [erro, setErro]         = useState('');

  const carregar = useCallback(async () => {
    if (!giraId) return;
    setLoading(true);
    setErro('');
    try {
      const res = await listarConsumos(giraId);
      setConsumos(res.data);
    } catch (err) {
      setErro(handleApiError(err, 'Listar consumos'));
    } finally {
      setLoading(false);
    }
  }, [giraId]);

  // Recarrega ao trocar de gira ou ao registrar novo consumo
  useEffect(() => { carregar(); }, [carregar, refreshTrigger]);

  return (
    <div className="card-custom mb-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
          ✦ Consumos da Gira
        </span>
        <button
          className="btn-outline-gold"
          onClick={carregar}
          disabled={loading}
          style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem' }}
        >
          ↻ Atualizar
        </button>
      </div>

      {!giraId && <div className="empty-state"><p>Configure o Gira ID acima.</p></div>}
      {giraId && erro && <div className="alert-custom alert-danger-custom m-3">{erro}</div>}
      {giraId && !loading && consumos.length === 0 && (
        <div className="empty-state"><p>Nenhum consumo registrado nesta gira.</p></div>
      )}

      {consumos.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table-custom">
            <thead>
              <tr>
                <th>Médium</th>
                <th>Item</th>
                <th>Qtd</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {consumos.map(c => (
                <tr key={c.id}>
                  <td>{c.medium_nome || c.medium_id?.slice(0, 8)}</td>
                  <td><strong>{c.item_name || c.inventory_item_id?.slice(0, 8)}</strong></td>
                  <td>{c.quantity}</td>
                  <td>
                    <span className={`badge-status ${c.source === 'MEDIUM' ? 'badge-compareceu' : 'badge-confirmado'}`}>
                      {c.source}
                    </span>
                  </td>
                  <td>
                    <span className={`badge-status ${
                      c.status === 'PROCESSADO' ? 'badge-compareceu'
                      : c.status === 'CANCELADO' ? 'badge-cancelado'
                      : 'badge-aberta'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 7 — FINALIZAR GIRA
// ══════════════════════════════════════════════════════════════════════════════
function SecaoFinalizar({ giraId, onFinalizado }) {
  const [loading, setLoading]   = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro]         = useState('');

  const handleFinalizar = async () => {
    if (!giraId) { setErro('Configure o Gira ID acima.'); return; }
    if (!window.confirm(
      `Finalizar gira ${giraId.slice(0, 8)}...?\n\n` +
      `Os consumos PENDENTE serão convertidos em movimentações OUT no ledger.\n` +
      `Esta ação não pode ser desfeita.`
    )) return;

    setLoading(true);
    setErro('');
    setResultado(null);
    try {
      const res = await finalizarGira(giraId);
      setResultado(res.data);
      onFinalizado();
    } catch (err) {
      setErro(handleApiError(err, 'Finalizar gira'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-custom mb-4">
      <div className="card-header">
        <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
          ✦ Finalizar Gira
        </span>
      </div>
      <div className="p-3">
        {erro && (
          <div className="alert-custom alert-danger-custom mb-3">
            <i className="bi bi-exclamation-circle me-2"></i>{erro}
          </div>
        )}

        {resultado && (
          <div className="alert-custom alert-success-custom mb-3">
            <strong><i className="bi bi-check-circle me-2"></i>Gira finalizada!</strong>
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', fontSize: '0.88rem' }}>
              <li>Consumos processados: <strong>{resultado.consumos_processados}</strong></li>
              <li>Movimentações criadas: <strong>{resultado.movimentacoes_geradas}</strong></li>
              <li>Notificações criadas: <strong>{resultado.notificacoes_criadas}</strong></li>
              {resultado.mediums_sem_consumo?.length > 0 && (
                <li style={{ color: '#ef4444' }}>
                  Médiuns sem consumo: <strong>{resultado.mediums_sem_consumo.join(', ')}</strong>
                </li>
              )}
            </ul>
          </div>
        )}

        <button
          onClick={handleFinalizar}
          disabled={loading || !giraId}
          style={{
            background:    'rgba(239,68,68,0.12)',
            border:        '1px solid rgba(239,68,68,0.35)',
            color:         '#ef4444',
            borderRadius:  '8px',
            padding:       '0.6rem 1.5rem',
            cursor:        loading || !giraId ? 'not-allowed' : 'pointer',
            fontWeight:    700,
            fontSize:      '0.9rem',
            opacity:       !giraId ? 0.5 : 1,
          }}
        >
          {loading
            ? <><span className="spinner-border spinner-border-sm me-2"></span>Finalizando...</>
            : <><i className="bi bi-lock me-2"></i>Finalizar gira e processar estoque</>
          }
        </button>
        <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--cor-texto-suave)' }}>
          Ação irreversível. Converte consumos PENDENTE em saídas definitivas do estoque.
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL DE HISTÓRICO DE MOVIMENTAÇÕES
// ══════════════════════════════════════════════════════════════════════════════
function ModalHistorico({ item, onClose }) {
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!item) return;
    getHistoricoItem(item.id, 30)
      .then(res => setHistorico(res.data))
      .catch(() => setHistorico([]))
      .finally(() => setLoading(false));
  }, [item]);

  if (!item) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="card-custom"
        style={{ width: '100%', maxWidth: '700px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="card-header d-flex justify-content-between align-items-center">
          <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
            Histórico: {item.name}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--cor-texto-suave)' }}>
              Saldo atual:{' '}
              <strong style={{ color: 'var(--cor-acento)' }}>{item.current_stock ?? '?'}</strong>
            </span>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--cor-texto-suave)', cursor: 'pointer', fontSize: '1.2rem' }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Corpo com scroll */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <div className="spinner-gold"></div>
            </div>
          )}
          {!loading && historico.length === 0 && (
            <div className="empty-state"><p>Sem movimentações registradas.</p></div>
          )}
          {historico.length > 0 && (
            <table className="table-custom">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Qtd</th>
                  <th>Gira</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {historico.map(m => {
                  const isEntrada = m.type === 'IN' || m.type === 'ADJUSTMENT';
                  return (
                    <tr key={m.id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--cor-texto-suave)' }}>
                        {new Date(m.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td>
                        <span className={`badge-status ${isEntrada ? 'badge-compareceu' : 'badge-faltou'}`}>
                          {m.type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: isEntrada ? '#10b981' : '#ef4444' }}>
                        {isEntrada ? '+' : '−'}{m.quantity}
                      </td>
                      <td style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--cor-texto-suave)' }}>
                        {m.gira_id ? m.gira_id.slice(0, 8) + '...' : '—'}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--cor-texto-suave)' }}>
                        {m.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE RAIZ
// ══════════════════════════════════════════════════════════════════════════════
export default function InventarioPage() {
  const [giraId, setGiraId]               = useState('');
  const [itens, setItens]                 = useState([]);
  const [loadingItens, setLoadingItens]   = useState(false);
  const [erroItens, setErroItens]         = useState('');
  const [itemMovimentar, setItemMovimentar] = useState(null);
  const [itemHistorico, setItemHistorico]   = useState(null);
  // Incrementado a cada novo consumo registrado → força refresh da SecaoListaConsumos
  const [consumoRefresh, setConsumoRefresh] = useState(0);

  const carregarItens = useCallback(async () => {
    setLoadingItens(true);
    setErroItens('');
    try {
      const res = await listarItens();
      setItens(res.data);
    } catch (err) {
      setErroItens(handleApiError(err, 'Listar itens'));
    } finally {
      setLoadingItens(false);
    }
  }, []);

  // Recupera giraId salvo e carrega itens na montagem
  useEffect(() => {
    const saved = localStorage.getItem('test_gira_id') || '';
    setGiraId(saved);
    carregarItens();
  }, [carregarItens]);

  const handleConsumoRegistrado = () => {
    setConsumoRefresh(n => n + 1);
    carregarItens(); // atualiza estoque na listagem
  };

  const handleFinalizado = () => {
    carregarItens();
    setConsumoRefresh(n => n + 1);
  };

  return (
    <>
      <Head><title>Inventário | AxeFlow</title></Head>

      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">

          {/* ── Topbar ── */}
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>
                Inventário
              </h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>
                Gestão de estoque e consumo por gira
              </small>
            </div>
          </div>

          <div className="page-content">

            {/* 1 — Config */}
            <SecaoConfig giraId={giraId} setGiraId={setGiraId} />

            {/* Erro global de carregamento */}
            {erroItens && (
              <div className="alert-custom alert-danger-custom mb-4">
                <i className="bi bi-exclamation-triangle me-2"></i>
                Erro ao carregar itens: {erroItens}
              </div>
            )}

            {/* 2 — Lista de itens */}
            <SecaoListaItens
              itens={itens}
              loading={loadingItens}
              onRecarregar={carregarItens}
              onVerHistorico={setItemHistorico}
              onMovimentar={setItemMovimentar}
            />

            {/* 3 — Criar item */}
            <SecaoCriarItem onCriado={carregarItens} />

            {/* 4 — Movimentação manual */}
            <SecaoMovimentacao
              itemSelecionado={itemMovimentar}
              itens={itens}
              onMovimentado={carregarItens}
            />

            {/* 5 — Consumo por gira */}
            <SecaoConsumoGira
              giraId={giraId}
              itens={itens}
              onConsumoRegistrado={handleConsumoRegistrado}
            />

            {/* 6 — Listar consumos */}
            <SecaoListaConsumos
              giraId={giraId}
              refreshTrigger={consumoRefresh}
            />

            {/* 7 — Finalizar */}
            <SecaoFinalizar
              giraId={giraId}
              onFinalizado={handleFinalizado}
            />

          </div>
        </div>
      </div>

      <BottomNav />

      {/* Modal de histórico de movimentações */}
      {itemHistorico && (
        <ModalHistorico
          item={itemHistorico}
          onClose={() => setItemHistorico(null)}
        />
      )}
    </>
  );
}