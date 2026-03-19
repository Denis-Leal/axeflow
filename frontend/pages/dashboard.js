// =====================================================
// dashboard.js — AxeFlow
// Dashboard principal do terreiro.
//
// REFATORAÇÃO ARQUITETURAL:
//   - Chamadas de API extraídas para handlers dedicados
//     (handleConfirmarPresencaFechada, handleConfirmarPresencaPublica)
//   - Sem chamadas diretas a api.post() dentro do JSX
//   - Tratamento de erro centralizado por handler
//   - Estado de loading por gira para feedback visual adequado
// =====================================================

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import NotificationButton from '../components/NotificationButton';
import { listGiras, getMe } from '../services/api';
import api from '../services/api';

export default function Dashboard() {
  const router = useRouter();

  const [giras, setGiras]         = useState([]);
  const [user, setUser]           = useState(null);
  const [loading, setLoading]     = useState(true);

  // giraId → status do usuário logado (fechadas)
  const [minhasPresencas, setMinhasPresencas]             = useState({});
  // giraId → status do usuário logado (públicas)
  const [minhasPresencasPublicas, setMinhasPresencasPublicas] = useState({});
  // giraId → { total: N, confirmados: N }
  const [membrosPublicas, setMembrosPublicas]             = useState({});

  // giraId → boolean — controla loading por botão para evitar duplo clique
  const [confirmandoFechada, setConfirmandoFechada] = useState({});
  const [confirmandoPublica, setConfirmandoPublica] = useState({});

  // ── Carregamento inicial ──────────────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    Promise.all([listGiras(), getMe()])
      .then(([girasRes, userRes]) => {
        setGiras(girasRes.data);
        setUser(userRes.data);
        setLoading(false);

        const userId = userRes.data.id;

        // Presenças em giras FECHADAS
        const fechadas = girasRes.data.filter(
          g => g.acesso === 'fechada' && g.status !== 'concluida'
        );
        if (fechadas.length > 0) {
          carregarPresencasFechadas(fechadas, userId);
        }

        // Presenças em giras PÚBLICAS abertas
        const publicas = girasRes.data.filter(
          g => g.acesso === 'publica' && g.status !== 'concluida'
        );
        if (publicas.length > 0) {
          carregarPresencasPublicas(publicas, userId);
        }
      })
      .catch(err => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          router.push('/login');
        } else {
          setLoading(false);
        }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Funções de carregamento de presenças ─────────────────────────────────

  /**
   * Carrega o status de presença do usuário logado em giras fechadas.
   * Executa em paralelo para todas as giras fechadas ativas.
   */
  function carregarPresencasFechadas(girasLista, userId) {
    Promise.all(
      girasLista.map(g =>
        api.get(`/membros/giras/${g.id}/presenca-membros`)
          .then(r => ({ giraId: g.id, membros: r.data, userId }))
          .catch(() => null)
      )
    ).then(results => {
      const presencas = {};
      results.filter(Boolean).forEach(({ giraId, membros, userId: uid }) => {
        const eu = membros.find(m => m.membro_id === uid);
        presencas[giraId] = eu?.status || 'pendente';
      });
      setMinhasPresencas(presencas);
    }).catch(() => {});
  }

  /**
   * Carrega o status de presença do usuário logado em giras públicas,
   * além das contagens totais de membros confirmados por gira.
   */
  function carregarPresencasPublicas(girasLista, userId) {
    Promise.all(
      girasLista.map(g =>
        api.get(`/membros/giras/${g.id}/presenca-membros-publica`)
          .then(r => ({ giraId: g.id, membros: r.data, userId }))
          .catch(() => null)
      )
    ).then(results => {
      const presencas = {};
      const contagens = {};

      results.filter(Boolean).forEach(({ giraId, membros, userId: uid }) => {
        const eu = membros.find(m => m.membro_id === uid);
        presencas[giraId] = eu?.status || 'pendente';
        contagens[giraId] = {
          total:       membros.length,
          confirmados: membros.filter(m => m.status === 'confirmado').length,
        };
      });

      setMinhasPresencasPublicas(presencas);
      setMembrosPublicas(contagens);
    }).catch(() => {});
  }

  // ── Handlers de confirmação de presença ──────────────────────────────────

  /**
   * Confirma ou cancela a presença do usuário logado em uma gira FECHADA.
   * Atualiza o estado local otimisticamente após resposta da API.
   */
  const handleConfirmarPresencaFechada = useCallback(async (giraId) => {
    // Previne duplo clique durante a requisição
    if (confirmandoFechada[giraId]) return;

    setConfirmandoFechada(prev => ({ ...prev, [giraId]: true }));
    try {
      const { data } = await api.post(`/membros/giras/${giraId}/confirmar-presenca`);
      setMinhasPresencas(prev => ({ ...prev, [giraId]: data.status }));
    } catch (err) {
      console.error('[Dashboard] Erro ao confirmar presença (fechada):', err);
    } finally {
      setConfirmandoFechada(prev => ({ ...prev, [giraId]: false }));
    }
  }, [confirmandoFechada]);

  /**
   * Confirma ou cancela a presença do usuário logado em uma gira PÚBLICA.
   * Atualiza o estado local (status do usuário e contagem de confirmados).
   */
  const handleConfirmarPresencaPublica = useCallback(async (giraId) => {
    // Previne duplo clique durante a requisição
    if (confirmandoPublica[giraId]) return;

    setConfirmandoPublica(prev => ({ ...prev, [giraId]: true }));
    try {
      const { data } = await api.post(`/membros/giras/${giraId}/confirmar-presenca-publica`);

      // Atualiza status do usuário nesta gira
      setMinhasPresencasPublicas(prev => ({ ...prev, [giraId]: data.status }));

      // Atualiza contagem de membros confirmados (+1 ou -1 conforme toggle)
      setMembrosPublicas(prev => {
        const atual = prev[giraId] || { total: 0, confirmados: 0 };
        const delta = data.status === 'confirmado' ? 1 : -1;
        return {
          ...prev,
          [giraId]: {
            ...atual,
            confirmados: Math.max(0, atual.confirmados + delta),
          },
        };
      });
    } catch (err) {
      console.error('[Dashboard] Erro ao confirmar presença (pública):', err);
    } finally {
      setConfirmandoPublica(prev => ({ ...prev, [giraId]: false }));
    }
  }, [confirmandoPublica]);

  // ── Dados derivados ───────────────────────────────────────────────────────

  const proximasGiras    = giras.filter(
    g => g.status === 'aberta' || new Date(g.data) >= new Date()
  );
  const totalConsulentes = giras.reduce((acc, g) => acc + (g.total_inscritos || 0), 0);
  const girasAbertas     = giras.filter(g => g.status === 'aberta').length;

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner-gold"></div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Head><title>Dashboard | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">

          {/* ── Topbar ── */}
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>Dashboard</h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>Visão geral do terreiro</small>
            </div>
            <div className="d-flex align-items-center gap-3">
              <NotificationButton compact />
              <Link href="/giras/nova" className="btn-gold" style={{ fontSize: '0.85rem' }}>
                + Nova Gira
              </Link>
            </div>
          </div>

          <div className="page-content">

            {/* ── Estatísticas ── */}
            <div className="row g-3 mb-4">
              <div className="col-6 col-md-3">
                <div className="card-custom stat-card">
                  <div className="stat-value">{giras.length}</div>
                  <div className="stat-label">Total de Giras</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="card-custom stat-card">
                  <div className="stat-value" style={{ color: '#10b981' }}>{girasAbertas}</div>
                  <div className="stat-label">Giras Abertas</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="card-custom stat-card">
                  <div className="stat-value" style={{ color: 'var(--cor-acento)' }}>{totalConsulentes}</div>
                  <div className="stat-label">Total Inscritos</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="card-custom stat-card">
                  <div className="stat-value" style={{ color: 'var(--cor-secundaria)' }}>
                    {giras.filter(g => g.status === 'concluida').length}
                  </div>
                  <div className="stat-label">Concluídas</div>
                </div>
              </div>
            </div>

            {/* ── Card: Giras FECHADAS — confirmar presença ── */}
            <CardConfirmarPresenca
              giras={giras}
              tipo="fechada"
              titulo="🔒 Giras Fechadas — Confirme sua presença"
              presencas={minhasPresencas}
              confirmando={confirmandoFechada}
              onConfirmar={handleConfirmarPresencaFechada}
            />

            {/* ── Card: Giras PÚBLICAS — confirmar presença ── */}
            <CardConfirmarPresenca
              giras={giras}
              tipo="publica"
              titulo="🌐 Giras Públicas — Confirme sua presença"
              presencas={minhasPresencasPublicas}
              confirmando={confirmandoPublica}
              onConfirmar={handleConfirmarPresencaPublica}
            />

            {/* ── Cards: Próximas Giras ── */}
            {proximasGiras.map(proximaGira => (
              <CardProximaGira
                key={proximaGira.id}
                gira={proximaGira}
                membrosInfo={
                  proximaGira.acesso === 'publica'
                    ? membrosPublicas[proximaGira.id] || null
                    : null
                }
              />
            ))}

            {/* ── Tabela: Giras Recentes ── */}
            <div className="card-custom">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                  ✦ Giras Recentes
                </span>
                <Link href="/giras" style={{ color: 'var(--cor-texto-suave)', fontSize: '0.85rem' }}>
                  Ver todas →
                </Link>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>Título</th>
                      <th>Data</th>
                      <th>Vagas</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {giras.slice(0, 5).map(g => (
                      <tr key={g.id}>
                        <td><strong>{g.titulo}</strong></td>
                        <td>{new Date(g.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                        <td>{g.total_inscritos}/{g.limite_consulentes || g.limite_membros}</td>
                        <td><span className={`badge-status badge-${g.status}`}>{g.status}</span></td>
                        <td>
                          <Link href={`/giras/${g.id}`} className="btn-outline-gold"
                            style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem' }}>
                            Ver
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {giras.length === 0 && (
                      <tr><td colSpan="5">
                        <div className="empty-state">
                          <i className="bi bi-stars d-block"></i>
                          <p>Nenhuma gira criada ainda</p>
                          <Link href="/giras/nova" className="btn-gold">Criar primeira gira</Link>
                        </div>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

/**
 * Card de confirmação de presença (fechadas ou públicas).
 * Renderiza nada se não houver giras pendentes/confirmadas.
 *
 * @param {object[]} giras       - lista completa de giras
 * @param {'fechada'|'publica'}  tipo
 * @param {string}   titulo      - título do card
 * @param {object}   presencas   - mapa giraId → status
 * @param {object}   confirmando - mapa giraId → boolean (loading por gira)
 * @param {Function} onConfirmar - handler(giraId)
 */
function CardConfirmarPresenca({ giras, tipo, titulo, presencas, confirmando, onConfirmar }) {
  // Filtra apenas giras do tipo e que ainda precisam de ação
  const pendentes = giras.filter(g =>
    g.acesso === tipo &&
    g.status !== 'concluida' &&
    (presencas[g.id] === 'pendente' || presencas[g.id] === 'confirmado')
  );

  if (pendentes.length === 0) return null;

  return (
    <div className="card-custom mb-4">
      <div className="card-header">
        <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
          {titulo}
        </span>
      </div>
      <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {pendentes.map(g => {
          const jaConfirmei  = presencas[g.id] === 'confirmado';
          const emAndamento  = Boolean(confirmando[g.id]);

          return (
            <div
              key={g.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.65rem 0.75rem', borderRadius: '8px', flexWrap: 'wrap', gap: '0.5rem',
                background: jaConfirmei ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${jaConfirmei ? 'rgba(16,185,129,0.2)' : 'var(--cor-borda)'}`,
              }}
            >
              {/* Título e data da gira */}
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--cor-texto)' }}>
                  {g.titulo}
                </span>
                <span style={{ marginLeft: '0.6rem', fontSize: '0.75rem', color: 'var(--cor-texto-suave)' }}>
                  {new Date(g.data + 'T00:00:00').toLocaleDateString('pt-BR', {
                    day: '2-digit', month: 'short',
                  })} às {g.horario?.slice(0, 5)}
                </span>
              </div>

              {/* Botão de ação — desabilitado durante a requisição */}
              <button
                onClick={() => onConfirmar(g.id)}
                disabled={emAndamento}
                style={{
                  padding: '0.35rem 1rem', borderRadius: '6px',
                  cursor: emAndamento ? 'not-allowed' : 'pointer',
                  fontWeight: 600, fontSize: '0.82rem', opacity: emAndamento ? 0.7 : 1,
                  background: jaConfirmei ? 'rgba(16,185,129,0.15)' : 'rgba(212,175,55,0.12)',
                  border: `1px solid ${jaConfirmei ? 'rgba(16,185,129,0.4)' : 'rgba(212,175,55,0.3)'}`,
                  color: jaConfirmei ? '#10b981' : 'var(--cor-acento)',
                }}
              >
                {emAndamento
                  ? <span className="spinner-border spinner-border-sm" style={{ width: '0.75rem', height: '0.75rem' }} />
                  : jaConfirmei ? '✓ Confirmado — cancelar?' : '+ Confirmar presença'
                }
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Card de próxima gira com barra de vagas e (para públicas) barra de membros.
 *
 * @param {object}      gira        - objeto da gira
 * @param {object|null} membrosInfo - { total, confirmados } ou null (só para públicas)
 */
function CardProximaGira({ gira, membrosInfo }) {
  const limiteVagas = gira.acesso === 'publica' ? gira.limite_consulentes : gira.limite_membros;
  const pctVagas    = limiteVagas > 0
    ? Math.min(100, (gira.total_inscritos / limiteVagas) * 100)
    : 0;

  return (
    <div className="card-custom mb-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
          ✦ Próxima Gira — {gira.acesso === 'publica' ? 'Pública' : 'Fechada'}
        </span>
        <span className={`badge-status badge-${gira.status}`}>{gira.status}</span>
      </div>

      <div className="p-3 d-flex justify-content-between align-items-center">
        <div>
          <h5 style={{ margin: 0, fontFamily: 'Cinzel', color: 'var(--cor-texto)' }}>
            {gira.titulo}
          </h5>
          <small style={{ color: 'var(--cor-texto-suave)' }}>
            <i className="bi bi-calendar3 me-1"></i>
            {new Date(gira.data + 'T00:00:00').toLocaleDateString('pt-BR')} às {gira.horario}
          </small>
        </div>

        <div style={{ textAlign: 'right' }}>
          {/* Contador de vagas de consulentes/membros */}
          <div style={{ color: 'var(--cor-acento)', fontFamily: 'Cinzel', fontSize: '1.5rem' }}>
            {gira.total_inscritos}/{limiteVagas}
          </div>
          <small style={{ color: 'var(--cor-texto-suave)' }}>vagas ocupadas</small>

          {/* Contador de membros confirmados — apenas giras públicas */}
          {membrosInfo && (
            <div style={{ marginTop: '0.4rem' }}>
              <div style={{ color: 'var(--cor-secundaria)', fontFamily: 'Cinzel', fontSize: '1.1rem' }}>
                {membrosInfo.confirmados}/{membrosInfo.total}
              </div>
              <small style={{ color: 'var(--cor-texto-suave)' }}>membros confirmados</small>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '0 1rem 1rem' }}>
        {/* Barra de vagas de consulentes/membros */}
        <div className="vagas-bar">
          <div className="vagas-fill" style={{ width: `${pctVagas}%` }} />
        </div>

        {/* Barra de membros confirmados — apenas giras públicas com membros */}
        {membrosInfo && membrosInfo.total > 0 && (
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <small style={{ color: 'var(--cor-texto-suave)', fontSize: '0.72rem' }}>
                membros confirmados
              </small>
              <small style={{ color: 'var(--cor-texto-suave)', fontSize: '0.72rem' }}>
                {membrosInfo.confirmados}/{membrosInfo.total}
              </small>
            </div>
            <div className="vagas-bar" style={{ height: '5px', opacity: 0.7 }}>
              <div
                className="vagas-fill"
                style={{
                  width: `${Math.min(100, (membrosInfo.confirmados / membrosInfo.total) * 100)}%`,
                  // Cor diferente para distinguir visualmente da barra de consulentes
                  background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}