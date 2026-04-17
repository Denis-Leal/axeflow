/**
 * utils/format.js — AxeFlow
 * Funções utilitárias de formatação compartilhadas.
 */

export function formatOrdinal(n) {
  if (n == null) return '—';
  return `${n}º`;
}

export function formatDate(dateStr, opts = {}) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: opts.short ? 'short' : 'long',
    year: opts.noYear ? undefined : 'numeric',
    weekday: opts.weekday ? 'long' : undefined,
    ...opts,
  });
}

export function formatTime(timeStr) {
  if (!timeStr) return '—';
  const [h, m] = timeStr.split(':');
  return m === '00' ? `${h}h` : `${h}h${m}`;
}

export function formatDateTime(dtStr) {
  if (!dtStr) return '—';
  return new Date(dtStr).toLocaleString('pt-BR');
}

export function formatPhone(phone) {
  if (!phone) return '—';
  const d = phone.replace(/\D/g, '');
  if (d.length === 13) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`;
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  return phone;
}

export function formatOccupancy(filled, total) {
  if (!total) return '0/0';
  return `${filled}/${total}`;
}

export function occupancyRatio(filled, total) {
  if (!total) return 0;
  return Math.min(1, filled / total);
}

export function occupancyColor(ratio) {
  if (ratio >= 0.9) return 'var(--cor-perigo)';
  if (ratio >= 0.6) return 'var(--cor-aviso)';
  return 'var(--cor-sucesso)';
}

export function whatsappLink(phone, message) {
  const digits = String(phone).replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function statusLabel(status) {
  const map = {
    aberta:      'Aberta',
    fechada:     'Fechada',
    concluida:   'Concluída',
    confirmado:  'Confirmado',
    compareceu:  'Compareceu',
    faltou:      'Faltou',
    cancelado:   'Cancelado',
    lista_espera:'Fila de espera',
    pendente:    'Pendente',
  };
  return map[status] || status;
}