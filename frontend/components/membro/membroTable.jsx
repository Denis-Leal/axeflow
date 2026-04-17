/**
 * components/gira/MembrosTable.jsx — AxeFlow
 *
 * Tabela desktop de membros da gira.
 * Consome exclusivamente MembroViewModel.
 */

import { Badge } from '../ui';

export default function MembrosTable({ membros, podeGer, onUpdateMembro, updating }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table-custom">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Função</th>
            <th>Status</th>
            {podeGer && <th>Ações</th>}
          </tr>
        </thead>

        <tbody>
          {membros.map((m) => (
            <tr key={m.id}>
              {/* nome */}
              <td>
                <div style={{ fontWeight: 600 }}>{m.nome}</div>
              </td>

              {/* função */}
              <td style={mutedCell}>
                {m.role || '—'}
              </td>

              {/* status */}
              <td>
                <Badge preset={m.status}>
                  {m.statusLabel}
                </Badge>
              </td>

              {/* ações */}
              {podeGer && (
                <td>
                  <div style={actionGroup}>
                    <button
                      onClick={() =>
                        onUpdateMembro(m.id, 'compareceu')
                      }
                      disabled={updating[m.id]}
                      style={{
                        ...btnSuccess,
                        opacity: m.status === 'compareceu' ? 1 : 0.6,
                      }}
                      title="Compareceu"
                    >
                      ✓
                    </button>

                    <button
                      onClick={() =>
                        onUpdateMembro(m.id, 'faltou')
                      }
                      disabled={updating[m.id]}
                      style={{
                        ...btnDanger,
                        opacity: m.status === 'faltou' ? 1 : 0.6,
                      }}
                      title="Faltou"
                    >
                      ✗
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}

          {membros.length === 0 && (
            <tr>
              <td colSpan={podeGer ? 4 : 3}>
                <div style={emptyState}>
                  <i
                    className="bi bi-people"
                    style={{
                      fontSize: '2rem',
                      marginBottom: '0.75rem',
                      opacity: 0.4,
                    }}
                  />
                  <p style={{ margin: 0 }}>
                    Nenhum membro registrado
                  </p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// estilos locais
// ─────────────────────────────────────────────

const mutedCell = {
  color: 'var(--cor-texto-suave)',
  fontSize: '0.8rem',
};

const actionGroup = {
  display: 'flex',
  gap: '0.3rem',
};

const baseBtn = {
  borderRadius: '5px',
  padding: '3px 7px',
  fontSize: '0.8rem',
  cursor: 'pointer',
  border: '1px solid transparent',
  background: 'transparent',
};

const btnSuccess = {
  ...baseBtn,
  color: '#10b981',
  border: '1px solid rgba(16,185,129,0.3)',
  background: 'rgba(16,185,129,0.08)',
};

const btnDanger = {
  ...baseBtn,
  color: '#ef4444',
  border: '1px solid rgba(239,68,68,0.25)',
  background: 'rgba(239,68,68,0.06)',
};

const btnNeutral = {
  ...baseBtn,
  color: '#9ca3af',
  border: '1px solid rgba(156,163,175,0.25)',
  background: 'rgba(156,163,175,0.06)',
};

const emptyState = {
  textAlign: 'center',
  padding: '2rem',
  color: 'var(--cor-texto-suave)',
};