/**
 * pages/inventario.js — AxeFlow
 *
 * REFATORAÇÃO COMPLETA: Esta página agora é apenas um DASHBOARD de leitura.
 *
 * Responsabilidades desta página:
 *   - Listar itens com saldo atual
 *   - Exibir alertas de estoque baixo
 *   - Permitir ver histórico de movimentações
 *   - Link para /estoque (gerenciamento) e /gira/[id]/consumo (operação)
 *
 * O que foi REMOVIDO daqui:
 *   - Criação de itens → movido para /estoque
 *   - Movimentações manuais → movido para /estoque
 *   - Registro de consumo → movido para /gira/[id]/consumo
 *   - Finalização de gira → movido para /gira/[id]/consumo
 *
 * Motivo: separação de responsabilidades e redução de sobrecarga cognitiva
 * para usuários não-técnicos (médiuns do terreiro).
 */

import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { listarItens, getHistoricoItem } from '../services/api';
import { handleApiError } from '../services/errorHandler';
import { useGiraAtual } from '../contexts/GiraContext';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Formata 'YYYY-MM-DD' em 'DD/MM/YYYY' sem problemas de fuso horário */
function formatarData(dataStr) {
  if (!dataStr) return '';
  const [y, m, d] = dataStr.split('-');
  return `${d}/${m}/${y}`;
}

/** Retorna estilo de cor com base no saldo e threshold */
function getCorSaldo(saldo, threshold) {
  if (saldo === null || saldo === undefined) return 'var(--cor-texto-suave)';
  if (threshold > 0 && saldo <= threshold) return '#ef4444'; // vermelho: abaixo do mínimo
  if (saldo === 0) return '#94a3b8'; // cinza: zerado
  return '#10b981'; // verde: ok
}

// ── Badge de saldo com cor contextual ─────────────────────────────────────────
function BadgeEstoque({ saldo, threshold }) {
  if (saldo === null || saldo === undefined) {
    return <span className="badge-status badge-cancelado">—</span>;
  }

  const baixo = threshold > 0 && saldo <= threshold;

  if (baixo) {
    return (
      <span style={{
        background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
        color: '#ef4444', borderRadius: '20px', padding: '2px 10px',
        fontSize: '0.78rem', fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', gap: '4px',
      }}>
        ⚠ {saldo}
      </span>
    );
  }

  if (saldo === 0) {
    return (
      <span style={{
        background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)',
        color: '#94a3b8', borderRadius: '20px', padding: '2px 10px',
        fontSize: '0.78rem', fontWeight: 600,
      }}>
        0
      </span>
    );
  }

  return (
    <span style={{
      background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
      color: '#10b981', borderRadius: '20px', padding: '2px 10px',
      fontSize: '0.78rem', fontWeight: 600,
    }}>
      {saldo}
    </span>
  );
}

// ── Label amigável da categoria ───────────────────────────────────────────────
const LABEL_CATEGORIA = {
  bebida:       '🥤 Bebida',
  charuto:      '🚬 Charuto',
  cigarro:      '🚬 Cigarro',
  cigarro_palha:'🌿 Cigarro de palha',
  pemba:        '🪨 Pemba',
  vela:         '🕯️ Vela',
  outros:       '📦 Outros',
};

// ── Modal de histórico de movimentações ──────────────────────────────────────
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

  // Label amigável para o tipo de movimentação
  const labelTipo = (type) => ({
    IN:         { label: 'Entrada',  cor: '#10b981', sinal: '+' },
    OUT:        { label: 'Saída',    cor: '#ef4444', sinal: '−' },
    ADJUSTMENT: { label: 'Ajuste',   cor: '#f59e0b', sinal: '±' },
  }[type] || { label: type, cor: '#94a3b8', sinal: '' });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="card-custom"
        style={{ width: '100%', maxWidth: '680px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Cabeçalho do modal */}
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
              Histórico: {item.name}
            </span>
            <span style={{ marginLeft: '1rem', fontSize: '0.8rem', color: 'var(--cor-texto-suave)' }}>
              Saldo atual:{' '}
              <strong style={{ color: getCorSaldo(item.current_stock, item.minimum_threshold) }}>
                {item.current_stock ?? '?'} unidades
              </strong>
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--cor-texto-suave)', cursor: 'pointer', fontSize: '1.2rem' }}
          >
            ×
          </button>
        </div>

        {/* Conteúdo rolável */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <div className="spinner-gold"></div>
            </div>
          )}
          {!loading && historico.length === 0 && (
            <div className="empty-state"><p>Nenhuma movimentação registrada.</p></div>
          )}
          {historico.length > 0 && (
            <table className="table-custom">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Quantidade</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {historico.map(m => {
                  const info = labelTipo(m.type);
                  return (
                    <tr key={m.id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--cor-texto-suave)' }}>
                        {new Date(m.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.78rem', fontWeight: 600, color: info.cor,
                          background: `${info.cor}18`, border: `1px solid ${info.cor}30`,
                          borderRadius: '20px', padding: '1px 8px',
                        }}>
                          {info.label}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: info.cor }}>
                        {info.sinal}{m.quantity}
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
// COMPONENTE PRINCIPAL — DASHBOARD DE ESTOQUE (somente leitura)
// ══════════════════════════════════════════════════════════════════════════════
export default function InventarioDashboard() {
  const router              = useRouter();
  const { giraAtual }       = useGiraAtual();

  const [itens, setItens]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [erro, setErro]                 = useState('');
  const [itemHistorico, setItemHistorico] = useState(null);
  const [busca, setBusca]               = useState('');

  // Carrega lista de itens ao montar
  const carregarItens = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const res = await listarItens();
      setItens(res.data);
    } catch (err) {
      setErro(handleApiError(err, 'Carregar itens'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    carregarItens();
  }, [carregarItens, router]);

  // ── Dados derivados ─────────────────────────────────────────────────────────
  // Filtra por busca de texto
  const itensFiltrados = itens.filter(i =>
    i.name.toLowerCase().includes(busca.toLowerCase()) ||
    (LABEL_CATEGORIA[i.category] || '').toLowerCase().includes(busca.toLowerCase())
  );

  const totalAlertas    = itens.filter(i => i.low_stock).length;
  const totalZerados    = itens.filter(i => i.current_stock === 0).length;
  const totalOk         = itens.filter(i => !i.low_stock && (i.current_stock ?? 0) > 0).length;

  return (
    <>
      <Head><title>Estoque | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">

          {/* ── Topbar ── */}
          <div className="topbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>
                Estoque
              </h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>
                Visão geral dos itens disponíveis
              </small>
            </div>

            {/* Ações rápidas na topbar */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link href="/estoque" className="btn-outline-gold" style={{ fontSize: '0.85rem', textDecoration: 'none' }}>
                <i className="bi bi-plus-lg me-1"></i> Gerenciar estoque
              </Link>
              {giraAtual && giraAtual.status !== 'concluida' && (
                <Link
                  href={`/gira/${giraAtual.id}/consumo`}
                  className="btn-gold"
                  style={{ fontSize: '0.85rem', textDecoration: 'none' }}
                >
                  <i className="bi bi-stars me-1"></i> Ir para: {giraAtual.titulo}
                </Link>
              )}
            </div>
          </div>

          <div className="page-content">

            {/* ── Erro ── */}
            {erro && (
              <div className="alert-custom alert-danger-custom mb-4">
                <i className="bi bi-exclamation-triangle me-2"></i>{erro}
              </div>
            )}

            {/* ── Cards de resumo ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>

              <div className="stat-card">
                <div style={{ fontSize: '0.72rem', color: 'var(--cor-acento)', marginBottom: '2px' }}>Total de itens</div>
                <div className="stat-value">{itens.length}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>cadastrados</div>
              </div>

              <div className="stat-card" style={{ borderColor: totalAlertas > 0 ? 'rgba(239,68,68,0.35)' : undefined }}>
                <div style={{ fontSize: '0.72rem', color: totalAlertas > 0 ? '#ef4444' : 'var(--cor-texto-suave)', marginBottom: '2px' }}>
                  ⚠ Estoque baixo
                </div>
                <div className="stat-value" style={{ color: totalAlertas > 0 ? '#ef4444' : 'var(--cor-texto)' }}>
                  {totalAlertas}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>precisam de atenção</div>
              </div>

              <div className="stat-card">
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '2px' }}>Zerados</div>
                <div className="stat-value" style={{ color: totalZerados > 0 ? '#94a3b8' : 'var(--cor-texto)' }}>
                  {totalZerados}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>sem estoque</div>
              </div>

              <div className="stat-card">
                <div style={{ fontSize: '0.72rem', color: '#10b981', marginBottom: '2px' }}>Abastecidos</div>
                <div className="stat-value" style={{ color: '#10b981' }}>{totalOk}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>em quantidade</div>
              </div>

            </div>

            {/* ── Banner: alertas de estoque baixo ── */}
            {totalAlertas > 0 && (
              <div style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                marginBottom: '1.5rem',
                display: 'flex', alignItems: 'center', gap: '0.75rem',
              }}>
                <span style={{ fontSize: '1.4rem' }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <strong style={{ color: '#ef4444' }}>
                    {totalAlertas} {totalAlertas === 1 ? 'item chegou' : 'itens chegaram'} ao limite mínimo
                  </strong>
                  <div style={{ fontSize: '0.82rem', color: 'var(--cor-texto-suave)', marginTop: '2px' }}>
                    Esses itens precisam ser reabastecidos antes da próxima gira.
                  </div>
                </div>
                <Link
                  href="/estoque"
                  style={{
                    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                    color: '#ef4444', borderRadius: '8px', padding: '0.4rem 1rem',
                    textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Abastecer →
                </Link>
              </div>
            )}

            {/* ── Banner: gira ativa ── */}
            {giraAtual && giraAtual.status !== 'concluida' && (
              <div style={{
                background: 'rgba(212,175,55,0.07)',
                border: '1px solid rgba(212,175,55,0.25)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                marginBottom: '1.5rem',
                display: 'flex', alignItems: 'center', gap: '0.75rem',
              }}>
                <i className="bi bi-stars" style={{ fontSize: '1.3rem', color: 'var(--cor-acento)', flexShrink: 0 }}></i>
                <div style={{ flex: 1 }}>
                  <strong style={{ color: 'var(--cor-acento)' }}>
                    Gira ativa: {giraAtual.titulo}
                  </strong>
                  <div style={{ fontSize: '0.82rem', color: 'var(--cor-texto-suave)', marginTop: '2px' }}>
                    {formatarData(giraAtual.data)} · Status: {giraAtual.status}
                  </div>
                </div>
                <Link
                  href={`/gira/${giraAtual.id}/consumo`}
                  className="btn-gold"
                  style={{ textDecoration: 'none', fontSize: '0.82rem', padding: '0.4rem 1rem' }}
                >
                  Registrar consumo →
                </Link>
              </div>
            )}

            {/* ── Lista de itens ── */}
            <div className="card-custom">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                  ✦ Todos os itens
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {/* Campo de busca */}
                  <input
                    className="form-control-custom"
                    placeholder="Buscar item..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    style={{ width: '200px', fontSize: '0.85rem' }}
                  />
                  <button
                    className="btn-outline-gold"
                    onClick={carregarItens}
                    disabled={loading}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', whiteSpace: 'nowrap' }}
                  >
                    {loading ? <span className="spinner-border spinner-border-sm"></span> : '↻'}
                  </button>
                </div>
              </div>

              {/* Estado vazio */}
              {!loading && itensFiltrados.length === 0 && (
                <div className="empty-state">
                  <i className="bi bi-box-seam d-block"></i>
                  {busca
                    ? <p>Nenhum item encontrado para "{busca}".</p>
                    : (
                      <>
                        <p>Nenhum item cadastrado ainda.</p>
                        <Link href="/estoque" className="btn-gold" style={{ textDecoration: 'none' }}>
                          Cadastrar primeiro item
                        </Link>
                      </>
                    )
                  }
                </div>
              )}

              {/* Tabela */}
              {itensFiltrados.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-custom">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Categoria</th>
                        <th style={{ textAlign: 'center' }}>Saldo</th>
                        <th style={{ textAlign: 'center' }}>Mínimo</th>
                        <th style={{ textAlign: 'center' }}>Situação</th>
                        <th>Histórico</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensFiltrados.map(item => (
                        <tr
                          key={item.id}
                          style={{ background: item.low_stock ? 'rgba(239,68,68,0.03)' : 'transparent' }}
                        >
                          <td>
                            <strong style={{ fontSize: '0.9rem' }}>{item.name}</strong>
                          </td>
                          <td style={{ color: 'var(--cor-texto-suave)', fontSize: '0.85rem' }}>
                            {LABEL_CATEGORIA[item.category] || item.category}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <BadgeEstoque saldo={item.current_stock} threshold={item.minimum_threshold} />
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--cor-texto-suave)', fontSize: '0.85rem' }}>
                            {item.minimum_threshold > 0 ? item.minimum_threshold : '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {item.low_stock ? (
                              <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>⚠ Baixo</span>
                            ) : (item.current_stock ?? 0) === 0 ? (
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Zerado</span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#10b981' }}>✓ Ok</span>
                            )}
                          </td>
                          <td>
                            <button
                              onClick={() => setItemHistorico(item)}
                              style={{
                                background: 'transparent', border: '1px solid var(--cor-borda)',
                                color: 'var(--cor-texto-suave)', borderRadius: '6px',
                                padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.78rem',
                              }}
                            >
                              Ver histórico
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      <BottomNav />

      {/* Modal de histórico */}
      {itemHistorico && (
        <ModalHistorico item={itemHistorico} onClose={() => setItemHistorico(null)} />
      )}
    </>
  );
}