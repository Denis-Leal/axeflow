import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Sidebar from '../../../components/Sidebar';
import BottomNav from '../../../components/BottomNav';
import AjeumPanel from '../../../components/AjeumPanel';
import ConfirmModal from '../../../components/ConfirmModal';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Spinner, StatCard } from '../../../components/ui';
import { useGiraDetalhe } from '../../../hooks/useGiraDetalhe';
import { useIsMobile } from '../../../hooks/useMediaQuery';

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

function MembersPanel({ panel, onToggle }) {
  return (
    <Card style={{ marginBottom: '1rem' }}>
      <CardHeader>
        <span style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)' }}>{panel.titulo}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {panel.badges.map((badge) => (
            <Badge key={badge.id} preset={badge.preset}>
              {badge.label}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardBody style={{ display: 'grid', gap: '0.5rem' }}>
        {panel.lista.length === 0 && <EmptyState icon="people" title={panel.emptyMessage} />}

        {panel.lista.map((member) => (
          <div
            key={member.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '0.75rem',
              alignItems: 'center',
              padding: '0.75rem',
              borderRadius: '10px',
              background: member.rowBg,
              border: `1px solid ${member.rowBorder}`,
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{member.nome}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--cor-texto-suave)' }}>{member.role}</div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge style={{ background: member.rowBg, color: member.textColor }}>
                {member.statusLabel}
              </Badge>
              <Button onClick={() => onToggle(member.id, member.compareceuStatus)} variant="success" size="sm">
                Compareceu
              </Button>
              <Button onClick={() => onToggle(member.id, member.faltouStatus)} variant="danger" size="sm">
                Faltou
              </Button>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function PublicListTable({ lista, actions }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table-custom">
        <thead>
          <tr>
            <th>#</th>
            <th>Nome</th>
            <th>Historico</th>
            <th>Status</th>
            <th className="d-none d-md-table-cell">Inscrito em</th>
            <th>Acoes</th>
          </tr>
        </thead>

        <tbody>
          {lista.map((item) => (
            <tr key={item.id} style={{ background: item.rowBg }}>
              <td style={{ fontFamily: 'Cinzel', color: item.isFila ? '#f59e0b' : 'var(--cor-acento)' }}>
                {item.posicaoLabel}
              </td>

              <td>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>{item.nome}</strong>
                  <AlertBadge score={item.score} />
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--cor-texto-suave)' }}>{item.telefone}</div>
                <NoteBadge text={item.observacoes} />
              </td>

              <td>
                <div style={{ display: 'grid', gap: '4px' }}>
                  <ScoreBadge score={item.score} />
                  <span style={{ fontSize: '0.68rem', color: 'var(--cor-texto-suave)' }}>
                    {item.historicoLabel}
                  </span>
                </div>
              </td>

              <td>
                {item.isFila ? (
                  <Badge preset="lista_espera">Fila de espera</Badge>
                ) : (
                  <Badge preset={item.status}>{item.statusLabel}</Badge>
                )}
              </td>

              <td className="d-none d-md-table-cell" style={{ color: 'var(--cor-texto-suave)', fontSize: '0.8rem' }}>
                {item.inscritoEmLabel}
              </td>

              <td>
                {item.canReactivate ? (
                  <Button onClick={() => actions.handleReativar(item.id, item.nome)} variant="outline" size="sm">
                    Reativar
                  </Button>
                ) : (
                  <div className="d-flex gap-1 flex-wrap">
                    {item.whatsappHref && (
                      <Button as="a" href={item.whatsappHref} target="_blank" variant="success" size="sm">
                        WhatsApp
                      </Button>
                    )}

                    {item.canManagePresence && (
                      <>
                        <Button onClick={() => actions.handlePresenca(item.id, item.compareceuStatus)} variant="success" size="sm">
                          Compareceu
                        </Button>
                        <Button onClick={() => actions.handlePresenca(item.id, item.faltouStatus)} variant="danger" size="sm">
                          Faltou
                        </Button>
                      </>
                    )}

                    <Button onClick={() => actions.handleCancelar(item.id, item.nome)} variant="ghost" size="sm">
                      Cancelar
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PublicListCards({ lista, actions }) {
  return (
    <div style={{ display: 'grid', gap: '0.75rem', padding: '0.75rem' }}>
      {lista.map((item) => (
        <Card key={item.id} style={{ background: item.rowBg || 'var(--cor-card)' }}>
          <CardBody style={{ display: 'grid', gap: '0.65rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'Cinzel', color: item.isFila ? '#f59e0b' : 'var(--cor-acento)' }}>
                    {item.posicaoLabel}
                  </span>
                  <strong>{item.nome}</strong>
                  <AlertBadge score={item.score} />
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--cor-texto-suave)' }}>{item.telefone}</div>
                <NoteBadge text={item.observacoes} />
              </div>

              <div>
                {item.isFila ? (
                  <Badge preset="lista_espera">Fila de espera</Badge>
                ) : (
                  <Badge preset={item.status}>{item.statusLabel}</Badge>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gap: '4px' }}>
              <ScoreBadge score={item.score} />
              <span style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>
                {item.historicoLabel}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>
                Inscrito em: {item.inscritoEmLabel}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {item.canReactivate ? (
                <Button onClick={() => actions.handleReativar(item.id, item.nome)} variant="outline" size="sm">
                  Reativar
                </Button>
              ) : (
                <>
                  {item.whatsappHref && (
                    <Button as="a" href={item.whatsappHref} target="_blank" variant="success" size="sm">
                      WhatsApp
                    </Button>
                  )}

                  {item.canManagePresence && (
                    <>
                      <Button onClick={() => actions.handlePresenca(item.id, item.compareceuStatus)} variant="success" size="sm">
                        Compareceu
                      </Button>
                      <Button onClick={() => actions.handlePresenca(item.id, item.faltouStatus)} variant="danger" size="sm">
                        Faltou
                      </Button>
                    </>
                  )}

                  <Button onClick={() => actions.handleCancelar(item.id, item.nome)} variant="outline" size="sm">
                    Cancelar
                  </Button>
                </>
              )}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function PublicListSection({ vm, lista, state, actions, isMobile }) {
  return (
    <Card style={{ marginBottom: '1rem' }}>
      <CardHeader style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)' }}>{vm.listaCard.titulo}</span>
          {vm.listaCard.badges.map((badge) => (
            <Badge key={badge.id} preset={badge.preset} bg={badge.bg} color={badge.color}>
              {badge.label}
            </Badge>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {vm.filtros.map((item) => (
              <Button
                key={item.value}
                onClick={() => actions.setFiltro(item.value)}
                variant={state.filtro === item.value ? 'primary' : 'ghost'}
                size="sm"
              >
                {item.label}
              </Button>
            ))}
          </div>

          <select
            value={state.ordenar}
            onChange={(event) => actions.setOrdenar(event.target.value)}
            className="form-control-custom"
            style={{ width: '160px', fontSize: '0.78rem', padding: '0.35rem 0.5rem' }}
          >
            {vm.ordenacoes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>

      <ToastPromovido item={vm.toastPromovido} onClose={actions.limparPromovido} />

      <CardBody style={{ padding: 0 }}>
        {lista.length === 0 ? (
          <EmptyState icon="people" title={vm.listaCard.emptyMessage} />
        ) : isMobile ? (
          <PublicListCards lista={lista} actions={actions} />
        ) : (
          <PublicListTable lista={lista} actions={actions} />
        )}

        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--cor-borda)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {vm.scoreLegend.map((item) => (
            <span
              key={item.cor}
              style={{
                fontSize: '0.7rem',
                color: item.text,
                background: item.bg,
                border: `1px solid ${item.border}`,
                borderRadius: '20px',
                padding: '1px 8px',
              }}
            >
              {item.label}
            </span>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

export default function GiraDetalhe() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { state, actions, derived } = useGiraDetalhe(router.query.id, router);
  const { vm, isAdmin, lista } = derived;

  if (state.loading) return <Spinner center />;
  if (!vm) return null;

  return (
    <>
      <Head>
        <title>{vm.pageTitle}</title>
      </Head>

      <div style={{ display: 'flex' }}>
        <Sidebar />

        <div className="main-content">
          <div className="topbar">
            <div className='d-flex gap-2 align-items-center flex-wrap'>
              <h5
                style={{
                  fontFamily: 'Cinzel',
                  color: 'var(--cor-acento)',
                  margin: 0,
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                {vm.titulo}
              <small style={{ color: 'var(--cor-texto-suave)' }}>
                <i className="bi bi-calendar3 me-1" />
                {vm.titleLine}
                {vm.responsavel && (
                  <span style={{ marginLeft: '1rem' }}>
                    <i className="bi bi-person-check me-1" />
                    Resp.: <strong style={{ color: 'var(--cor-acento)' }}>{vm.responsavel}</strong>
                  </span>
                )}
              </small>
              </h5> 
                <Badge preset={vm.acesso}>
                  {vm.acessoIcon}{vm.acessoLabel}
                </Badge>
            </div>
            <div className='d-flex gap-2 align-items-center flex-wrap w-100 justify-content-between'>
              <div className="d-flex gap-2 align-items-center flex-wrap">
                <Badge preset={vm.status} size='sm'>
                  {vm.statusLabel}
                </Badge>
                <Link href={vm.editHref} className="btn-outline-gold" style={{ textDecoration: 'none' }}>
                  Editar
                </Link>
                {vm.copyButton.visible && (
                  <Button
                    className="btn-outline-gold"
                    onClick={actions.copyLink}
                    size="md"
                    style={{ background: vm.copyButton.active ? 'rgba(16,185,129,0.15)' : undefined, color: vm.copyButton.active ? '#10b981' : undefined }}
                  >
                    {vm.copyButton.label}
                  </Button>
                )}
              </div>
              <div>
                <Link href={vm.backHref} style={{ color: 'var(--cor-texto-suave)', textDecoration: 'none' }}>
                  <i className="bi bi-arrow-left me-1" />
                  Voltar
                </Link>
              </div>
            </div>
          </div>

          <div className="page-content">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              {vm.summaryCards.map((card) => (
                <StatCard key={card.id} label={card.label} value={card.value} color={card.color} />
              ))}
            </div>

            {vm.alerta && (
              <Card style={{ marginBottom: '1rem', borderColor: 'rgba(249,115,22,0.35)', background: 'rgba(249,115,22,0.06)' }}>
                <CardBody style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <i className="bi bi-exclamation-diamond-fill" style={{ color: '#f97316' }} />
                  <span style={{ flex: 1 }}>{vm.alerta.title}</span>
                  <Button onClick={actions.priorizarAlertas} variant="outline" size="sm">
                    {vm.alerta.actionLabel}
                  </Button>
                </CardBody>
              </Card>
            )}

            {!vm.isFechada && (
              <PublicListSection vm={vm} lista={lista} state={state} actions={actions} isMobile={isMobile} />
            )}

            <MembersPanel panel={vm.membersPanel} onToggle={actions.handlePresencaMembro} />

            <AjeumPanel giraId={vm.id} isAdmin={isAdmin} giraStatus={vm.status} />
          </div>
        </div>
      </div>

      <BottomNav />

      <ConfirmModal
        aberto={state.modal.aberto}
        titulo={state.modal.titulo}
        mensagem={state.modal.mensagem}
        apenasOk={state.modal.apenasOk}
        tipoBotao={state.modal.tipoBotao}
        labelConfirmar={state.modal.labelConfirmar}
        onConfirmar={state.modal.onConfirmar}
        onCancelar={actions.fecharModal}
      />
    </>
  );
}
