import { formatDateTime, whatsappLink } from '../utils/format';
import { buildGiraItem, buildInscricoesViewModel } from './giraViewModel';
import {
  GIRA_DETALHE_FILTERS,
  GIRA_DETALHE_ORDERS,
  GIRA_DETALHE_SCORE_COLORS,
  GIRA_DETALHE_SCORE_LEGEND,
  GIRA_DETALHE_MEMBER_STATUS,
  selectHasPhone,
} from '../selectors/giraDetalheSelectors';
import { formatOrdinal } from '../utils/format';

function buildPromovidoViewModel(promovido, giraTitulo) {
  if (!promovido) return null;

  const mensagem = `Ola ${promovido.nome}! Uma vaga foi liberada na gira "${giraTitulo}". Voce estava na fila de espera e agora esta confirmado(a)!`;

  return {
    nome: promovido.nome || 'Pessoa promovida',
    whatsappHref: selectHasPhone(promovido.telefone)
      ? whatsappLink(promovido.telefone, mensagem)
      : null,
  };
}

function buildScoreViewModel(score) {
  if (!score) return null;

  const colors = GIRA_DETALHE_SCORE_COLORS[score.cor] || GIRA_DETALHE_SCORE_COLORS.cinza;

  return {
    label: score.score === null || score.score === undefined ? score.label : `${score.score}%`,
    title: `${score.comparecimentos ?? 0} presencas · ${score.faltas ?? 0} faltas`,
    bg: colors.bg,
    border: colors.border,
    color: colors.text,
    alerta: Boolean(score.alerta),
    alertaLabel: score.alerta ? `${score.faltas}x faltou` : null,
  };
}

function buildInscricoesMetricas(inscricoes) {
  return {
    total: inscricoes.length,
    ativas: inscricoes.filter((item) => !item.cancelado).length,
    compareceram: inscricoes.filter((item) => item.status === 'compareceu').length,
    faltaram: inscricoes.filter((item) => item.status === 'faltou').length,
    alertas: inscricoes.filter((item) => item.temAlerta).length,
    naFila: inscricoes.filter((item) => item.naFila).length,
    comObservacao: inscricoes.filter((item) => Boolean(item.observacoes)).length,
  };
}

function buildMembrosMetricas(membros) {
  return {
    total: membros.length,
    compareceram: membros.filter((item) => item.status === 'compareceu').length,
    confirmados: membros.filter((item) => item.status === 'confirmado').length,
    faltaram: membros.filter((item) => item.status === 'faltou').length,
    pendentes: membros.filter((item) => item.status === 'pendente').length,
  };
}

function buildMembroItemViewModel(membro) {
  const status = GIRA_DETALHE_MEMBER_STATUS[membro.status] || GIRA_DETALHE_MEMBER_STATUS.pendente;

  return {
    id: membro.membro_id,
    nome: membro.nome || 'Sem nome',
    role: membro.role || 'membro',
    status: membro.status || 'pendente',
    statusLabel: status.label,
    textColor: status.color,
    rowBg: status.bg,
    rowBorder: status.border,
    compareceuStatus: membro.status === 'compareceu' ? 'pendente' : 'compareceu',
    faltouStatus: membro.status === 'faltou' ? 'pendente' : 'faltou',
  };
}

function buildListaItemViewModel(item, giraTitulo) {
  const mensagem = `Ola ${item.nome}! Uma vaga foi liberada na gira "${giraTitulo}". Voce estava na fila de espera e agora esta confirmado(a)!`;

  return {
    id: item.id,
    nome: item.nome,
    telefone: item.telefone,
    observacoes: item.observacoes,
    posicaoLabel: formatOrdinal(item.posicao || 0),
    status: item.status,
    statusLabel: item.statusLabel,
    inscritoEmLabel: formatDateTime(item.inscritoEm),
    isFila: item.naFila,
    canReactivate: item.cancelado,
    canManagePresence: !item.cancelado && !item.naFila,
    rowBg: item.temAlerta
      ? 'rgba(239,68,68,0.04)'
      : item.naFila
      ? 'rgba(245,158,11,0.03)'
      : 'transparent',
    score: buildScoreViewModel(item.score),
    historicoLabel: item.score
      ? item.score.finalizadas > 0
        ? `${item.score.comparecimentos} presencas, ${item.score.faltas} faltas em ${item.score.finalizadas} giras`
        : 'Sem historico anterior'
      : 'Sem historico anterior',
    compareceuStatus: 'compareceu',
    faltouStatus: 'faltou',
    whatsappHref: item.naFila && selectHasPhone(item.telefone)
      ? whatsappLink(item.telefone, mensagem)
      : null,
  };
}

function buildSummaryCards(acesso, metricas) {
  return [
    {
      id: 'inscritos',
      label: acesso === 'fechada' ? 'Membros inscritos' : 'Consulentes inscritos',
      value: metricas.ativas,
      color: undefined,
    },
    {
      id: 'compareceram',
      label: 'Compareceram',
      value: metricas.compareceram,
      color: '#10b981',
    },
    {
      id: 'faltaram',
      label: 'Faltaram',
      value: metricas.faltaram,
      color: '#ef4444',
    },
    {
      id: 'fila-alertas',
      label: metricas.naFila > 0 ? 'Na fila' : 'Alertas',
      value: metricas.naFila > 0 ? metricas.naFila : metricas.alertas,
      color: metricas.naFila > 0 ? '#f59e0b' : '#f97316',
    },
  ];
}

function buildHeaderBadges(metricas) {
  const badges = [];

  if (metricas.naFila > 0) {
    badges.push({
      id: 'fila',
      preset: 'lista_espera',
      label: `${metricas.naFila} na fila`,
    });
  }

  if (metricas.comObservacao > 0) {
    badges.push({
      id: 'observacoes',
      bg: 'rgba(212,175,55,0.12)',
      color: '#d4af37',
      label: `${metricas.comObservacao} com observacao`,
    });
  }

  return badges;
}

function buildMembersPanel(acesso, membros, metricasMembros) {
  return {
    titulo: acesso === 'fechada' ? 'Presenca dos Membros' : 'Confirmacao dos Membros',
    badges: [
      { id: 'compareceu', preset: 'compareceu', label: `${metricasMembros.compareceram} compareceram` },
      { id: 'confirmado', preset: 'confirmado', label: `${metricasMembros.confirmados} confirmados` },
      { id: 'faltou', preset: 'faltou', label: `${metricasMembros.faltaram} faltaram` },
      { id: 'pendente', preset: 'pendente', label: `${metricasMembros.pendentes} pendentes` },
    ],
    lista: membros,
    emptyMessage: 'Nenhum membro encontrado',
  };
}

function buildLegenda() {
  return GIRA_DETALHE_SCORE_LEGEND.map((item) => ({
    ...item,
    ...GIRA_DETALHE_SCORE_COLORS[item.cor],
  }));
}

export function buildGiraDetalheViewModel({
  gira,
  inscricoes,
  membrosPresenca,
  linkCopiado,
  promovido,
}) {
  if (!gira) {
    return {
      vm: null,
      metricas: {
        total: 0,
        ativas: 0,
        compareceram: 0,
        faltaram: 0,
        alertas: 0,
        naFila: 0,
        comObservacao: 0,
      },
    };
  }

  const giraVm = buildGiraItem(gira);
  const inscricoesVm = buildInscricoesViewModel(inscricoes);
  const listaBase = inscricoesVm.map((item) => buildListaItemViewModel(item, giraVm.titulo));
  const metricas = buildInscricoesMetricas(inscricoesVm);
  const membrosVm = membrosPresenca.map(buildMembroItemViewModel);
  const metricasMembros = buildMembrosMetricas(membrosVm);
  const vm = {
    id: giraVm.id,
    user: giraVm.user,
    pageTitle: `${giraVm.titulo} | AxeFlow`,
    titulo: giraVm.titulo,
    acesso: giraVm.acesso,
    acessoLabel: giraVm.acessoLabel,
    acessoIcon: giraVm.acessoIcon,
    isFechada: giraVm.acesso === 'fechada',
    isPublica: giraVm.acesso === 'publica',
    status: gira.status,
    statusLabel: giraVm.statusLabel,
    titleLine: `${giraVm.dataFormatada} as ${giraVm.horarioFmt}`,
    responsavel: gira.responsavel_lista_nome || null,
    editHref: `/giras/editar/${giraVm.id}`,
    backHref: '/giras',
    inscricoes: inscricoesVm,
    copyButton: {
      visible: giraVm.acesso === 'publica' && Boolean(giraVm.slugPublico),
      label: linkCopiado ? 'Link copiado!' : 'Copiar link',
      active: linkCopiado,
    },
    summaryCards: buildSummaryCards(giraVm.acesso, metricas),
    alerta: metricas.alertas > 0
      ? {
          title: `${metricas.alertas} consulente${metricas.alertas > 1 ? 's' : ''} com historico preocupante`,
          actionLabel: 'Ver primeiro',
        }
      : null,
    filtros: GIRA_DETALHE_FILTERS,
    ordenacoes: GIRA_DETALHE_ORDERS,
    listaCard: {
      titulo: 'Lista de Consulentes',
      badges: buildHeaderBadges(metricas),
      emptyMessage: 'Nenhum consulente encontrado',
    },
    toastPromovido: buildPromovidoViewModel(promovido, giraVm.titulo),
    scoreLegend: buildLegenda(),
    membersPanel: buildMembersPanel(giraVm.acesso, membrosVm, metricasMembros),
    listaBase,
  };

  return { vm, metricas };
}
