/**
 * components/membro/RankingCard.jsx — AxeFlow
 * Card mobile de desempenho de membro (aba Ranking).
 * Recebe ViewModel (buildRankingItem) — sem dados crus da API.
 */
import Link from 'next/link';

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

export default function RankingCard({ item }) {
  const c = item.corStyle;
  return (
    <div style={{
      background: item.alerta ? 'rgba(249,115,22,0.04)' : 'var(--cor-card)',
      border: `1px solid ${item.alerta ? 'rgba(249,115,22,0.25)' : 'var(--cor-borda)'}`,
      borderRadius: '10px', padding: '0.75rem', marginBottom: '0.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
        <Avatar inicial={item.inicial} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <Link href={`/membros/${item.id}`}
              style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--cor-texto)', textDecoration: 'none' }}>
              {item.nome}
            </Link>
            {item.alerta && (
              <span style={{
                fontSize: '0.68rem', color: '#f97316',
                background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)',
                borderRadius: '4px', padding: '1px 5px',
              }}>
                ⚠ {item.faltas}x faltou
              </span>
            )}
          </div>
          <span style={{ fontSize: '0.7rem', color: item.roleColor }}>{item.roleLabel}</span>
        </div>
        <ScoreBadge item={item} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.76rem', flexWrap: 'wrap' }}>
        <span style={{ color: '#10b981' }}>✓ {item.comparecimentos}</span>
        <span style={{
          color: item.faltas >= 3 ? '#ef4444' : 'var(--cor-texto-suave)',
          fontWeight: item.faltas >= 3 ? 700 : 400,
        }}>✗ {item.faltas}</span>
        <span style={{ color: 'var(--cor-texto-suave)' }}>{item.finalizadas} giras</span>
        {item.finalizadas > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 80 }}>
            <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
              <div style={{ width: `${item.taxa}%`, height: '100%', background: c.text, borderRadius: '2px' }} />
            </div>
            <span style={{ color: 'var(--cor-texto-suave)', minWidth: 30 }}>{item.taxa}%</span>
          </div>
        )}
      </div>
    </div>
  );
}