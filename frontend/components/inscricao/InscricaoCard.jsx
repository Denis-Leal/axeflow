/**
 * components/gira/InscricaoCard.jsx — AxeFlow
 *
 * Card mobile para exibição de inscrições na GiraDetalhe.
 * Trabalha exclusivamente com o InscricaoViewModel.
 */

import { Badge } from '../ui';

export default function InscricaoCard({
  inscricao,
  giraTitulo,
  podeGerenciar,
  onPresenca,
  onCancelar,
  onReativar,
}) {
  const i = inscricao;

  return (
    <div
      style={{
        border: '1px solid var(--cor-borda)',
        borderRadius: '10px',
        padding: '0.75rem',
        marginBottom: '0.5rem',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '0.5rem',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--cor-texto)' }}>
            {i.posicao}º — {i.nome}
          </div>

          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--cor-texto-suave)',
              marginTop: 2,
            }}
          >
            {i.telefone || '—'}
          </div>
        </div>

        <Badge preset={i.status}>{i.statusLabel}</Badge>
      </div>

      {/* Score */}
      <div
        style={{
          marginTop: '0.5rem',
          fontSize: '0.8rem',
          color: 'var(--cor-acento)',
        }}
      >
        {i.scorePct ? (
          <>
            {i.scoreEmoji} {i.scorePct}
            <span
              style={{
                marginLeft: 6,
                fontSize: '0.7rem',
                color: 'var(--cor-texto-suave)',
              }}
              title={`${i.comparecimentos} comparecimentos / ${i.faltas} faltas`}
            >
              ({i.finalizadas} registros)
            </span>
          </>
        ) : (
          '🆕 Novo consulente'
        )}
      </div>

      {/* Observações */}
      <div
        style={{
          marginTop: '0.4rem',
          fontSize: '0.78rem',
          color: '#d4af37',
        }}
      >
        {i.observacoes || 'Sem observações'}
      </div>

      {/* Alertas */}
      {i.temAlerta && (
        <div
          style={{
            marginTop: '0.4rem',
            fontSize: '0.75rem',
            color: '#f97316',
          }}
        >
          ⚠ Alto número de faltas ({i.faltas})
        </div>
      )}

      {/* Ações */}
      {podeGerenciar && (
        <div
          style={{
            display: 'flex',
            gap: '0.4rem',
            marginTop: '0.6rem',
            flexWrap: 'wrap',
          }}
        >
          {!i.naFila && !i.cancelado && (
            <>
              <button
                onClick={() => onPresenca(i.id, 'compareceu')}
                style={buttonStyle('#10b981')}
              >
                ✓
              </button>

              <button
                onClick={() => onPresenca(i.id, 'faltou')}
                style={buttonStyle('#ef4444')}
              >
                ✗
              </button>
            </>
          )}

          {i.cancelado ? (
            <button
              onClick={() => onReativar(i.id, i.nome)}
              style={buttonStyle('#f59e0b')}
            >
              Reativar
            </button>
          ) : (
            <button
              onClick={() => onCancelar(i.id, i.nome)}
              style={buttonStyle('#6b7280')}
            >
              Cancelar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function buttonStyle(color) {
  return {
    background: `${color}20`,
    border: `1px solid ${color}55`,
    color,
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '0.8rem',
    cursor: 'pointer',
  };
}