/**
 * viewModels/membroViewModel.js — AxeFlow
 *
 * Dependências: nenhuma (dados já processados pelo backend)
 * Impacto: pages/membros.js — zero dado cru no JSX
 */

const ROLES = { admin: 'Admin', operador: 'Operador', membro: 'Membro' };
const ROLE_COLORS = { admin: '#d4af37', operador: '#a78bfa', membro: '#60a5fa' };

const COR_SCORE = {
  verde:    { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)',  text: '#10b981' },
  amarelo:  { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)',  text: '#f59e0b' },
  laranja:  { bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.35)',  text: '#f97316' },
  vermelho: { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)',   text: '#ef4444' },
  cinza:    { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.25)', text: '#94a3b8' },
};

export { COR_SCORE, ROLES, ROLE_COLORS };

export function buildMembroItem(m, meId) {
  return {
    id:         m.id,
    nome:       m.nome,
    email:      m.email,
    telefone:   m.telefone || '—',
    role:       m.role,
    roleLabel:  ROLES[m.role] || m.role,
    roleColor:  ROLE_COLORS[m.role] || 'var(--cor-texto)',
    ativo:      m.ativo !== false,
    statusLabel:m.ativo !== false ? 'Ativo' : 'Inativo',
    inicial:    m.nome?.charAt(0).toUpperCase() || '?',
    souEu:      m.id === meId,
  };
}

export function buildMembrosListViewModel(membros, meId) {
  return membros.map(m => buildMembroItem(m, meId));
}

export function buildRankingItem(m) {
  const taxa = m.finalizadas > 0
    ? Math.round((m.comparecimentos / m.finalizadas) * 100)
    : 0;
  const cor = COR_SCORE[m.cor] || COR_SCORE.cinza;

  return {
    id:              m.id,
    nome:            m.nome,
    role:            m.role,
    roleLabel:       ROLES[m.role] || m.role,
    roleColor:       ROLE_COLORS[m.role] || 'var(--cor-texto)',
    inicial:         m.nome?.charAt(0).toUpperCase() || '?',
    cor:             m.cor,
    corStyle:        cor,
    emoji:           m.emoji,
    score:           m.score,
    scoreLabel:      m.score != null ? `${m.score}%` : m.label,
    comparecimentos: m.comparecimentos ?? 0,
    faltas:          m.faltas ?? 0,
    finalizadas:     m.finalizadas ?? 0,
    totalInscricoes: m.total_inscricoes ?? 0,
    taxa,
    alerta:          m.alerta || false,
    semHistorico:    m.cor === 'cinza',
  };
}

export function buildRankingViewModel(ranking) {
  return ranking.map(buildRankingItem);
}

export function buildRankingStats(ranking) {
  return {
    total:        ranking.length,
    confiaveis:   ranking.filter(m => m.cor === 'verde').length,
    alertas:      ranking.filter(m => m.alerta).length,
    semHistorico: ranking.filter(m => m.cor === 'cinza').length,
  };
}