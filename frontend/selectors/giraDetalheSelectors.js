export const GIRA_DETALHE_FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'confirmado', label: 'Confirmados' },
  { value: 'lista_espera', label: 'Fila' },
  { value: 'compareceu', label: 'Compareceram' },
  { value: 'faltou', label: 'Faltaram' },
];

export const GIRA_DETALHE_ORDERS = [
  { value: 'posicao', label: 'Posicao' },
  { value: 'score_asc', label: 'Score menor' },
  { value: 'score_desc', label: 'Score maior' },
  { value: 'alerta', label: 'Alertas primeiro' },
];

export const GIRA_DETALHE_SCORE_COLORS = {
  verde: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', text: '#10b981' },
  amarelo: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', text: '#f59e0b' },
  laranja: { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.35)', text: '#f97316' },
  vermelho: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', text: '#ef4444' },
  cinza: { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.25)', text: '#94a3b8' },
};

export const GIRA_DETALHE_SCORE_LEGEND = [
  { cor: 'verde', label: 'Confiavel >=80%' },
  { cor: 'amarelo', label: 'Regular 50-79%' },
  { cor: 'laranja', label: 'Risco 20-49%' },
  { cor: 'vermelho', label: 'Problematico <20%' },
  { cor: 'cinza', label: 'Novo (< 2 giras)' },
];

export const GIRA_DETALHE_MEMBER_STATUS = {
  compareceu: {
    label: 'Compareceu',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.24)',
  },
  faltou: {
    label: 'Faltou',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.07)',
    border: 'rgba(239,68,68,0.22)',
  },
  confirmado: {
    label: 'Confirmado',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.22)',
  },
  pendente: {
    label: 'Pendente',
    color: '#94a3b8',
    bg: 'rgba(255,255,255,0.02)',
    border: 'var(--cor-borda)',
  },
};

export function selectIsAdmin(role) {
  return role === 'admin';
}

export function selectHasPhone(phone) {
  return String(phone || '').replace(/\D/g, '').length > 0;
}

function filterInscricoes(inscricoes, filtro) {
  return inscricoes.filter((item) => filtro === 'todos' || item.status === filtro);
}

function orderInscricoes(inscricoes, ordenar) {
  return [...inscricoes].sort((left, right) => {
    if (ordenar === 'posicao') return (left.posicao || 0) - (right.posicao || 0);
    if (ordenar === 'alerta') return (left.temAlerta ? 0 : 1) - (right.temAlerta ? 0 : 1);

    const fallback = ordenar === 'score_asc' ? Number.MAX_SAFE_INTEGER : -1;
    const leftScore = left.score?.score ?? fallback;
    const rightScore = right.score?.score ?? fallback;

    return ordenar === 'score_asc' ? leftScore - rightScore : rightScore - leftScore;
  });
}

export function selectInscricoes(vm, { filtro, ordenar }) {
  if (!vm?.listaBase) return [];
  return orderInscricoes(filterInscricoes(vm.listaBase, filtro), ordenar);
}
