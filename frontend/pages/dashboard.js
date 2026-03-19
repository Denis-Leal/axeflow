// =====================================================
// dashboard.js — AxeFlow
// Dashboard principal do terreiro.
//
// ADIÇÕES (sem alterar o que já existe):
//   1. Carrega presenças de membros em giras PÚBLICAS abertas
//      (além das fechadas que já eram carregadas)
//   2. Card "🌐 Giras Públicas — Confirme sua presença"
//      mesmo comportamento do card de giras fechadas
//   3. Card "Próxima Gira - Pública" ganha seção de membros:
//      contador X/Y membros confirmados (logo abaixo da barra de vagas)
// =====================================================

import { useEffect, useState } from 'react';
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
  const [giras, setGiras]                 = useState([]);
  const [user, setUser]                   = useState(null);
  const [loading, setLoading]             = useState(true);
  // giraId → status do usuário logado (fechadas)
  const [minhasPresencas, setMinhasPresencas] = useState({});
  // giraId → status do usuário logado (públicas) — NOVO
  const [minhasPresencasPublicas, setMinhasPresencasPublicas] = useState({});
  // giraId → { total: N, confirmados: N } — NOVO
  const [membrosPublicas, setMembrosPublicas] = useState({});

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    Promise.all([listGiras(), getMe()])
      .then(([girasRes, userRes]) => {
        setGiras(girasRes.data);
        setUser(userRes.data);
        setLoading(false);

        const userId = userRes.data.id;

        // ── Presenças em giras FECHADAS (comportamento existente) ──────────
        const fechadas = girasRes.data.filter(
          g => g.acesso === 'fechada' && g.status !== 'concluida'
        );
        if (fechadas.length > 0) {
          Promise.all(
            fechadas.map(g =>
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

        // ── Presenças em giras PÚBLICAS abertas (NOVO) ─────────────────────
        const publicas = girasRes.data.filter(
          g => g.acesso === 'publica' && g.status !== 'concluida'
        );
        if (publicas.length > 0) {
          Promise.all(
            publicas.map(g =>
              api.get(`/membros/giras/${g.id}/presenca-membros-publica`)
                .then(r => ({ giraId: g.id, membros: r.data, userId }))
                .catch(() => null)
            )
          ).then(results => {
            const presencas = {};
            const contagens = {};
            results.filter(Boolean).forEach(({ giraId, membros, userId: uid }) => {
              // Status do usuário logado nesta gira pública
              const eu = membros.find(m => m.membro_id === uid);
              presencas[giraId] = eu?.status || 'pendente';
              // Contagem total de membros e quantos confirmaram
              contagens[giraId] = {
                total:       membros.length,
                confirmados: membros.filter(m => m.status === 'confirmado').length,
              };
            });
            setMinhasPresencasPublicas(presencas);
            setMembrosPublicas(contagens);
          }).catch(() => {});
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
  }, []);

  const proximasGiras = giras.filter(
    g => g.status === 'aberta' || new Date(g.data) >= new Date()
  );
  const totalConsulentes = giras.reduce((acc, g) => acc + (g.total_inscritos || 0), 0);
  const girasAbertas     = giras.filter(g => g.status === 'aberta').length;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner-gold"></div>
    </div>
  );

  return (
    <>
      <Head><title>Dashboard | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">
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

            {/* ── Estatísticas ──────────────────────────────────────── */}
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

            {/* ── Card: Giras FECHADAS — confirmar presença (existente) ─ */}
            {(() => {
              const fechadasPendentes = giras.filter(g =>
                g.acesso === 'fechada' &&
                g.status !== 'concluida' &&
                (minhasPresencas[g.id] === 'pendente' || minhasPresencas[g.id] === 'confirmado')
              );
              if (fechadasPendentes.length === 0) return null;
              return (
                <div className="card-custom mb-4">
                  <div className="card-header">
                    <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                      🔒 Giras Fechadas — Confirme sua presença
                    </span>
                  </div>
                  <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {fechadasPendentes.map(g => {
                      const meuStatus  = minhasPresencas[g.id] || 'pendente';
                      const jaConfirmei = meuStatus === 'confirmado';
                      return (
                        <div key={g.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.65rem 0.75rem', borderRadius: '8px', flexWrap: 'wrap', gap: '0.5rem',
                          background: jaConfirmei ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${jaConfirmei ? 'rgba(16,185,129,0.2)' : 'var(--cor-borda)'}`,
                        }}>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--cor-texto)' }}>
                              {g.titulo}
                            </span>
                            <span style={{ marginLeft: '0.6rem', fontSize: '0.75rem', color: 'var(--cor-texto-suave)' }}>
                              {new Date(g.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às {g.horario?.slice(0, 5)}
                            </span>
                          </div>
                          <button
                            onClick={async () => {
                              const r = await api.post(`/membros/giras/${g.id}/confirmar-presenca`);
                              setMinhasPresencas(prev => ({ ...prev, [g.id]: r.data.status }));
                            }}
                            style={{
                              padding: '0.35rem 1rem', borderRadius: '6px', cursor: 'pointer',
                              fontWeight: 600, fontSize: '0.82rem',
                              background: jaConfirmei ? 'rgba(16,185,129,0.15)' : 'rgba(212,175,55,0.12)',
                              border: `1px solid ${jaConfirmei ? 'rgba(16,185,129,0.4)' : 'rgba(212,175,55,0.3)'}`,
                              color: jaConfirmei ? '#10b981' : 'var(--cor-acento)',
                            }}>
                            {jaConfirmei ? '✓ Confirmado — cancelar?' : '+ Confirmar presença'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── Card: Giras PÚBLICAS — confirmar presença (NOVO) ──── */}
            {(() => {
              const publicasPendentes = giras.filter(g =>
                g.acesso === 'publica' &&
                g.status !== 'concluida' &&
                (
                  minhasPresencasPublicas[g.id] === 'pendente' ||
                  minhasPresencasPublicas[g.id] === 'confirmado'
                )
              );
              if (publicasPendentes.length === 0) return null;
              return (
                <div className="card-custom mb-4">
                  <div className="card-header">
                    <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                      🌐 Giras Públicas — Confirme sua presença
                    </span>
                  </div>
                  <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {publicasPendentes.map(g => {
                      const meuStatus   = minhasPresencasPublicas[g.id] || 'pendente';
                      const jaConfirmei = meuStatus === 'confirmado';
                      return (
                        <div key={g.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.65rem 0.75rem', borderRadius: '8px', flexWrap: 'wrap', gap: '0.5rem',
                          background: jaConfirmei ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${jaConfirmei ? 'rgba(16,185,129,0.2)' : 'var(--cor-borda)'}`,
                        }}>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--cor-texto)' }}>
                              {g.titulo}
                            </span>
                            <span style={{ marginLeft: '0.6rem', fontSize: '0.75rem', color: 'var(--cor-texto-suave)' }}>
                              {new Date(g.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às {g.horario?.slice(0, 5)}
                            </span>
                          </div>
                          <button
                            onClick={async () => {
                              const r = await api.post(`/membros/giras/${g.id}/confirmar-presenca-publica`);
                              // Atualiza status do usuário e recontagem de confirmados
                              setMinhasPresencasPublicas(prev => ({ ...prev, [g.id]: r.data.status }));
                              setMembrosPublicas(prev => {
                                const atual = prev[g.id] || { total: 0, confirmados: 0 };
                                const delta = r.data.status === 'confirmado' ? 1 : -1;
                                return {
                                  ...prev,
                                  [g.id]: {
                                    ...atual,
                                    confirmados: Math.max(0, atual.confirmados + delta),
                                  },
                                };
                              });
                            }}
                            style={{
                              padding: '0.35rem 1rem', borderRadius: '6px', cursor: 'pointer',
                              fontWeight: 600, fontSize: '0.82rem',
                              background: jaConfirmei ? 'rgba(16,185,129,0.15)' : 'rgba(212,175,55,0.12)',
                              border: `1px solid ${jaConfirmei ? 'rgba(16,185,129,0.4)' : 'rgba(212,175,55,0.3)'}`,
                              color: jaConfirmei ? '#10b981' : 'var(--cor-acento)',
                            }}>
                            {jaConfirmei ? '✓ Confirmado — cancelar?' : '+ Confirmar presença'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── Cards: Próximas Giras ─────────────────────────────── */}
            {proximasGiras.length > 0 && (
              proximasGiras.map(proximaGira => {
                // Dados de membros para gira pública (NOVO)
                const membrosInfo = proximaGira.acesso === 'publica'
                  ? membrosPublicas[proximaGira.id] || null
                  : null;

                return (
                  <div key={proximaGira.id} className="card-custom mb-4">
                    <div className="card-header d-flex justify-content-between align-items-center">
                      <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                        ✦ Próxima Gira - {proximaGira.acesso === 'publica' ? 'Pública' : 'Fechada'}
                      </span>
                      <span className={`badge-status badge-${proximaGira.status}`}>{proximaGira.status}</span>
                    </div>

                    <div className="p-3 d-flex justify-content-between align-items-center">
                      <div>
                        <h5 style={{ margin: 0, fontFamily: 'Cinzel', color: 'var(--cor-texto)' }}>
                          {proximaGira.titulo}
                        </h5>
                        <small style={{ color: 'var(--cor-texto-suave)' }}>
                          <i className="bi bi-calendar3 me-1"></i>
                          {new Date(proximaGira.data + 'T00:00:00').toLocaleDateString('pt-BR')} às {proximaGira.horario}
                        </small>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {/* Vagas de consulentes (comportamento existente) */}
                        <div style={{ color: 'var(--cor-acento)', fontFamily: 'Cinzel', fontSize: '1.5rem' }}>
                          {proximaGira.acesso === 'publica'
                            ? `${proximaGira.total_inscritos}/${proximaGira.limite_consulentes}`
                            : `${proximaGira.total_inscritos}/${proximaGira.limite_membros}`}
                        </div>
                        <small style={{ color: 'var(--cor-texto-suave)' }}>vagas ocupadas</small>

                        {/* Contador de membros — apenas giras públicas (NOVO) */}
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

                    {/* Barra de progresso de consulentes (comportamento existente) */}
                    <div style={{ padding: '0 1rem 1rem' }}>
                      <div className="vagas-bar">
                        {proximaGira.acesso === 'publica'
                          ? <div className="vagas-fill" style={{ width: `${Math.min(100, (proximaGira.total_inscritos / proximaGira.limite_consulentes) * 100)}%` }}></div>
                          : <div className="vagas-fill" style={{ width: `${Math.min(100, (proximaGira.total_inscritos / proximaGira.limite_membros) * 100)}%` }}></div>
                        }
                      </div>

                      {/* Barra de progresso de membros — apenas giras públicas (NOVO) */}
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
                                // Cor levemente diferente para distinguir da barra de consulentes
                                background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                              }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* ── Tabela: Giras Recentes (existente) ───────────────── */}
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