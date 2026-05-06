/**
 * components/membro/RankingTable.jsx — AxeFlow
 * Tabela desktop de desempenho de membros (aba Ranking).
 * Recebe ViewModel (buildRankingItem) — sem dados crus da API.
 */
import Link from 'next/link';
import { Button, EmptyState } from '../ui';

function Avatar({ inicial, size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--cor-acento)', fontFamily: 'Cinzel', fontWeight: 700,
      fontSize: size > 32 ? '0.9rem' : '0.8rem',
    }}>
      {inicial}
    </div>
  );
}

function ScoreBadge({ item }) {
  const c = item.corStyle;
  return (
    <span
      title={`${item.comparecimentos} presenças · ${item.faltas} faltas`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        background: c.bg, border: `1px solid ${c.border}`, color: c.text,
        borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 600,
        whiteSpace: 'nowrap', cursor: 'help',
      }}
    >
      {item.emoji} {item.scoreLabel}
    </span>
  );
}

export default function RankingTable({ itens }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table-custom">
        <thead>
          <tr>
            <th>Membro</th>
            <th style={{ textAlign: 'center' }}>Score</th>
            <th style={{ textAlign: 'center' }}>Presenças</th>
            <th style={{ textAlign: 'center' }}>Faltas</th>
            <th style={{ textAlign: 'center' }}>Giras</th>
            <th>Taxa</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {itens.map(m => (
            <tr key={m.id} style={{ background: m.alerta ? 'rgba(249,115,22,0.04)' : 'transparent' }}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <Avatar inicial={m.inicial} size={32} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <Link href={`/membros/${m.id}`}
                        style={{ color: 'var(--cor-texto)', textDecoration: 'none', fontWeight: 600, fontSize: '0.88rem' }}>
                        {m.nome}
                      </Link>
                      {m.alerta && (
                        <span style={{
                          fontSize: '0.68rem', color: '#f97316',
                          background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)',
                          borderRadius: '4px', padding: '1px 5px',
                        }}>
                          ⚠ {m.faltas}x faltou
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: m.roleColor }}>{m.roleLabel}</span>
                  </div>
                </div>
              </td>
              <td style={{ textAlign: 'center' }}><ScoreBadge item={m} /></td>
              <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 600 }}>{m.comparecimentos}</td>
              <td style={{
                textAlign: 'center',
                color: m.faltas >= 3 ? '#ef4444' : 'var(--cor-texto-suave)',
                fontWeight: m.faltas >= 3 ? 700 : 400,
              }}>{m.faltas}</td>
              <td style={{ textAlign: 'center', color: 'var(--cor-texto-suave)' }}>{m.totalInscricoes}</td>
              <td style={{ minWidth: 120 }}>
                {m.finalizadas > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div className="vagas-bar" style={{ flex: 1 }}>
                      <div className="vagas-fill" style={{ width: `${m.taxa}%`, background: m.corStyle.text }} />
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--cor-texto-suave)', minWidth: 35 }}>
                      {m.taxa}%
                    </span>
                  </div>
                ) : (
                  <span style={{ color: 'var(--cor-texto-suave)', fontSize: '0.78rem' }}>—</span>
                )}
              </td>
              <td>
                <Button variant="outline" size="sm" as="a" href={`/membros/${m.id}`}
                  style={{ fontSize: '0.78rem' }}>
                  <i className="bi bi-person-lines-fill" />
                </Button>
              </td>
            </tr>
          ))}
          {itens.length === 0 && (
            <tr><td colSpan={7}>
              <EmptyState icon="bar-chart-line" title="Nenhum dado de presença ainda" />
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}