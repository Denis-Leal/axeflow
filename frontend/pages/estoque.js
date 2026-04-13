/**
 * pages/estoque.js — AxeFlow
 *
 * Página de GERENCIAMENTO de estoque.
 *
 * Responsabilidades:
 *   - Criar itens de estoque (do terreiro ou do médium)
 *   - Registrar movimentações manuais (entrada, saída, ajuste)
 *
 * Esta página usa linguagem amigável para usuários não-técnicos:
 *   - "source" → "Origem do item" (Do terreiro / Meu item)
 *   - "threshold" → "Alerta de estoque baixo"
 *   - "IN/OUT/ADJUSTMENT" → "Entrada / Saída / Ajuste"
 *
 * Separada de /inventario (dashboard) e /gira/[id]/consumo (operação)
 * para reduzir sobrecarga cognitiva.
 */

import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  listarItens,
  criarItemTerreiro,
  criarItemMedium,
  registrarMovimentacao,
} from '../services/api';
import { handleApiError } from '../services/errorHandler';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';

// ── Categorias válidas com labels amigáveis ───────────────────────────────────
const CATEGORIAS = [
  { value: 'bebida',        label: '🥤 Bebida' },
  { value: 'charuto',       label: '🚬 Charuto' },
  { value: 'cigarro',       label: '🚬 Cigarro' },
  { value: 'cigarro_palha', label: '🌿 Cigarro de palha' },
  { value: 'pemba',         label: '🪨 Pemba' },
  { value: 'vela',          label: '🕯️ Vela' },
  { value: 'outros',        label: '📦 Outros' },
];

// ── Tipos de movimentação com labels amigáveis ────────────────────────────────
const TIPOS_MOVIMENTACAO = [
  {
    value: 'IN',
    label: 'Entrada',
    emoji: '📥',
    desc: 'Item foi comprado ou recebido',
    cor: '#10b981',
    bg: 'rgba(16,185,129,0.1)',
    border: 'rgba(16,185,129,0.35)',
  },
  {
    value: 'OUT',
    label: 'Saída',
    emoji: '📤',
    desc: 'Item foi descartado ou perdido',
    cor: '#ef4444',
    bg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.35)',
  },
  {
    value: 'ADJUSTMENT',
    label: 'Ajuste',
    emoji: '✏️',
    desc: 'Correção de quantidade (contagem física)',
    cor: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.35)',
  },
];

// ── Componente: card de seleção visual ─────────────────────────────────────────
function CardSelecao({ opcoes, selecionado, onSelecionar }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {opcoes.map(opt => {
        const ativo = selecionado === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelecionar(opt.value)}
            style={{
              flex: 1, minWidth: '120px', padding: '0.75rem 0.5rem',
              borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
              background: ativo ? opt.bg || 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.02)',
              border: `1.5px solid ${ativo ? opt.border || 'var(--cor-acento)' : 'var(--cor-borda)'}`,
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: '1.2rem', marginBottom: '3px' }}>{opt.emoji}</div>
            <div style={{
              fontSize: '0.85rem', fontWeight: 600,
              color: ativo ? opt.cor || 'var(--cor-acento)' : 'var(--cor-texto)',
            }}>
              {opt.label}
            </div>
            {opt.desc && (
              <div style={{ fontSize: '0.7rem', color: 'var(--cor-texto-suave)', marginTop: '2px' }}>
                {opt.desc}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SEÇÃO: Criar novo item
// ══════════════════════════════════════════════════════════════════════════════
function FormCriarItem({ onCriado }) {
  const [form, setForm] = useState({
    name: '',
    category: 'vela',
    minimum_threshold: 0,
    unit_cost: '',
    owner: 'terreiro', // 'terreiro' ou 'medium'
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
      const payload = {
        name:              form.name.trim(),
        category:          form.category,
        minimum_threshold: parseInt(form.minimum_threshold) || 0,
        unit_cost:         form.unit_cost ? parseFloat(form.unit_cost) : null,
      };

      // Escolhe o endpoint conforme o dono do item
      const fn = form.owner === 'terreiro' ? criarItemTerreiro : criarItemMedium;
      await fn(payload);

      setSucesso(`"${payload.name}" adicionado ao estoque!`);
      setForm({ name: '', category: 'vela', minimum_threshold: 0, unit_cost: '', owner: 'terreiro' });
      onCriado();

      // Limpa mensagem de sucesso após 4s
      setTimeout(() => setSucesso(''), 4000);
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
          ✦ Cadastrar novo item
        </span>
      </div>
      <div style={{ padding: '1.25rem' }}>

        {erro    && <div className="alert-custom alert-danger-custom mb-3"><i className="bi bi-exclamation-circle me-2"></i>{erro}</div>}
        {sucesso && <div className="alert-custom alert-success-custom mb-3"><i className="bi bi-check-circle me-2"></i>{sucesso}</div>}

        <form onSubmit={handleSubmit}>

          {/* Nome do item */}
          <div className="mb-3">
            <label className="form-label-custom">Nome do item *</label>
            <input
              className="form-control-custom"
              value={form.name}
              required
              placeholder="Ex: Vela branca, Cachaça, Charuto"
              onChange={e => set('name', e.target.value)}
            />
          </div>

          {/* Categoria */}
          <div className="mb-3">
            <label className="form-label-custom">Categoria *</label>
            <select
              className="form-control-custom"
              value={form.category}
              onChange={e => set('category', e.target.value)}
              style={{ appearance: 'auto' }}
            >
              {CATEGORIAS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Dono do item */}
          <div className="mb-3">
            <label className="form-label-custom">Este item pertence a:</label>
            <CardSelecao
              opcoes={[
                { value: 'terreiro', label: 'O terreiro', emoji: '🏛️', desc: 'Item do estoque coletivo', cor: 'var(--cor-acento)', bg: 'rgba(212,175,55,0.1)', border: 'rgba(212,175,55,0.35)' },
                { value: 'medium',   label: 'A mim',     emoji: '🙋', desc: 'Item pessoal do médium',   cor: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.35)' },
              ]}
              selecionado={form.owner}
              onSelecionar={v => set('owner', v)}
            />
          </div>

          {/* Alerta de estoque baixo */}
          <div className="mb-3">
            <label className="form-label-custom">
              Alerta de estoque baixo
              <span style={{ fontWeight: 400, marginLeft: '0.4rem', color: 'var(--cor-texto-suave)', fontSize: '0.78rem' }}>
                (opcional)
              </span>
            </label>
            <input
              type="number"
              min="0"
              className="form-control-custom"
              value={form.minimum_threshold}
              onChange={e => set('minimum_threshold', e.target.value)}
              style={{ maxWidth: '160px' }}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--cor-texto-suave)', marginTop: '4px' }}>
              Você será avisado quando o estoque chegar a esse número.
              Deixe 0 para não receber alertas.
            </div>
          </div>

          {/* Custo unitário (opcional) */}
          <div className="mb-4">
            <label className="form-label-custom">
              Custo por unidade (R$)
              <span style={{ fontWeight: 400, marginLeft: '0.4rem', color: 'var(--cor-texto-suave)', fontSize: '0.78rem' }}>
                (opcional)
              </span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-control-custom"
              value={form.unit_cost}
              placeholder="0,00"
              onChange={e => set('unit_cost', e.target.value)}
              style={{ maxWidth: '160px' }}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--cor-texto-suave)', marginTop: '4px' }}>
              Usado para calcular o custo total do estoque.
            </div>
          </div>

          <button className="btn-gold" type="submit" disabled={loading}>
            {loading
              ? <><span className="spinner-border spinner-border-sm me-2"></span>Salvando...</>
              : <><i className="bi bi-plus-lg me-2"></i>Cadastrar item</>
            }
          </button>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SEÇÃO: Registrar movimentação manual
// ══════════════════════════════════════════════════════════════════════════════
function FormMovimentacao({ itens, onMovimentado }) {
  const [form, setForm] = useState({
    item_id: '',
    type: 'IN',
    quantity: 1,
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro]       = useState('');
  const [sucesso, setSucesso] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.item_id) { setErro('Selecione um item.'); return; }

    setLoading(true);
    setErro('');
    setSucesso('');

    try {
      await registrarMovimentacao(form.item_id, {
        type:     form.type,
        quantity: parseInt(form.quantity),
        notes:    form.notes.trim() || null,
      });

      const tipoInfo = TIPOS_MOVIMENTACAO.find(t => t.value === form.type);
      setSucesso(`${tipoInfo?.label} de ${form.quantity} ${form.quantity > 1 ? 'unidades' : 'unidade'} registrada!`);
      setForm(f => ({ ...f, quantity: 1, notes: '' }));
      onMovimentado();

      setTimeout(() => setSucesso(''), 4000);
    } catch (err) {
      setErro(handleApiError(err, 'Registrar movimentação'));
    } finally {
      setLoading(false);
    }
  };

  // Item selecionado para exibir saldo atual
  const itemSelecionado = itens.find(i => i.id === form.item_id);

  return (
    <div className="card-custom mb-4">
      <div className="card-header">
        <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
          ✦ Registrar entrada ou saída
        </span>
      </div>
      <div style={{ padding: '1.25rem' }}>

        {erro    && <div className="alert-custom alert-danger-custom mb-3"><i className="bi bi-exclamation-circle me-2"></i>{erro}</div>}
        {sucesso && <div className="alert-custom alert-success-custom mb-3"><i className="bi bi-check-circle me-2"></i>{sucesso}</div>}

        <form onSubmit={handleSubmit}>

          {/* Tipo de movimentação — seleção visual */}
          <div className="mb-4">
            <label className="form-label-custom">O que aconteceu com o estoque? *</label>
            <CardSelecao
              opcoes={TIPOS_MOVIMENTACAO}
              selecionado={form.type}
              onSelecionar={v => set('type', v)}
            />
          </div>

          {/* Item afetado */}
          <div className="mb-3">
            <label className="form-label-custom">Qual item? *</label>
            <select
              className="form-control-custom"
              value={form.item_id}
              required
              onChange={e => set('item_id', e.target.value)}
              style={{ appearance: 'auto' }}
            >
              <option value="">— Selecione um item —</option>
              {itens.map(i => (
                <option key={i.id} value={i.id}>
                  {i.name} — saldo atual: {i.current_stock ?? '?'}
                </option>
              ))}
            </select>

            {/* Mostra saldo atual do item selecionado */}
            {itemSelecionado && (
              <div style={{
                marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--cor-texto-suave)',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <i className="bi bi-box-seam"></i>
                Saldo atual:{' '}
                <strong style={{ color: getCorSaldo(itemSelecionado) }}>
                  {itemSelecionado.current_stock ?? '?'} unidades
                </strong>
              </div>
            )}
          </div>

          {/* Quantidade */}
          <div className="mb-3">
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

          {/* Observação */}
          <div className="mb-4">
            <label className="form-label-custom">
              Observação
              <span style={{ fontWeight: 400, marginLeft: '0.4rem', color: 'var(--cor-texto-suave)', fontSize: '0.78rem' }}>
                (opcional)
              </span>
            </label>
            <input
              className="form-control-custom"
              value={form.notes}
              placeholder="Ex: Compra no mercadão, descarte por vencimento..."
              onChange={e => set('notes', e.target.value)}
              maxLength={500}
            />
          </div>

          <button className="btn-gold" type="submit" disabled={loading}>
            {loading
              ? <><span className="spinner-border spinner-border-sm me-2"></span>Salvando...</>
              : <><i className="bi bi-arrow-left-right me-2"></i>Registrar</>
            }
          </button>
        </form>
      </div>
    </div>
  );
}

// Retorna cor com base no saldo do item
function getCorSaldo(item) {
  const { current_stock: saldo, minimum_threshold: threshold } = item;
  if (saldo === null || saldo === undefined) return 'var(--cor-texto-suave)';
  if (threshold > 0 && saldo <= threshold) return '#ef4444';
  if (saldo === 0) return '#94a3b8';
  return '#10b981';
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function EstoquePage() {
  const router = useRouter();

  const [itens, setItens]     = useState([]);
  const [loading, setLoading] = useState(true);

  const carregarItens = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listarItens();
      setItens(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    carregarItens();
  }, [carregarItens, router]);

  return (
    <>
      <Head><title>Gerenciar Estoque | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">

          {/* ── Topbar ── */}
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>
                Gerenciar Estoque
              </h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>
                Cadastre itens e registre entradas e saídas
              </small>
            </div>
            <Link
              href="/inventario"
              style={{ color: 'var(--cor-texto-suave)', textDecoration: 'none', fontSize: '0.9rem' }}
            >
              ← Ver painel de estoque
            </Link>
          </div>

          <div className="page-content">

            {/* Cadastro de novo item */}
            <FormCriarItem onCriado={carregarItens} />

            {/* Movimentação manual */}
            <FormMovimentacao itens={itens} onMovimentado={carregarItens} />

          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}