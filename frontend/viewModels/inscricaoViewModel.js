/**
 * viewModels/inscricaoViewModel.js — AxeFlow
 *
 * Centraliza transformações de dados da GiraDetalhe:
 * - inscrições com score
 * - membros com status de presença
 * - estatísticas agregadas da gira
 */

// ─────────────────────────────────────────────────────────────
// INSCRIÇÕES → VIEW MODEL
// ─────────────────────────────────────────────────────────────

export function buildInscricoesComScoreViewModel(inscricoes = []) {
  return inscricoes.map((i, index) => {
    const comparecimentos = i.comparecimentos || 0;
    const faltas = i.faltas || 0;
    const finalizadas = comparecimentos + faltas;

    const scorePct =
      finalizadas > 0
        ? Math.round((comparecimentos / finalizadas) * 100)
        : null;

    const scoreEmoji =
      scorePct == null
        ? '🆕'
        : scorePct >= 80
          ? '🔥'
          : scorePct >= 50
            ? '⚖️'
            : '⚠️';

    return {
      ...i,

      // posição já normalizada (fallback defensivo)
      posicao: i.posicao ?? index + 1,

      scorePct: scorePct ? `${scorePct}%` : null,
      scoreEmoji,

      finalizadas,
      temAlerta: faltas >= 3,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// MEMBROS → PRESENÇA VIEW MODEL
// ─────────────────────────────────────────────────────────────

export function buildMembrosPresencaViewModel(membros = []) {
  return membros.map((m) => {
    const status = m.status || 'confirmado';

    const statusLabelMap = {
      compareceu: 'Compareceu',
      faltou: 'Faltou',
      confirmado: 'Confirmado',
    };

    return {
      ...m,
      status,
      statusLabel: statusLabelMap[status] || status,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// STATS DA GIRA
// ─────────────────────────────────────────────────────────────

export function buildGiraDetalheStats(inscricoes = []) {
  let ativas = 0;
  let compareceram = 0;
  let faltaram = 0;
  let naFila = 0;
  let alertas = 0;

  for (const i of inscricoes) {
    if (i.cancelado) continue;

    ativas++;

    if (i.naFila) naFila++;

    if (i.status === 'compareceu') compareceram++;
    if (i.status === 'faltou') faltaram++;

    if ((i.faltas || 0) >= 3) alertas++;
  }

  return {
    ativas,
    compareceram,
    faltaram,
    naFila,
    alertas,
  };
}