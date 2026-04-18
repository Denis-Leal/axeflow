/**
 * viewModels/estoqueViewModel.js — AxeFlow
 *
 * Dependências: nenhuma
 * Impacto: pages/estoque.js — zero dado cru no JSX
 */

export function buildItemEstoqueViewModel(item) {
  const saldo     = item.current_stock ?? null;
  const threshold = item.minimum_threshold ?? 0;
  const emAlerta  = threshold > 0 && saldo !== null && saldo <= threshold;
  const semSaldo  = saldo === 0;

  return {
    id:        item.id,
    nome:      item.name,
    categoria: item.category,
    saldo,
    saldoLabel: saldo !== null ? `${saldo} unidades` : '?',
    threshold,
    cor: emAlerta ? '#ef4444' : semSaldo ? '#94a3b8' : '#10b981',
    label: `${item.name} — saldo atual: ${saldo ?? '?'}`,
  };
}

export function buildItensEstoqueViewModel(itens) {
  return itens.map(buildItemEstoqueViewModel);
}