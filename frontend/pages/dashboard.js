/**
 * pages/dashboard.js — AxeFlow (REFATORADO)
 *
 * MUDANÇAS:
 * - useDashboard() centraliza toda a lógica de dados
 * - buildDashboardViewModel() transforma antes do JSX
 * - Mobile: centro de ação (próxima gira em destaque)
 * - Desktop: layout original melhorado
 * - Sem dados crus no JSX
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import { StatCard, ProgressBar, Badge, Spinner, CardHeader, Card, CardBody } from '../components/ui';
import { useDashboard } from '../hooks/useDashboard';
import { useIsMobile } from '../hooks/useMediaQuery';
import { buildDashboardViewModel } from '../viewModels/giraViewModel';

// ── Sub-componentes ───────────────────────────────────────────────────────────

function ProximaGiraCard({ gira, minhaPresenca, jaConfirmei, confirmando, onConfirmar }) {
  console.log("Tipo de gira: ", gira)
  if (!gira) return null;

  return (
    <div style={{
      background:    'linear-gradient(135deg, rgba(107,33,168,0.2), rgba(212,175,55,0.08))',
      border:        '1px solid rgba(212,175,55,0.3)',
      borderRadius:  '14px',
      overflow:      'hidden',
      marginBottom:  '1rem',
    }}>
      <div style={{ padding: '1rem' }}>
        <div style={{ fontSize: '0.68rem', color: 'var(--cor-acento)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.3rem', fontWeight: 700 }}>
          ✦ Próxima Gira
        </div>
        <div style={{ fontFamily: 'Cinzel', fontSize: '1.15rem', color: 'var(--cor-texto)', marginBottom: '0.25rem' }}>
          {gira.titulo}
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--cor-texto-suave)', marginBottom: '0.75rem' }}>
          <i className="bi bi-calendar3 me-1" />{gira.dataFormatada} às {gira.horarioFmt}
          {' · '}{gira.acessoIcon} {gira.acessoLabel}
        </div>

        {/* Barra de vagas */}
        {gira.acesso == "publica" && (
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.78rem', color: 'var(--cor-texto-suave)' }}>
              <span>Vagas</span>
              <span style={{ fontWeight: 700 }}>{gira.vagasOcupadas}</span>
            </div>
            <ProgressBar ratio={gira.ratio} />
          </div>
        )}

        {/* Ação principal: confirmar presença */}
        {gira.podeCofirmar && (
          <button
            onClick={onConfirmar}
            disabled={confirmando}
            style={{
              width:       '100%',
              padding:     '0.7rem',
              borderRadius:'10px',
              border:      `1px solid ${jaConfirmei ? 'rgba(16,185,129,0.5)' : 'rgba(212,175,55,0.5)'}`,
              background:  jaConfirmei ? 'rgba(16,185,129,0.15)' : 'rgba(212,175,55,0.15)',
              color:       jaConfirmei ? '#10b981' : 'var(--cor-acento)',
              fontWeight:  700,
              fontSize:    '0.9rem',
              cursor:      confirmando ? 'wait' : 'pointer',
              display:     'flex',
              alignItems:  'center',
              justifyContent: 'center',
              gap:         '0.5rem',
            }}
          >
            {confirmando
              ? <span style={{ width: '0.8rem', height: '0.8rem', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
              : <i className={`bi bi-${jaConfirmei ? 'check-circle-fill' : 'check-circle'}`} />
            }
            {jaConfirmei ? 'Presença confirmada — cancelar?' : 'Confirmar minha presença'}
          </button>
        )}
      </div>

      {/* Ações secundárias */}
      <div style={{
        borderTop:   '1px solid rgba(212,175,55,0.15)',
        padding:     '0.6rem 1rem',
        display:     'flex',
        gap:         '0.5rem',
      }}>
        <Link
          href={`/giras/${gira.id}`}
          style={{
            flex: 1, textAlign: 'center', padding: '0.4rem',
            borderRadius: '8px', border: '1px solid var(--cor-borda)',
            color: 'var(--cor-texto-suave)', textDecoration: 'none',
            fontSize: '0.78rem',
          }}
        >
          <i className="bi bi-list-ul me-1" />Inscrições
        </Link>
        {gira.slugPublico && (
          <Link
            href={`/giras/${gira.slugPublico}/inscricoes`}
            style={{
              flex: 1, textAlign: 'center', padding: '0.4rem',
              borderRadius: '8px', border: '1px solid var(--cor-borda)',
              color: 'var(--cor-texto-suave)', textDecoration: 'none',
              fontSize: '0.78rem',
            }}
          >
            <i className="bi bi-person-plus me-1" />Inscrever
          </Link>
        )}
      </div>
    </div>
  );
}

function PresencaItem({ gira, jaConfirmei, confirmando, onConfirmar }) {
  return (
    <div style={{
      display:     'flex',
      alignItems:  'center',
      justifyContent: 'space-between',
      padding:     '0.65rem 0.75rem',
      borderRadius:'8px',
      background:  jaConfirmei ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
      border:      `1px solid ${jaConfirmei ? 'rgba(16,185,129,0.2)' : 'var(--cor-borda)'}`,
      gap:         '0.5rem',
      flexWrap:    'wrap',
      marginBottom:'0.4rem',
    }}>
      <div>
        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{gira.titulo}</span>
        <span style={{ marginLeft: '0.6rem', fontSize: '0.75rem', color: 'var(--cor-texto-suave)' }}>
          {gira.dataCompacta} às {gira.horarioFmt}
        </span>
      </div>
      <button
        onClick={onConfirmar}
        disabled={confirmando}
        style={{
          padding:     '0.35rem 0.9rem',
          borderRadius:'6px',
          border:      `1px solid ${jaConfirmei ? 'rgba(16,185,129,0.4)' : 'rgba(212,175,55,0.3)'}`,
          background:  jaConfirmei ? 'rgba(16,185,129,0.15)' : 'rgba(212,175,55,0.12)',
          color:       jaConfirmei ? '#10b981' : 'var(--cor-acento)',
          fontWeight:  600,
          fontSize:    '0.82rem',
          cursor:      confirmando ? 'wait' : 'pointer',
        }}
      >
        {confirmando
          ? '...'
          : jaConfirmei ? '✓ Confirmado — cancelar?' : '+ Confirmar presença'
        }
      </button>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const dash = useDashboard();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  if (dash.loading) return <Spinner center />;

  // ViewModel: transforma ANTES de usar no JSX
  const vm = buildDashboardViewModel(
    dash.giras,
    dash.user,
    dash.presencasFechadas,
    dash.presencasPublicas,
    dash.membrosPublicas,
  );

  const confirmarGira = (gira) => {
    if (gira.acesso === 'fechada') dash.confirmarFechada(gira.id);
    else dash.confirmarPublica(gira.id);
  };

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
            <Link href="/giras/nova" className="btn-gold" style={{ fontSize: '0.85rem' }}>
              + Nova Gira
            </Link>
          </div>

          <div className="page-content">

            {/* ── Stats ── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                gap: '0.75rem',
                marginBottom: '1.25rem',
              }}>
              <StatCard size="md" label="Total de Giras"  value={vm.stats.total}     />
              <StatCard size="md" label="Giras Abertas"   value={vm.stats.abertas}   color="#10b981" />
              <StatCard size="md" label="Total Inscritos" value={vm.stats.inscritos} color="var(--cor-acento)" />
              <StatCard size="md" label="Concluídas"      value={vm.stats.concluidas} color="var(--cor-secundaria)" />
            </div>

            {/* ── Próxima Gira (PRIORIDADE no mobile) ── */}
            {vm.proxima && (
              <ProximaGiraCard
                gira={vm.proxima}
                minhaPresenca={vm.proxima.minhaPresenca}
                jaConfirmei={vm.proxima.jaConfirmei}
                confirmando={dash.confirmando[vm.proxima.id]}
                onConfirmar={() => confirmarGira(vm.proxima)}
              />
            )}

            {/* ── Confirmação de presenças (outras giras) ── */}
            {vm.pendentesConfirmacao.length > 1 && (
              <div className="card-custom mb-4">
                <div className="card-header">
                  <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                    ✦ Confirmar Presença
                  </span>
                </div>
                <div style={{ padding: '0.75rem 1rem' }}>
                  {/* Pula a proxima (já mostrada acima) */}
                  {vm.pendentesConfirmacao.slice(1).map(g => (
                    <PresencaItem
                      key={g.id}
                      gira={g}
                      jaConfirmei={g.jaConfirmei}
                      confirmando={dash.confirmando[g.id]}
                      onConfirmar={() => confirmarGira(g)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Histórico (colapsável no mobile) ── */}
            <Card>
                <CardHeader style={{justifyContent: 'space-between'}}>
                  <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                    ✦ Giras Recentes
                  </span>
                  <Link href="/giras" style={{ color: 'var(--cor-texto-suave)', fontSize: '0.85rem' }}>
                    Ver todas →
                  </Link>
                </CardHeader>

              {isMobile ? (
                /* Mobile: lista compacta (sem tabela) */
                <CardBody>
                  {vm.historico.length === 0 && (
                    <p style={{ color: 'var(--cor-texto-suave)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
                      Nenhuma gira concluída ainda
                    </p>
                  )}
                  {vm.historico.map(g => (
                    <Link
                      key={g.id}
                      href={`/giras/${g.id}`}
                      style={{
                        display:     'flex',
                        alignItems:  'center',
                        justifyContent: 'space-between',
                        padding:     '0.6rem 0',
                        borderBottom:'1px solid rgba(61,31,110,0.3)',
                        textDecoration: 'none',
                        color:       'var(--cor-texto)',
                        gap:         '0.5rem',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{g.titulo}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>
                          {g.dataCompacta} · {g.vagasOcupadas} vagas
                        </div>
                      </div>
                      <Badge preset={g.status}>{g.statusLabel}</Badge>
                    </Link>
                  ))}
                </CardBody>
              ) : (
                /* Desktop: tabela */
                <CardBody>
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
                      {vm.giras.slice(0, 5).map(g => (
                        <tr key={g.id}>
                          <td><strong>{g.titulo}</strong></td>
                          <td>{g.dataFormatada}</td>
                          <td>{g.vagasOcupadas}</td>
                          <td><Badge preset={g.status}>{g.statusLabel}</Badge></td>
                          <td>
                            <Link href={`/giras/${g.id}`} className="btn-outline-gold" style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem' }}>
                              Ver
                            </Link>
                          </td>
                        </tr>
                      ))}
                      {vm.giras.length === 0 && (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--cor-texto-suave)' }}>
                            Nenhuma gira ainda.{' '}
                            <Link href="/giras/nova" className="btn-gold">Criar primeira gira</Link>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardBody>
              )}
            </Card>
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}