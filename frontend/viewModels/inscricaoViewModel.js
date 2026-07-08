import { whatsappLink } from '../utils/format';

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

function hasPhone(phone) {
  return String(phone || '').replace(/\D/g, '').length > 0;
}

function buildWhatsappMessage(inscricao, giraTitulo) {
  const nome = inscricao.nome || 'Consulente';

  if (inscricao.naFila || inscricao.status === 'lista_espera') {
    return `Ola ${nome}! Sua inscricao na gira "${giraTitulo}" foi recebida. No momento voce esta na lista de espera. Avisaremos quando uma vaga for liberada.`;
  }

  return `Olá ${nome}! Sua inscrição na gira "${giraTitulo}" foi confirmada.

          Caso não possa comparecer, favor nos informar o quanto antes, para que possamos disponibilizar sua vaga a outro consulente.

          E, para facilitar a comunicação, deixaremos listadas algumas instruções da casa:

          • Vir com vestimenta adequada;
          • Evitar usar o celular durante a gira;
          • Firmar os pensamentos para o que deseja receber.

          🚫 Filmar e/ou tirar fotos.

          📍 Endereço:
          R. Áries, 74 - Cidade Satélite Santa Bárbara (próximo ao Terminal São Mateus).

          📍 Localização:
          https://maps.app.goo.gl/K1aasgPEi5W3U3Fh7?g_st=ic

          No mais, sua presença é muito importante para nós! Axé!

          Tenda Ogum Xoroquê! 🔱⚔️`;
}

export function buildInscricoesComScoreViewModel(inscricoes = [], giraTitulo = null) {
  return inscricoes.map((i, index) => {
    const comparecimentos = i.comparecimentos || 0;
    const faltas = i.faltas || 0;
    const finalizadas = comparecimentos + faltas;
    const canSendWhatsapp = Boolean(giraTitulo) && !i.cancelado && hasPhone(i.telefone);

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
      whatsappHref: canSendWhatsapp
        ? whatsappLink(i.telefone, buildWhatsappMessage(i, giraTitulo))
        : null,
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
