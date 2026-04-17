import Link from 'next/link';
import { Badge, ProgressBar, Button } from '../ui';
import { useRouter } from 'next/router';
export default function MembroCard({ membro, podeGer, onUpdate, updating }) {
    console.log("Membros: ", membro);
    console.log("podeGer: ", podeGer);
    console.log("onUpdate: ", onUpdate);
    console.log("updating: ", updating);
    const router = useRouter();
    return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          '0.5rem',
      padding:      '0.6rem 0.75rem',
      border:       '1px solid var(--cor-borda)',
      borderRadius: '8px',
      marginBottom: '0.4rem',
      background:   'rgba(255,255,255,0.02)',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{membro.nome}</div>
        <div style={{ fontSize: '0.74rem', color: 'var(--cor-texto-suave)' }}>{membro.role}</div>
      </div>
      <Badge preset={membro.status}>{membro.statusLabel}</Badge>
      {podeGer && (
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button
            onClick={() => onUpdate(membro.id, 'compareceu')}
            disabled={updating[membro.id]}
            style={{
              background: membro.compareceu ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.3)', color: '#10b981',
              borderRadius: '5px', padding: '3px 7px', cursor: 'pointer', fontSize: '0.8rem',
            }}
          >✓</button>
          <button
            onClick={() => onUpdate(membro.id, 'faltou')}
            disabled={updating[membro.id]}
            style={{
              background: membro.faltou ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444',
              borderRadius: '5px', padding: '3px 7px', cursor: 'pointer', fontSize: '0.8rem',
            }}
          >✗</button>
        </div>
      )}
    </div>
  );
}