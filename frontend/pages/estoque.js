/**
 * pages/estoque.js — AxeFlow
 *
 * Dependências:
 *   hooks/useEstoque           → itens, criarItem, mover, reload
 *   viewModels/estoqueViewModel → buildItensEstoqueViewModel
 *
 * Padrão: hook → viewModel → formulários
 * Estado de formulário permanece local — não pertence ao hook.
 */
import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useEstoque } from '../hooks/useEstoque';
import { buildItensEstoqueViewModel } from '../viewModels/estoqueViewModel';
import { handleApiError } from '../services/errorHandler';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';

// ─── Constantes de display ────────────────────────────────────────────────────

const CATEGORIAS = [
  { value: 'bebida',        label: '🥤 Bebida' },
  { value: 'charuto',       label: '🚬 Charuto' },
  { value: 'cigarro',       label: '🚬 Cigarro' },
  { value: 'cigarro_palha', label: '🌿 Cigarro de palha' },
  { value: 'pemba',         label: '🪨 Pemba' },
  { value: 'vela',          label: '🕯️ Vela' },
  { value: 'outros',        label: '📦 Outros' },
];

const TIPOS_MOVIMENTACAO = [
  { value: 'IN',         label: 'Entrada', emoji: '📥', desc: 'Item foi comprado ou recebido',          cor: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.35)' },
  { value: 'OUT',        label: 'Saída',   emoji: '📤', desc: 'Item foi descartado ou perdido',          cor: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.35)' },
  { value: 'ADJUSTMENT', label: 'Ajuste',  emoji: '✏️', desc: 'Correção de quantidade (contagem física)', cor: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.35)' },
];

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function CardSelecao({ opcoes, selecionado, onSelecionar }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {opcoes.map(opt => {
        const ativo = selecionado === opt.value;
        return (
          <button key={opt.value} type="button" onClick={() => onSelecionar(opt.value)} style={{
            flex: 1, minWidth: '120px', padding: '0.75rem 0.5rem',
            borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
            background: ativo ? opt.bg || 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.02)',
            border: `1.5px solid ${ativo ? opt.border || 'var(--cor-acento)' : 'var(--cor-borda)'}`,
          }}>
            <div style={{ fontSize: '1.2rem', marginBottom: '3px' }}>{opt.emoji}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: ativo ? opt.cor || 'var(--cor-acento)' : 'var(--cor-texto)' }}>
              {opt.label}
            </div>
            {opt.desc && (
              <div style={{ fontSize: '0.7rem', color: 'var(--cor-texto-suave)', marginTop: '2px' }}>{opt.desc}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Formulário: criar item ───────────────────────────────────────────────────

function FormCriarItem({ onCriar }) {
  const [form, setForm] = useState({
    name: '', category: 'vela', minimum_threshold: 0, unit_cost: '', owner: 'terreiro',
  });
  const [saving, setSaving]   = useState(false);
  const [erro, setErro]       = useState('');
  const [sucesso, setSucesso] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErro('');
    setSucesso('');
    try {
      const nome = await onCriar(form);
      setSucesso(`"${nome}" adicionado ao estoque!`);
      setForm({ name: '', category: 'vela', minimum_threshold: 0, unit_cost: '', owner: 'terreiro' });
      setTimeout(() => setSucesso(''), 4000);
    } catch (err) {
      setErro(handleApiError(err, 'Criar item'));
    } finally {
      setSaving(false);
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
        {erro    && <div className="alert-custom alert-danger-custom mb-3"><i className="bi bi-exclamation-circle me-2" />{erro}</div>}
        {sucesso && <div className="alert-custom alert-success-custom mb-3"><i className="bi bi-check-circle me-2" />{sucesso}</div>}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label-custom">Nome do item *</label>
            <input className="form-control-custom" value={form.name} required
              placeholder="Ex: Vela branca, Cachaça, Charuto"
              onChange={e => set('name', e.target.value)} />
          </div>

          <div className="mb-3">
            <label className="form-label-custom">Categoria *</label>
            <select className="form-control-custom" value={form.category}
              onChange={e => set('category', e.target.value)} style={{ appearance: 'auto' }}>
              {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label-custom">Este item pertence a:</label>
            <CardSelecao
              opcoes={[
                { value: 'terreiro', label: 'O terreiro', emoji: '🏛️', desc: 'Item do estoque coletivo', cor: 'var(--cor-acento)', bg: 'rgba(212,175,55,0.1)', border: 'rgba(212,175,55,0.35)' },
                { value: 'medium',   label: 'A mim',      emoji: '🙋', desc: 'Item pessoal do médium',   cor: '#a78bfa',          bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.35)' },
              ]}
              selecionado={form.owner}
              onSelecionar={v => set('owner', v)}
            />
          </div>

          <div className="mb-3">
            <label className="form-label-custom">
              Alerta de estoque baixo
              <span style={{ fontWeight: 400, marginLeft: '0.4rem', color: 'var(--cor-texto-suave)', fontSize: '0.78rem' }}>(opcional)</span>
            </label>
            <input type="number" min="0" className="form-control-custom"
              value={form.minimum_threshold}
              onChange={e => set('minimum_threshold', e.target.value)}
              style={{ maxWidth: '160px' }} />
            <div style={{ fontSize: '0.75rem', color: 'var(--cor-texto-suave)', marginTop: '4px' }}>
              Você será avisado quando o estoque chegar a esse número. Deixe 0 para não receber alertas.
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label-custom">
              Custo por unidade (R$)
              <span style={{ fontWeight: 400, marginLeft: '0.4rem', color: 'var(--cor-texto-suave)', fontSize: '0.78rem' }}>(opcional)</span>
            </label>
            <input type="number" step="0.01" min="0" className="form-control-custom"
              value={form.unit_cost} placeholder="0,00"
              onChange={e => set('unit_cost', e.target.value)}
              style={{ maxWidth: '160px' }} />
            <div style={{ fontSize: '0.75rem', color: 'var(--cor-texto-suave)', marginTop: '4px' }}>
              Usado para calcular o custo total do estoque.
            </div>
          </div>

          <button className="btn-gold" type="submit" disabled={saving}>
            {saving
              ? <><span className="spinner-border spinner-border-sm me-2" />Salvando...</>
              : <><i className="bi bi-plus-lg me-2" />Cadastrar item</>}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Formulário: movimentação ─────────────────────────────────────────────────

function FormMovimentacao({ itensVM, onMover }) {
  const [form, setForm] = useState({ item_id: '', type: 'IN', quantity: 1, notes: '' });
  const [saving, setSaving]   = useState(false);
  const [erro, setErro]       = useState('');
  const [sucesso, setSucesso] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.item_id) { setErro('Selecione um item.'); return; }
    setSaving(true);
    setErro('');
    setSucesso('');
    try {
      await onMover(form.item_id, form);
      const tipo = TIPOS_MOVIMENTACAO.find(t => t.value === form.type);
      setSucesso(`${tipo?.label} de ${form.quantity} ${form.quantity > 1 ? 'unidades' : 'unidade'} registrada!`);
      setForm(f => ({ ...f, quantity: 1, notes: '' }));
      setTimeout(() => setSucesso(''), 4000);
    } catch (err) {
      setErro(handleApiError(err, 'Registrar movimentação'));
    } finally {
      setSaving(false);
    }
  };

  // ViewModel do item selecionado — já processado
  const itemVM = itensVM.find(i => i.id === form.item_id);

  return (
    <div className="card-custom mb-4">
      <div className="card-header">
        <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
          ✦ Registrar entrada ou saída
        </span>
      </div>
      <div style={{ padding: '1.25rem' }}>
        {erro    && <div className="alert-custom alert-danger-custom mb-3"><i className="bi bi-exclamation-circle me-2" />{erro}</div>}
        {sucesso && <div className="alert-custom alert-success-custom mb-3"><i className="bi bi-check-circle me-2" />{sucesso}</div>}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="form-label-custom">O que aconteceu com o estoque? *</label>
            <CardSelecao opcoes={TIPOS_MOVIMENTACAO} selecionado={form.type} onSelecionar={v => set('type', v)} />
          </div>

          <div className="mb-3">
            <label className="form-label-custom">Qual item? *</label>
            <select className="form-control-custom" value={form.item_id} required
              onChange={e => set('item_id', e.target.value)} style={{ appearance: 'auto' }}>
              <option value="">— Selecione um item —</option>
              {itensVM.map(i => (
                <option key={i.id} value={i.id}>{i.label}</option>
              ))}
            </select>
            {itemVM && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--cor-texto-suave)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="bi bi-box-seam" />
                Saldo atual: <strong style={{ color: itemVM.cor }}>{itemVM.saldoLabel}</strong>
              </div>
            )}
          </div>

          <div className="mb-3">
            <label className="form-label-custom">Quantidade *</label>
            <input type="number" min="1" className="form-control-custom" required
              value={form.quantity} onChange={e => set('quantity', e.target.value)}
              style={{ maxWidth: '160px' }} />
          </div>

          <div className="mb-4">
            <label className="form-label-custom">
              Observação
              <span style={{ fontWeight: 400, marginLeft: '0.4rem', color: 'var(--cor-texto-suave)', fontSize: '0.78rem' }}>(opcional)</span>
            </label>
            <input className="form-control-custom" value={form.notes}
              placeholder="Ex: Compra no mercadão, descarte por vencimento..."
              onChange={e => set('notes', e.target.value)} maxLength={500} />
          </div>

          <button className="btn-gold" type="submit" disabled={saving}>
            {saving
              ? <><span className="spinner-border spinner-border-sm me-2" />Salvando...</>
              : <><i className="bi bi-arrow-left-right me-2" />Registrar</>}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function EstoquePage() {
  const router = useRouter();
  const { itens, loading, criarItem, mover } = useEstoque();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  // ViewModel — derivado apenas quando itens mudam
  const itensVM = useMemo(() => buildItensEstoqueViewModel(itens), [itens]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner-gold" />
    </div>
  );

  return (
    <>
      <Head><title>Gerenciar Estoque | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>Gerenciar Estoque</h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>Cadastre itens e registre entradas e saídas</small>
            </div>
            <Link href="/inventario" style={{ color: 'var(--cor-texto-suave)', textDecoration: 'none', fontSize: '0.9rem' }}>
              ← Ver painel de estoque
            </Link>
          </div>
          <div className="page-content">
            <FormCriarItem onCriar={criarItem} />
            <FormMovimentacao itensVM={itensVM} onMover={mover} />
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}