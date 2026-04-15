/**
 * viewModels/giraViewModel.js — AxeFlow
 * Transforma dados crus da API em estruturas prontas para UI.
 * NUNCA use dados crus da API diretamente no JSX.
 */
import { formatDate, formatTime, occupancyRatio, occupancyColor, statusLabel } from '../utils/format';

/**
 * Transforma uma gira raw em ViewModel para listagem.
 */
export function buildGiraItem(g) {
  const limite = g.acesso === 'fechada' ? g.limite_membros : g.limite_consulentes;
  const inscritos = g.total_inscritos || 0;
  const ratio = occupancyRatio(inscritos, limite);

  return {
    id:            g.id,
    titulo:        g.titulo,
    tipo:          g.tipo || null,
    acesso:        g.acesso,
    acessoLabel:   g.acesso === 'fechada' ? 'Fechada' : 'Pública',
    acessoIcon:    g.acesso === 'fechada' ? '🔒' : '🌐',
    data:          g.data,
    dataFormatada: formatDate(g.data, { short: true, noYear: false }),
    dataCompacta:  formatDate(g.data, { day: '2-digit', month: 'short' }),
    horario:       g.horario,
    horarioFmt:    formatTime(g.horario),
    status:        g.status,
    statusLabel:   statusLabel(g.status),
    inscritos,
    limite:        limite || 0,
    vagasOcupadas: `${inscritos}/${limite || 0}`,
    ratio,
    barColor:      occupancyColor(ratio),
    slugPublico:   g.slug_publico,
    responsavel:   g.responsavel_lista_nome || null,
    concluida:     g.status === 'concluida',
    aberta:        g.status === 'aberta',
  };
}

/**
 * Lista de giras para a tela /giras.
 */
export function buildGirasViewModel(giras) {
  return giras.map(buildGiraItem);
}

/**
 * ViewModel para o dashboard.
 * Incorpora presenças do usuário logado.
 */
export function buildDashboardViewModel(giras, user, presencasFechadas, presencasPublicas, membrosPublicas) {
  const todas = giras.map(g => {
    const vm = buildGiraItem(g);
    const minhaPresenca = g.acesso === 'fechada'
      ? presencasFechadas[g.id]
      : presencasPublicas[g.id];
    const membros = membrosPublicas[g.id] || null;

    return {
      ...vm,
      minhaPresenca: minhaPresenca || 'pendente',
      jaConfirmei:   minhaPresenca === 'confirmado',
      podeCofirmar:  g.status !== 'concluida',
      membrosInfo:   membros,
    };
  });

  const proximasAtivas = todas.filter(g => !g.concluida);
  const proxima = proximasAtivas[0] || null;

  const pendentesConfirmacao = todas.filter(g =>
    !g.concluida && (g.minhaPresenca === 'pendente' || g.minhaPresenca === 'confirmado')
  );

  const stats = {
    total:       giras.length,
    abertas:     giras.filter(g => g.status === 'aberta').length,
    inscritos:   giras.reduce((acc, g) => acc + (g.total_inscritos || 0), 0),
    concluidas:  giras.filter(g => g.status === 'concluida').length,
  };

  return {
    giras: todas,
    proxima,
    pendentesConfirmacao,
    historico: todas.filter(g => g.concluida).slice(0, 5),
    stats,
    user,
  };
}

/**
 * ViewModel para detalhe de uma gira (inscrições de consulentes).
 */
export function buildInscricoesViewModel(inscricoes) {
  return inscricoes.map(i => ({
    id:            i.id,
    posicao:       i.posicao,
    status:        i.status,
    statusLabel:   statusLabel(i.status),
    nome:          i.consulente_nome || '—',
    telefone:      i.consulente_telefone || '—',
    observacoes:   i.observacoes || null,
    inscritoEm:    i.created_at,
    naFila:        i.status === 'lista_espera',
    cancelado:     i.status === 'cancelado',
    score:         i.score_presenca || null,
    temAlerta:     i.score_presenca?.alerta || false,
  }));
}