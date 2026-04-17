import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Sidebar from '../../../components/Sidebar';
import BottomNav from '../../../components/BottomNav';
import AjeumPanel from '../../../components/AjeumPanel';
import ConfirmModal from '../../../components/ConfirmModal';
import InscricaoCard from '../../../components/inscricao/InscricaoCard';
import InscricaoTable from '../../../components/inscricao/InscricaoTable';
import MembrosTable from '../../../components/membro/membroTable';
import MembroCard from '../../../components/membro/membroCard';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Spinner, StatCard, InfoHeader } from '../../../components/ui';
import { useGiraDetalhe } from '../../../hooks/useGiraDetalhe';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { formatDate, formatTime } from '../../../utils/format';
import { useMemo } from 'react';
import { useState } from 'react';
import {
  buildInscricoesComScoreViewModel,
  buildMembrosPresencaViewModel,
  buildGiraDetalheStats,
} from '../../../viewModels/inscricaoViewModel';

// ─── Helpers locais ──────────────────────────────────────────────────────────

// Composicoes locais de Badge permanecem aqui porque representam semantica
// especifica desta tela; o primitivo reutilizavel continua no Design System.
function ScoreBadge({ score }) {
  if (!score) {
    return <Badge preset="pendente">Sem historico</Badge>;
  }

  return (
    <Badge
      title={score.title}
      bg={score.bg}
      color={score.color}
      style={{
        border: `1px solid ${score.border}`,
        fontSize: '0.72rem',
      }}
    >
      {score.label}
    </Badge>
  );
}

function AlertBadge({ score }) {
  if (!score?.alertaLabel) return null;

  return (
    <Badge
      bg="rgba(239,68,68,0.1)"
      color="#ef4444"
      style={{
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: '4px',
        fontSize: '0.68rem',
        padding: '1px 5px',
      }}
    >
      {score.alertaLabel}
    </Badge>
  );
}

function NoteBadge({ text }) {
  if (!text) return null;

  return (
    <Badge
      title={text}
      bg="rgba(212,175,55,0.12)"
      color="#d4af37"
      style={{ marginTop: '4px', border: '1px solid rgba(212,175,55,0.22)', borderRadius: '6px' }}
    >
      <i className="bi bi-chat-left-text me-1" />
      {text}
    </Badge>
  );
}

function ToastPromovido({ item, onClose }) {
  if (!item) return null;

  return (
    <div
      style={{
        margin: '0 1rem 1rem',
        padding: '0.85rem 1rem',
        borderRadius: '10px',
        background: 'rgba(16,185,129,0.08)',
        border: '1px solid rgba(16,185,129,0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}
    >
      <i className="bi bi-check-circle-fill" style={{ color: '#10b981' }} />
      <div style={{ flex: 1, fontSize: '0.82rem' }}>{item.nome} foi promovido(a) da fila.</div>
      {item.whatsappHref && (
        <Button as="a" href={item.whatsappHref} target="_blank" variant="success" size="sm">
          WhatsApp
        </Button>
      )}
      <Button onClick={onClose} variant="ghost" size="sm">
        Fechar
      </Button>
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function GiraInfoHeader({ gira }) {
  console.log("Dados da Gira: ", gira)
  return (
    <InfoHeader
      title={gira.titulo}
      subtitleItems={[
        {
          icon: 'bi-calendar3',
          label: gira.titleLine,
        },
        {
          label: gira.acessoIcon +' '+ gira.acessoLabel,
        },
        ...(gira.tipo ? [{ label: `· ${gira.tipo}` }] : []),
      ]}
      badge={
        <Badge preset={gira.status}>
          {gira.status}
        </Badge>
      }
    />
  );
}

function StatsBar({ stats }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
      gap: '0.5rem',
      marginBottom: '1rem',
    }}>
      <StatCard label="Inscritos" value={stats.ativas} icon="bi-person-check" />
      <StatCard label="Compareceram" value={stats.compareceram} icon="bi-check-circle" color="#10b981" />
      <StatCard label="Faltaram" value={stats.faltaram} icon="bi-x-circle" color="#ef4444" />
      {stats.naFila > 0 && <StatCard label="Fila" value={stats.naFila} icon="bi-hourglass-split" color="#f59e0b" />}
      {stats.alertas > 0 && <StatCard label="Alertas" value={stats.alertas} icon="bi-exclamation-triangle" color="#f97316" />}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function GiraDetalhe() {
  const router = useRouter();
  const isMobile = useIsMobile();

  // const {
  //   gira, user, loading, error,
  //   inscricoes, inscricoesLoading,
  //   marcarPresenca, cancelarInscricao, reativarInscricao,
  //   membrosPresenca, membrosLoading, membrosUpdating,
  //   updateMembro,
  // } = useGiraDetalhe(router.query.id, router);

  const { state, actions, derived } = useGiraDetalhe(router.query.id, router);
  const { marcarPresenca, cancelarInscricao, reativarInscricao, updateMembro } = actions;
  const { loading, inscricoesLoading, membrosLoading } = state;
  const { vm, isAdmin, lista, metricas, membrosPresenca, membrosUpdating } = derived;
  const gira = vm;
  const [abaAtiva, setAbaAtiva] = useState('consulentes'); // 'consulentes' | 'membros'

  // ViewModels — só derivam quando dados chegam
  const inscricoesVM = useMemo(
    () => (vm?.inscricoes?.length ? buildInscricoesComScoreViewModel(vm?.inscricoes) : []),
    [vm?.inscricoes]
  );
  console.log("inscricoesVM-index: ", inscricoesVM)
  const membrosVM = useMemo(
    () => (vm?.membersPanel.lista?.length ? buildMembrosPresencaViewModel(vm?.membersPanel.lista) : []),
    [vm?.membersPanel.lista]
  );
  console.log("membrosVM-index: ", membrosVM)
  const stats = useMemo(
    () => buildGiraDetalheStats(vm?.inscricoes || []),
    [vm?.inscricoes]
  );
  console.log("stats-index: ", stats)
  // ─── Estados de carregamento / erro ───────────────────────────────────────

  if (loading) return <Spinner center />;

  if (!gira) {
    return (
      <div className="container py-5">
        <EmptyState
          icon="bi-exclamation-triangle"
          title="Gira não encontrada"
          message="Verifique o link ou tente novamente."
        />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <Head><title>Inscrições | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>Nova Gira</h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>Cadastrar nova gira</small>
            </div>
            <Link href="/giras" style={{ color: 'var(--cor-texto-suave)', textDecoration: 'none' }}>
              ← Voltar
            </Link>
          </div>

          <div className="page-content">
                {/* Header da gira */}
                <GiraInfoHeader gira={gira} />

              {/* Stats */}
                <StatsBar stats={stats} />

                {/* Abas */}
                <div style={{
                  display: 'flex',
                  borderBottom: '1px solid var(--cor-borda)',
                  marginBottom: '1rem',
                  gap: '0.25rem',
                }}>
                  {['consulentes', 'membros'].map(aba => (
                    <button
                      key={aba}
                      onClick={() => setAbaAtiva(aba)}
                      style={{
                        background: abaAtiva === aba ? 'rgba(212,175,55,0.12)' : 'transparent',
                        border: 'none',
                        borderBottom: abaAtiva === aba ? '2px solid var(--cor-acento)' : '2px solid transparent',
                        color: abaAtiva === aba ? 'var(--cor-acento)' : 'var(--cor-texto-suave)',
                        padding: '0.5rem 1rem',
                        cursor: 'pointer',
                        fontWeight: abaAtiva === aba ? 700 : 400,
                        fontSize: '0.88rem',
                        textTransform: 'capitalize',
                      }}
                    >
                      {aba === 'consulentes'
                        ? `Consulentes (${stats.ativas})`
                        : `Membros (${membrosVM.length})`}
                    </button>
                  ))}
                </div>

                {/* ─── Aba Consulentes ─────────────────────────────────── */}
                {abaAtiva === 'consulentes' && (
                  <>
                    {inscricoesLoading && <div className="text-center py-3"><Spinner /></div>}

                    {!inscricoesLoading && inscricoesVM.length === 0 && (
                      <EmptyState
                        icon="bi-person-x"
                        title="Nenhuma inscrição"
                        message="Ainda não há consulentes inscritos nesta gira."
                      />
                    )}

                    {!inscricoesLoading && inscricoesVM.length > 0 && (
                      isMobile ? (
                        /* Mobile: cards */
                        <div>
                          {inscricoesVM.map(i => (
                            <InscricaoCard
                              key={i.id}
                              inscricao={i}
                              giraTitulo={gira.titulo}
                              podeGerenciar={isAdmin}
                              onPresenca={marcarPresenca}
                              onCancelar={cancelarInscricao}
                              onReativar={reativarInscricao}
                            />
                          ))}
                        </div>
                      ) : (
                        /* Desktop: tabela */
                        <InscricaoTable
                          inscricoes={inscricoesVM}
                          podeGerenciar={isAdmin}
                          onPresenca={marcarPresenca}
                          onCancelar={cancelarInscricao}
                          onReativar={reativarInscricao}
                        />
                      )
                    )}
                  </>
                )}

                {/* ─── Aba Membros ─────────────────────────────────────── */}
                {abaAtiva === 'membros' && (
                  <>
                    {membrosLoading && <div className="text-center py-3"><Spinner /></div>}

                    {!membrosLoading && membrosVM.length === 0 && (
                      <EmptyState
                        icon="bi-people"
                        title="Nenhum membro"
                        message="Nenhum membro registrado para esta gira."
                      />
                    )}

                    {!membrosLoading && membrosVM.length > 0 && (
                      isMobile ? (
                        /* Mobile: cards compactos */
                        <div>
                          {membrosVM.map(m => (
                            <MembroCard
                              key={m.membroId}
                              membro={m}
                              podeGer={isAdmin}
                              onUpdate={updateMembro}
                              updating={membrosUpdating}
                            />
                          ))}
                        </div>
                      ) : (
                        /* Desktop: tabela */
                        <MembrosTable
                          membros={membrosVM}
                          podeGer={isAdmin}
                          onUpdateMembro={updateMembro}
                          updating={membrosUpdating}
                        />
                      )
                    )}
                  </>
                )}
            <BottomNav></BottomNav>
          </div>
        </div>
      </div>
    </>
  );
}