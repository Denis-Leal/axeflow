/**
 * components/inventario/InventarioCard.jsx — AxeFlow
 * Card de item de estoque para mobile. NUNCA usa tabela.
 */

import { Badge, Button } from '../ui';

const LABEL_CATEGORIA = {
  fumo:               '🚬 Fumo',
  bebidas:            '🥤 Bebidas',
  velas:              '🕯️ Velas',
  ervas:              '🌿 Ervas e Defumação',
  pos_e_elementos:    '🪨 Pós e Elementos',
  alimentos:          '🍞 Alimentos',
  oferendas:          '🛐 Oferendas',
  ritualistica:       '🔮 Itens Ritualísticos',
  imagem:             '🗿 Imagens e Representações',
  limpeza_espiritual: '✨ Limpeza Espiritual',
  limpeza:            '🧼 Limpeza (Ambiente)',
  outros:             '📦 Outros',
};

function BadgeEstoque({ saldo, threshold }) {
  if (saldo === null || saldo === undefined) {
    return <Badge preset="cancelado">—</Badge>;
  }

  const baixo = threshold > 0 && saldo <= threshold;

  if (baixo) {
    return (
      <Badge bg="rgba(239,68,68,0.15)" color="#ef4444" style={{ border: '1px solid rgba(239,68,68,0.4)' }}>
        ⚠ {saldo}
      </Badge>
    );
  }

  if (saldo === 0) {
    return (
      <Badge bg="rgba(148,163,184,0.1)" color="#94a3b8" style={{ border: '1px solid rgba(148,163,184,0.2)' }}>
        0
      </Badge>
    );
  }

  return (
    <Badge bg="rgba(16,185,129,0.12)" color="#10b981" style={{ border: '1px solid rgba(16,185,129,0.3)' }}>
      {saldo}
    </Badge>
  );
}

export default function InventarioCard({ item, onVerHistorico }) {
  const situacao = item.low_stock
    ? { label: '⚠ Baixo', color: '#ef4444' }
    : (item.current_stock ?? 0) === 0
    ? { label: 'Zerado', color: '#94a3b8' }
    : { label: '✓ Ok', color: '#10b981' };

  return (
    <div style={{
      background:    item.low_stock ? 'rgba(239,68,68,0.03)' : 'var(--cor-card)',
      border:        `1px solid ${item.low_stock ? 'rgba(239,68,68,0.25)' : 'var(--cor-borda)'}`,
      borderRadius:  '12px',
      overflow:      'hidden',
      marginBottom:  '0.75rem',
    }}>
      {/* Header */}
      <div style={{ padding: '0.85rem 1rem 0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <strong style={{ fontSize: '0.92rem', color: 'var(--cor-texto)', flex: 1 }}>
            {item.name}
          </strong>
          <span style={{ fontSize: '0.75rem', color: situacao.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {situacao.label}
          </span>
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--cor-texto-suave)' }}>
          {LABEL_CATEGORIA[item.category] || item.category}
        </div>
      </div>

      {/* Saldo + Mínimo */}
      <div style={{
        padding: '0.5rem 1rem',
        display: 'flex',
        gap: '1.5rem',
        fontSize: '0.82rem',
        color: 'var(--cor-texto-suave)',
      }}>
        <div>
          <div style={{ marginBottom: '2px' }}>Saldo</div>
          <BadgeEstoque saldo={item.current_stock} threshold={item.minimum_threshold} />
        </div>
        <div>
          <div style={{ marginBottom: '2px' }}>Mínimo</div>
          <span style={{ fontWeight: 600, color: 'var(--cor-texto)' }}>
            {item.minimum_threshold > 0 ? item.minimum_threshold : '—'}
          </span>
        </div>
      </div>

      {/* Ação */}
      <div style={{ padding: '0.5rem 1rem 0.85rem' }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onVerHistorico?.(item)}
          style={{ border: '1px solid var(--cor-borda)', width: '100%', justifyContent: 'center' }}
        >
          <i className="bi bi-clock-history" /> Ver histórico
        </Button>
      </div>
    </div>
  );
}