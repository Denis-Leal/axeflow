/**
 * components/membro/MembroListTable.jsx — AxeFlow
 * Tabela desktop de membros para a tela de listagem/gerenciamento.
 * Recebe ViewModel (buildMembroItem) — sem dados crus da API.
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

export default function MembroListTable({ membros, isAdmin, onEditar }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table-custom">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Email</th>
            <th>Telefone</th>
            <th>Perfil</th>
            <th>Status</th>
            {isAdmin && <th>Ações</th>}
          </tr>
        </thead>
        <tbody>
          {membros.map(m => (
            <tr key={m.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Avatar inicial={m.inicial} />
                  <div>
                    <Link href={`/membros/${m.id}`}
                      style={{ color: 'var(--cor-texto)', textDecoration: 'none', fontWeight: 600 }}>
                      {m.nome}
                    </Link>
                    {m.souEu && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--cor-texto-suave)', marginLeft: '0.4rem' }}>
                        (você)
                      </span>
                    )}
                  </div>
                </div>
              </td>
              <td style={{ color: 'var(--cor-texto-suave)' }}>{m.email}</td>
              <td style={{ color: 'var(--cor-texto-suave)' }}>{m.telefone}</td>
              <td><RoleBadge label={m.roleLabel} color={m.roleColor} /></td>
              <td>
                <span style={{
                  fontSize: '0.75rem', fontWeight: 600,
                  padding: '0.2rem 0.65rem', borderRadius: '15px',
                  background: m.ativo ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                  color: m.ativo ? '#10b981' : '#ef4444',
                }}>
                  {m.statusLabel}
                </span>
              </td>
              {isAdmin && (
                <td>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <Button variant="ghost" size="sm" onClick={() => onEditar(m)}
                      style={{ border: '1px solid var(--cor-borda)' }}>
                      <i className="bi bi-pencil" />
                    </Button>
                    <Button variant="outline" size="sm" as="a" href={`/membros/${m.id}`}>
                      <i className="bi bi-bar-chart-line" />
                    </Button>
                  </div>
                </td>
              )}
            </tr>
          ))}
          {membros.length === 0 && (
            <tr><td colSpan={isAdmin ? 6 : 5}>
              <EmptyState icon="person-badge" title="Nenhum membro cadastrado" />
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}