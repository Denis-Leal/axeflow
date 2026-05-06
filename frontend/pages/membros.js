/**
 * pages/membros.js — AxeFlow
 *
 * Dependências:
 *   hooks/useMembros            → me, membros, ranking, convidar, editar, loadRanking
 *   hooks/useMediaQuery         → useIsMobile
 *   viewModels/membroViewModel  → buildMembrosListViewModel, buildRankingViewModel,
 *                                  buildRankingStats, COR_SCORE
 *
 * Padrão: hook → viewModel → card (mobile) | table (desktop)
 * Estado de UI (modais, form, busca) permanece na página — não pertence ao hook.
 * Lazy loading do ranking preservado via loadRanking().
 */
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import { useMembros } from '../hooks/useMembros';
import { useIsMobile } from '../hooks/useMediaQuery';
import {
  buildMembrosListViewModel,
  buildRankingViewModel,
  buildRankingStats,
  COR_SCORE,
} from '../viewModels/membroViewModel';
import { handleApiError } from '../services/errorHandler';
import MembroListCard from '../components/membro/MembroListCard';
import MembroListTable from '../components/membro/MembroListTable';
import RankingCard from '../components/membro/RankingCard';
import RankingTable from '../components/membro/RankingTable';
import { Spinner, Card, CardHeader, CardBody, Button, StatCard } from '../components/ui';

// ─── Legenda de score ─────────────────────────────────────────────────────────

function ScoreLegenda() {
  const itens = [
    { emoji: '✅', label: 'Confiável ≥80%',   cor: 'verde' },
    { emoji: '⚠️', label: 'Regular 50–79%',   cor: 'amarelo' },
    { emoji: '🔶', label: 'Risco 20–49%',      cor: 'laranja' },
    { emoji: '🚫', label: 'Problemático <20%', cor: 'vermelho' },
    { emoji: '🆕', label: 'Novo (< 2 giras)',  cor: 'cinza' },
  ];
  return (
    <div style={{
      padding: '0.75rem 1rem', borderTop: '1px solid var(--cor-borda)',
      display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center',
    }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>Score de presença:</span>
      {itens.map(s => {
        const c = COR_SCORE[s.cor];
        return (
          <span key={s.cor} style={{
            fontSize: '0.7rem', color: c.text, background: c.bg,
            border: `1px solid ${c.border}`, borderRadius: '20px', padding: '1px 8px',
          }}>
            {s.emoji} {s.label}
          </span>
        );
      })}
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ titulo, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <Card style={{ width: '100%', maxWidth: '460px', margin: '1rem' }}>
        <CardHeader style={{ justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)' }}>✦ {titulo}</span>
          <Button variant="ghost" size="sm" onClick={onClose} style={{ fontSize: '1.2rem', padding: '0 0.4rem' }}>×</Button>
        </CardHeader>
        <CardBody>{children}</CardBody>
      </Card>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Membros() {
  const router   = useRouter();
  const isMobile = useIsMobile();

  const {
    me, membros, loading,
    ranking, loadingRanking, rankingCarregado,
    loadRanking, convidar, editar,
  } = useMembros();

  const [aba, setAba]     = useState('lista');
  const [busca, setBusca] = useState('');

  // Estado de modais — UI local, não pertence ao hook
  const [showModal, setShowModal]           = useState(false);
  const [showEditModal, setShowEditModal]   = useState(false);
  const [membroEditando, setMembroEditando] = useState(null);
  const [form, setForm]         = useState({ nome: '', email: '', senha: '', telefone: '', role: 'membro' });
  const [editForm, setEditForm] = useState({ nome: '', telefone: '', role: 'membro', ativo: true, senha: '' });
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  // Lazy load do ranking ao abrir a aba
  useEffect(() => {
    if (aba === 'desempenho') loadRanking();
  }, [aba, loadRanking]);

  // ViewModels — derivam apenas quando dados mudam
  const membrosVM = useMemo(
    () => buildMembrosListViewModel(membros, me?.id),
    [membros, me]
  );
  const rankingVM = useMemo(
    () => buildRankingViewModel(ranking),
    [ranking]
  );
  const rankingStats = useMemo(
    () => buildRankingStats(ranking),
    [ranking]
  );
  const rankingFiltrado = useMemo(
    () => rankingVM.filter(m =>
      m.nome?.toLowerCase().includes(busca.toLowerCase())
    ),
    [rankingVM, busca]
  );

  const isAdmin = me?.role === 'admin';

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const abrirEditar = (m) => {
    setMembroEditando(m);
    setEditForm({
      nome:     m.nome,
      telefone: m.telefone === '—' ? '' : m.telefone,
      role:     m.role,
      ativo:    m.ativo,
      senha:    '',
    });
    setFormError('');
    setShowEditModal(true);
  };

  const handleConvidar = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await convidar(form);
      setShowModal(false);
      setForm({ nome: '', email: '', senha: '', telefone: '', role: 'membro' });
    } catch (err) {
      setFormError(handleApiError(err, 'Membros'));
    } finally {
      setSaving(false);
    }
  };

  const handleEditar = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await editar(membroEditando.id, editForm);
      setShowEditModal(false);
    } catch (err) {
      setFormError(handleApiError(err, 'Membros'));
    } finally {
      setSaving(false);
    }
  };

  // ─── Loading inicial ──────────────────────────────────────────────────────

  if (loading) return <Spinner center />;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <Head><title>Membros | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">

          {/* Topbar */}
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>Membros</h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>Usuários do seu terreiro</small>
            </div>
            {isAdmin && aba === 'lista' && (
              <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
                <i className="bi bi-person-plus me-1" /> Convidar Membro
              </Button>
            )}
          </div>

          {/* Abas */}
          <div style={{
            display: 'flex', gap: '0.25rem',
            borderBottom: '1px solid var(--cor-borda)',
            padding: '0 1.5rem', background: 'var(--cor-card)',
          }}>
            {[
              { id: 'lista',      label: 'Membros',    icone: 'bi-person-badge' },
              { id: 'desempenho', label: 'Desempenho', icone: 'bi-bar-chart-line',
                badge: rankingCarregado && rankingStats.alertas > 0 ? rankingStats.alertas : null },
            ].map(tab => (
              <button key={tab.id} onClick={() => setAba(tab.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600,
                color: aba === tab.id ? 'var(--cor-acento)' : 'var(--cor-texto-suave)',
                borderBottom: aba === tab.id ? '2px solid var(--cor-acento)' : '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '-1px',
              }}>
                <i className={`bi ${tab.icone}`} />
                {tab.label}
                {tab.badge && (
                  <span style={{
                    background: 'rgba(249,115,22,0.2)', color: '#f97316',
                    borderRadius: '10px', padding: '0 6px', fontSize: '0.7rem',
                    border: '1px solid rgba(249,115,22,0.35)',
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="page-content">

            {/* ── ABA: LISTA ── */}
            {aba === 'lista' && (
              <Card>
                {isMobile ? (
                  membrosVM.length > 0
                    ? membrosVM.map(m => <MembroListCard key={m.id} membro={m} isAdmin={isAdmin} onEditar={abrirEditar} />)
                    : <div className="empty-state"><i className="bi bi-person-badge d-block" /><p>Nenhum membro cadastrado</p></div>
                ) : (
                  <MembroListTable membros={membrosVM} isAdmin={isAdmin} onEditar={abrirEditar} />
                )}
              </Card>
            )}

            {/* ── ABA: DESEMPENHO ── */}
            {aba === 'desempenho' && (
              <div>
                {loadingRanking && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                    <Spinner />
                  </div>
                )}

                {!loadingRanking && rankingCarregado && (
                  <>
                    {/* Stats */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '0.75rem', marginBottom: '1.5rem',
                    }}>
                      {[
                        { label: 'Total',            value: rankingStats.total,        cor: 'var(--cor-acento)', sub: 'membros ativos' },
                        { label: '✅ Confiáveis',    value: rankingStats.confiaveis,   cor: '#10b981',           sub: 'taxa ≥ 80%' },
                        { label: '⚠ Alertas',        value: rankingStats.alertas,      cor: '#f97316',           sub: '3+ faltas, <50%' },
                        { label: '🆕 Sem histórico', value: rankingStats.semHistorico, cor: '#94a3b8',           sub: '< 2 giras' },
                      ].map(card => (
                        <StatCard key={card.label} label={card.label} value={card.value} sub={card.sub} color={card.cor} />
                      ))}
                    </div>

                    {/* Busca */}
                    <div style={{ marginBottom: '1rem' }}>
                      <input
                        className="form-control-custom"
                        placeholder="🔍  Buscar membro por nome..."
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                        style={{ maxWidth: '340px' }}
                      />
                    </div>

                    {/* Banner de alertas */}
                    {rankingStats.alertas > 0 && (
                      <div style={{
                        background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)',
                        borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.25rem',
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                      }}>
                        <span style={{ fontSize: '1.2rem' }}>🚨</span>
                        <div>
                          <strong style={{ color: '#f97316', fontSize: '0.9rem' }}>
                            {rankingStats.alertas} membro{rankingStats.alertas > 1 ? 's' : ''} com histórico preocupante
                          </strong>
                          <div style={{ color: 'var(--cor-texto-suave)', fontSize: '0.8rem' }}>
                            3+ faltas e taxa abaixo de 50%.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Mobile: cards | Desktop: tabela */}
                    <Card>
                      {isMobile ? (
                        rankingFiltrado.length > 0
                          ? rankingFiltrado.map(m => <RankingCard key={m.id} item={m} />)
                          : <div className="empty-state"><i className="bi bi-bar-chart-line d-block" /><p>{busca ? 'Nenhum membro encontrado' : 'Nenhum dado de presença ainda'}</p></div>
                      ) : (
                        <RankingTable itens={rankingFiltrado} />
                      )}
                      <ScoreLegenda />
                    </Card>
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Modal: Convidar ── */}
      {showModal && (
        <Modal titulo="Convidar Membro" onClose={() => setShowModal(false)}>
          {formError && <div className="alert-custom alert-danger-custom mb-3">{formError}</div>}
          <form onSubmit={handleConvidar}>
            <div className="mb-3">
              <label className="form-label-custom">Nome</label>
              <input className="form-control-custom" value={form.nome}
                onChange={e => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div className="mb-3">
              <label className="form-label-custom">Email</label>
              <input type="email" className="form-control-custom" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="form-label-custom">Telefone</label>
                <input className="form-control-custom" value={form.telefone}
                  onChange={e => setForm({ ...form, telefone: e.target.value })} />
              </div>
              <div className="col-6">
                <label className="form-label-custom">Perfil</label>
                <select className="form-control-custom" value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="membro" style={{ background: 'var(--cor-fundo)', color: 'var(--cor-texto)' }}>Membro</option>
                  <option value="operador" style={{ background: 'var(--cor-fundo)', color: 'var(--cor-texto)' }}>Operador</option>
                  <option value="admin" style={{ background: 'var(--cor-fundo)', color: 'var(--cor-texto)' }}>Admin</option>
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className="form-label-custom">Senha provisória</label>
              <input type="password" className="form-control-custom" value={form.senha}
                onChange={e => setForm({ ...form, senha: e.target.value })} required minLength={6} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button type="button" variant="outline" fullWidth onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit" variant="primary" fullWidth disabled={saving} loading={saving}>Convidar</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Editar ── */}
      {showEditModal && membroEditando && (
        <Modal titulo="Editar Membro" onClose={() => setShowEditModal(false)}>
          {formError && <div className="alert-custom alert-danger-custom mb-3">{formError}</div>}
          <form onSubmit={handleEditar}>
            <div className="mb-3">
              <label className="form-label-custom">Nome</label>
              <input className="form-control-custom" value={editForm.nome}
                onChange={e => setEditForm({ ...editForm, nome: e.target.value })} required />
            </div>
            <div className="mb-3">
              <label className="form-label-custom">Email</label>
              <input className="form-control-custom" value={membroEditando.email} disabled style={{ opacity: 0.5 }} />
              <small style={{ color: 'var(--cor-texto-suave)', fontSize: '0.75rem' }}>O email não pode ser alterado</small>
            </div>
            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="form-label-custom">Telefone</label>
                <input className="form-control-custom" value={editForm.telefone}
                  onChange={e => setEditForm({ ...editForm, telefone: e.target.value })} />
              </div>
              <div className="col-6">
                <label className="form-label-custom">Perfil</label>
                <select className="form-control-custom" value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                  <option value="membro" style={{ background: 'var(--cor-fundo)', color: 'var(--cor-texto)' }}>Membro</option>
                  <option value="operador" style={{ background: 'var(--cor-fundo)', color: 'var(--cor-texto)' }}>Operador</option>
                  <option value="admin" style={{ background: 'var(--cor-fundo)', color: 'var(--cor-texto)' }}>Admin</option>
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label-custom">
                Nova senha <span style={{ color: 'var(--cor-texto-suave)', fontWeight: 400 }}>(deixe em branco para manter)</span>
              </label>
              <input type="password" className="form-control-custom" value={editForm.senha}
                onChange={e => setEditForm({ ...editForm, senha: e.target.value })}
                minLength={6} placeholder="••••••" />
            </div>
            <div className="mb-4">
              <label className="form-label-custom">Status</label>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                {[
                  { val: true,  label: '✓ Ativo',  cor: '#10b981' },
                  { val: false, label: '✗ Inativo', cor: '#ef4444' },
                ].map(opt => (
                  <button key={String(opt.val)} type="button"
                    onClick={() => setEditForm({ ...editForm, ativo: opt.val })}
                    style={{
                      flex: 1, padding: '0.5rem', borderRadius: '8px',
                      cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                      border: `1px solid ${editForm.ativo === opt.val ? opt.cor : 'var(--cor-borda)'}`,
                      background: editForm.ativo === opt.val
                        ? `rgba(${opt.val ? '16,185,129' : '239,68,68'},0.15)`
                        : 'transparent',
                      color: editForm.ativo === opt.val ? opt.cor : 'var(--cor-texto-suave)',
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {membroEditando.souEu && (
                <small style={{ color: '#f59e0b', fontSize: '0.75rem', marginTop: '0.4rem', display: 'block' }}>
                  ⚠️ Você não pode desativar sua própria conta
                </small>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button type="button" variant="outline" fullWidth onClick={() => setShowEditModal(false)}>Cancelar</Button>
              <Button type="submit" variant="primary" fullWidth disabled={saving} loading={saving}>Salvar</Button>
            </div>
          </form>
        </Modal>
      )}

      <BottomNav />
    </>
  );
}