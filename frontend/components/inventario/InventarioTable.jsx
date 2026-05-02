/**
 * components/inventario/InventarioTable.jsx — AxeFlow
 * Tabela de itens de estoque para desktop.
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

export default function InventarioTable({ itens, onVerHistorico }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table-custom">
        <thead>
          <tr>
            <th>Item</th>
            <th>Categoria</th>
            <th style={{ textAlign: 'center' }}>Saldo</th>
            <th style={{ textAlign: 'center' }}>Mínimo</th>
            <th style={{ textAlign: 'center' }}>Situação</th>
            <th>Histórico</th>
          </tr>
        </thead>
        <tbody>
          {itens.map(item => (
            <tr
              key={item.id}
              style={{ background: item.low_stock ? 'rgba(239,68,68,0.03)' : 'transparent' }}
            >
              <td>
                <strong style={{ fontSize: '0.9rem' }}>{item.name}</strong>
              </td>
              <td style={{ color: 'var(--cor-texto-suave)', fontSize: '0.85rem' }}>
                {LABEL_CATEGORIA[item.category] || item.category}
              </td>
              <td style={{ textAlign: 'center' }}>
                <BadgeEstoque saldo={item.current_stock} threshold={item.minimum_threshold} />
              </td>
              <td style={{ textAlign: 'center', color: 'var(--cor-texto-suave)', fontSize: '0.85rem' }}>
                {item.minimum_threshold > 0 ? item.minimum_threshold : '—'}
              </td>
              <td style={{ textAlign: 'center' }}>
                {item.low_stock ? (
                  <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>⚠ Baixo</span>
                ) : (item.current_stock ?? 0) === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Zerado</span>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: '#10b981' }}>✓ Ok</span>
                )}
              </td>
              <td>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onVerHistorico?.(item)}
                  style={{ border: '1px solid var(--cor-borda)' }}
                >
                  Ver histórico
                </Button>
              </td>
            </tr>
          ))}

          {itens.length === 0 && (
            <tr>
              <td colSpan="6">
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--cor-texto-suave)' }}>
                  <i className="bi bi-box-seam" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.75rem', opacity: 0.4 }} />
                  <p style={{ margin: 0 }}>Nenhum item encontrado</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}