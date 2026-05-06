/**
 * components/membro/MembroListCard.jsx — AxeFlow
 * Card mobile de membro para a tela de listagem/gerenciamento.
 * Recebe ViewModel (buildMembroItem) — sem dados crus da API.
 */
import Link from 'next/link';
import { Button } from '../ui';

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

function RoleBadge({ label, color }) {
  return (
    <span style={{
      padding: '0.2rem 0.7rem', borderRadius: '20px',
      fontSize: '0.75rem', fontWeight: 600,
      background: `${color}22`, color,
    }}>
      {label}
    </span>
  );
}

export default function MembroListCard({ membro, isAdmin, onEditar }) {
  return (
    <div style={{
      background: 'var(--cor-card)', border: '1px solid var(--cor-borda)',
      borderRadius: '10px', padding: '0.75rem', marginBottom: '0.5rem',
      display: 'flex', alignItems: 'center', gap: '0.75rem',
    }}>
      <Avatar inicial={membro.inicial} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <Link href={`/membros/${membro.id}`}
            style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--cor-texto)', textDecoration: 'none' }}>
            {membro.nome}
          </Link>
          {membro.souEu && (
            <span style={{ fontSize: '0.7rem', color: 'var(--cor-texto-suave)' }}>(você)</span>
          )}
        </div>
        <div style={{ fontSize: '0.76rem', color: 'var(--cor-texto-suave)', marginTop: '2px' }}>
          {membro.email}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <RoleBadge label={membro.roleLabel} color={membro.roleColor} />
          <span style={{
            fontSize: '0.72rem', padding: '1px 7px', borderRadius: '20px',
            background: membro.ativo ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
            color: membro.ativo ? '#10b981' : '#ef4444',
            border: `1px solid ${membro.ativo ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`,
          }}>
            {membro.statusLabel}
          </span>
        </div>
      </div>
      {isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <Button variant="edit" size="sm" onClick={() => onEditar(membro)}
            style={{ border: '1px solid var(--cor-borda)' }}>
            <i className="bi bi-pencil" />
          </Button>
          <Button variant="outline" size="sm" as="a" href={`/membros/${membro.id}`}>
            <i className="bi bi-bar-chart-line" />
          </Button>
        </div>
      )}
    </div>
  );
}