/**
 * components/gira/InscricaoTable.jsx — AxeFlow
 *
 * Tabela desktop de inscrições da GiraDetalhe.
 * Consome exclusivamente InscricaoViewModel.
 */

import { Badge } from '../ui';

export default function InscricaoTable({
  inscricoes,
  podeGerenciar,
  onPresenca,
  onCancelar,
  onReativar,
}) {
  return (
    <div className="table-responsive">
      <table
        className="table table-dark table-hover align-middle"
        style={{ fontSize: '0.85rem' }}
      >
        <thead>
          <tr>
            <th>#</th>
            <th>Nome</th>
            <th>Telefone</th>
            <th>Score</th>
            <th>Observações</th>
            <th>Status</th>
            {podeGerenciar && <th>Ações</th>}
          </tr>
        </thead>

        <tbody>
          {inscricoes.map((i) => (
            <tr
              key={i.id}
              style={{ opacity: i.cancelado ? 0.5 : 1 }}
            >
              {/* posição */}
              <td style={cellHighlight}>
                {i.posicao}º
              </td>

              {/* nome + alerta */}
              <td>
                <div style={{ fontWeight: 600 }}>{i.nome}</div>

                {i.temAlerta && (
                  <div style={alertStyle}>
                    ⚠ {i.faltas} faltas
                  </div>
                )}
              </td>

              {/* telefone */}
              <td style={mutedCell}>
                {i.telefone || '—'}
              </td>

              {/* score */}
              <td>
                {i.scorePct ? (
                  <span
                    title={`${i.comparecimentos} ✓ / ${i.faltas} ✗`}
                    style={{ fontSize: '0.75rem' }}
                  >
                    {i.scoreEmoji} {i.scorePct}
                  </span>
                ) : (
                  <span style={mutedText}>🆕 Novo</span>
                )}
              </td>

              {/* observações */}
              <td style={obsCell}>
                {i.observacoes || '—'}
              </td>

              {/* status */}
              <td>
                <Badge preset={i.status}>
                  {i.statusLabel}
                </Badge>
              </td>

              {/* ações */}
              {podeGerenciar && (
                <td>
                  <div style={actionGroup}>
                    {!i.cancelado && !i.naFila && (
                      <>
                        <button
                          onClick={() =>
                            onPresenca(i.id, 'compareceu')
                          }
                          style={btnSuccess}
                          title="Compareceu"
                        >
                          ✓
                        </button>

                        <button
                          onClick={() =>
                            onPresenca(i.id, 'faltou')
                          }
                          style={btnDanger}
                          title="Faltou"
                        >
                          ✗
                        </button>
                      </>
                    )}

                    {i.cancelado ? (
                      <button
                        onClick={() =>
                          onReativar(i.id, i.nome)
                        }
                        style={btnWarning}
                      >
                        Reativar
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          onCancelar(i.id, i.nome)
                        }
                        style={btnNeutral}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// estilos locais (evita CSS global desnecessário)
// ─────────────────────────────────────────────

const cellHighlight = {
  fontFamily: 'Cinzel',
  color: 'var(--cor-acento)',
  fontWeight: 700,
};

const mutedCell = {
  color: 'var(--cor-texto-suave)',
  fontSize: '0.8rem',
};

const mutedText = {
  color: 'var(--cor-texto-suave)',
  fontSize: '0.75rem',
};

const obsCell = {
  maxWidth: 220,
  fontSize: '0.78rem',
  color: '#d4af37',
};

const alertStyle = {
  fontSize: '0.7rem',
  color: '#f97316',
  marginTop: 2,
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

const btnWarning = {
  ...baseBtn,
  color: '#f59e0b',
  border: '1px solid rgba(245,158,11,0.3)',
  background: 'rgba(245,158,11,0.08)',
};

const btnNeutral = {
  ...baseBtn,
  color: '#9ca3af',
  border: '1px solid rgba(156,163,175,0.25)',
  background: 'rgba(156,163,175,0.06)',
};