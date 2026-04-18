/**
 * viewModels/consulenteViewModel.js — AxeFlow
 *
 * Dependências: utils/format (formatPhone)
 * Impacto: pages/consulentes.js — zero dado cru no JSX
 *
 * O backend já processa score/label/cor — o ViewModel só mapeia para display.
 */
import { formatPhone } from '../utils/format';

export const COR_SCORE = {
  verde:    { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)',  text: '#10b981' },
  amarelo:  { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)',  text: '#f59e0b' },
  laranja:  { bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.35)',  text: '#f97316' },
  vermelho: { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)',   text: '#ef4444' },
  cinza:    { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.25)', text: '#94a3b8' },
};

export function buildConsulentesListViewModel(consulentes) {
  return consulentes.map(c => ({
    id:        c.id,
    nome:      c.nome,
    inicial:   c.nome?.charAt(0).toUpperCase() || '?',
    telefone:  c.telefone ? formatPhone(c.telefone) : '—',
    telefoneCru: c.telefone || '',
    email:     c.email || '—',
    obs:       c.observacoes || null,
    totalInscricoes: c.total_inscricoes ?? 0,
    totalGiras:      c.total_giras ?? 0,
  }));
}

export function buildRankingConsulentesViewModel(ranking) {
  return ranking.map(c => {
    const sc  = c.score_presenca || {};
    const cor = sc.cor || 'cinza';
    return {
      id:              c.id,
      nome:            c.nome,
      inicial:         c.nome?.charAt(0).toUpperCase() || '?',
      telefone:        c.telefone ? formatPhone(c.telefone) : '—',
      scoreLabel:      sc.label  || 'Novo',
      scorePct:        sc.score  != null ? `${sc.score}%` : sc.label || '—',
      emoji:           sc.emoji  || '🆕',
      cor,
      corStyle:        COR_SCORE[cor] || COR_SCORE.cinza,
      alerta:          sc.alerta || false,
      comparecimentos: sc.comparecimentos ?? 0,
      faltas:          sc.faltas          ?? 0,
      finalizadas:     sc.finalizadas     ?? 0,
      taxa:            sc.finalizadas > 0
                         ? Math.round((sc.comparecimentos / sc.finalizadas) * 100)
                         : 0,
    };
  });
}

export function buildRankingConsulentesStats(ranking) {
  const vm = buildRankingConsulentesViewModel(ranking);
  return {
    total:        vm.length,
    confiaveis:   vm.filter(c => c.cor === 'verde').length,
    alertas:      vm.filter(c => c.alerta).length,
    semHistorico: vm.filter(c => c.finalizadas < 2).length,
  };
}