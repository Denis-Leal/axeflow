/**
 * pages/inventario.js — AxeFlow
 * Dashboard de leitura do estoque.
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
import InventarioCard from '../components/inventario/InventarioCard';
import InventarioTable from '../components/inventario/InventarioTable';
import {
  Button, Card, CardHeader, CardBody,
  StatCard, EmptyState, Spinner,
} from '../components/ui';
import { useMediaQuery } from '../hooks/useMediaQuery';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatarData(dataStr) {
  if (!dataStr) return '';
  const [y, m, d] = dataStr.split('-');
  return `${d}/${m}/${y}`;
}

function getCorSaldo(saldo, threshold) {
  if (saldo === null || saldo === undefined) return 'var(--cor-texto-suave)';
  if (threshold > 0 && saldo <= threshold) return '#ef4444';
  if (saldo === 0) return '#94a3b8';
  return '#10b981';
}

// ── Label amigável da movimentação ────────────────────────────────────────────
function labelTipo(type) {
  return ({
    IN:         { label: 'Entrada',  cor: '#10b981', sinal: '+' },
    OUT:        { label: 'Saída',    cor: '#ef4444', sinal: '−' },
    ADJUSTMENT: { label: 'Ajuste',   cor: '#f59e0b', sinal: '±' },
  }[type] || { label: type, cor: '#94a3b8', sinal: '' });
}

// ── Modal de histórico ────────────────────────────────────────────────────────
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
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: '1rem',
      }}
    >
      <Card
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '680px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <CardHeader style={{ justifyContent: 'space-between' }}>
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
          <Button variant="ghost" size="sm" onClick={onClose} style={{ fontSize: '1.2rem', padding: '0 0.4rem' }}>
            ×
          </Button>
        </CardHeader>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <Spinner center />
            </div>
          )}

          {!loading && historico.length === 0 && (
            <EmptyState icon="clock-history" title="Nenhuma movimentação registrada." />
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
      </Card>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function InventarioDashboard() {
  const router        = useRouter();
  const { giraAtual } = useGiraAtual();
  const isDesktop     = useMediaQuery('(min-width: 768px)');

  const [itens, setItens]                   = useState([]);
  const [loading, setLoading]               = useState(true);
  const [erro, setErro]                     = useState('');
  const [itemHistorico, setItemHistorico]   = useState(null);
  const [busca, setBusca]                   = useState('');

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

  const itensFiltrados = itens.filter(i =>
    i.name.toLowerCase().includes(busca.toLowerCase()) ||
    (i.category || '').toLowerCase().includes(busca.toLowerCase())
  );

  const totalAlertas = itens.filter(i => i.low_stock).length;
  const totalZerados = itens.filter(i => i.current_stock === 0).length;
  const totalOk      = itens.filter(i => !i.low_stock && (i.current_stock ?? 0) > 0).length;

  return (
    <>
      <Head><title>Estoque | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">

          {/* Topbar */}
          <div className="topbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>
                Estoque
              </h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>
                Visão geral dos itens disponíveis
              </small>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button variant="outline" size="sm" href="/estoque" as="a">
                <i className="bi bi-plus-lg" /> Gerenciar estoque
              </Button>
              {giraAtual && giraAtual.status !== 'concluida' && (
                <Button variant="primary" size="sm" href={`/giras/${giraAtual.id}/consumo`} as="a">
                  <i className="bi bi-stars" /> Ir para: {giraAtual.titulo}
                </Button>
              )}
            </div>
          </div>

          <div className="page-content">

            {/* Erro */}
            {erro && (
              <div className="alert-custom alert-danger-custom mb-4">
                <i className="bi bi-exclamation-triangle me-2" />{erro}
              </div>
            )}

            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <StatCard label="Total de itens"  value={itens.length} sub="cadastrados" />
              <StatCard
                label="⚠ Estoque baixo"
                value={totalAlertas}
                sub="precisam de atenção"
                color={totalAlertas > 0 ? '#ef4444' : undefined}
                style={{ borderColor: totalAlertas > 0 ? 'rgba(239,68,68,0.35)' : undefined }}
              />
              <StatCard
                label="Zerados"
                value={totalZerados}
                sub="sem estoque"
                color={totalZerados > 0 ? '#94a3b8' : undefined}
              />
              <StatCard label="Abastecidos" value={totalOk} sub="em quantidade" color="#10b981" />
            </div>

            {/* Banner: alertas de estoque baixo */}
            {totalAlertas > 0 && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.5rem',
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
                <Button variant="danger" size="sm" href="/estoque" as="a">
                  Abastecer →
                </Button>
              </div>
            )}

            {/* Banner: gira ativa */}
            {giraAtual && giraAtual.status !== 'concluida' && (
              <div style={{
                background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.25)',
                borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.5rem',
                display: 'flex', alignItems: 'center', gap: '0.75rem',
              }}>
                <i className="bi bi-stars" style={{ fontSize: '1.3rem', color: 'var(--cor-acento)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <strong style={{ color: 'var(--cor-acento)' }}>
                    Gira ativa: {giraAtual.titulo}
                  </strong>
                  <div style={{ fontSize: '0.82rem', color: 'var(--cor-texto-suave)', marginTop: '2px' }}>
                    {formatarData(giraAtual.data)} · Status: {giraAtual.status}
                  </div>
                </div>
                <Button variant="primary" size="sm" href={`/giras/${giraAtual.id}/consumo`} as="a">
                  Registrar consumo →
                </Button>
              </div>
            )}

            {/* Lista de itens */}
            <Card>
              <CardHeader style={{ justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                  ✦ Todos os itens
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    className="form-control-custom"
                    placeholder="Buscar item..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    style={{ width: '200px', fontSize: '0.85rem' }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={carregarItens}
                    disabled={loading}
                    loading={loading}
                  >
                    ↻
                  </Button>
                </div>
              </CardHeader>

              {loading && (
                <CardBody>
                  <Spinner center />
                </CardBody>
              )}

              {!loading && itensFiltrados.length === 0 && (
                <EmptyState
                  icon="box-seam"
                  title={busca ? `Nenhum item encontrado para "${busca}".` : 'Nenhum item cadastrado ainda.'}
                  action={!busca && (
                    <Button variant="primary" size="sm" href="/estoque" as="a">
                      Cadastrar primeiro item
                    </Button>
                  )}
                />
              )}

              {!loading && itensFiltrados.length > 0 && (
                isDesktop
                  ? <InventarioTable itens={itensFiltrados} onVerHistorico={setItemHistorico} />
                  : (
                    <CardBody>
                      {itensFiltrados.map(item => (
                        <InventarioCard key={item.id} item={item} onVerHistorico={setItemHistorico} />
                      ))}
                    </CardBody>
                  )
              )}
            </Card>

          </div>
        </div>
      </div>

      <BottomNav />

      {itemHistorico && (
        <ModalHistorico item={itemHistorico} onClose={() => setItemHistorico(null)} />
      )}
    </>
  );
}