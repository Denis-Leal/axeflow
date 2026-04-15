/**
 * components/gira/GiraTable.jsx — AxeFlow
 * Tabela de giras para desktop.
 * Recebe ViewModel — sem dados crus da API.
 */
import Link from 'next/link';
import { Badge, ProgressBar } from '../ui';

export default function GiraTable({ giras, onEntrar, podeGerenciar, podeExcluir, onDelete }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table-custom">
        <thead>
          <tr>
            <th>Título</th>
            <th>Tipo</th>
            <th>Data</th>
            <th>Horário</th>
            <th style={{ minWidth: '140px' }}>Vagas</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {giras.map(g => (
            <tr key={g.id}>
              <td>
                <div style={{ fontWeight: 600 }}>{g.titulo}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>
                  {g.acessoIcon} {g.acessoLabel}
                </div>
              </td>
              <td style={{ color: 'var(--cor-texto-suave)' }}>{g.tipo || '—'}</td>
              <td>{g.dataFormatada}</td>
              <td>{g.horarioFmt}</td>
              <td>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.78rem' }}>
                  <span style={{ color: 'var(--cor-texto-suave)' }}>ocupação</span>
                  <span style={{ color: g.ratio >= 0.9 ? 'var(--cor-perigo)' : 'var(--cor-sucesso)', fontWeight: 700 }}>
                    {g.vagasOcupadas}
                  </span>
                </div>
                <ProgressBar ratio={g.ratio} height="4px" />
              </td>
              <td><Badge preset={g.status}>{g.statusLabel}</Badge></td>
              <td>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {!g.concluida && (
                    <button
                      onClick={() => onEntrar?.(g)}
                      title="Registrar consumo"
                      style={{
                        background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)',
                        color: 'var(--cor-acento)', borderRadius: '6px', padding: '0.2rem 0.5rem',
                        cursor: 'pointer', fontSize: '0.8rem',
                      }}
                    >
                      <i className="bi bi-box-arrow-in-right" />
                    </button>
                  )}
                  <Link
                    href={`/giras/${g.id}`}
                    title="Ver inscrições"
                    style={{
                      padding: '0.2rem 0.5rem', background: 'transparent',
                      border: '1px solid var(--cor-borda)', borderRadius: '6px',
                      color: 'var(--cor-texto-suave)', textDecoration: 'none', fontSize: '0.8rem',
                      display: 'inline-flex', alignItems: 'center',
                    }}
                  >
                    <i className="bi bi-list-ul" />
                  </Link>
                  {podeGerenciar && (
                    <Link
                      href={`/giras/editar/${g.id}`}
                      title="Editar"
                      style={{
                        padding: '0.2rem 0.5rem', background: 'transparent',
                        border: '1px solid var(--cor-borda)', borderRadius: '6px',
                        color: 'var(--cor-texto-suave)', textDecoration: 'none', fontSize: '0.8rem',
                        display: 'inline-flex', alignItems: 'center',
                      }}
                    >
                      <i className="bi bi-pencil" />
                    </Link>
                  )}
                  {g.slugPublico && (
                    <a
                      href={`/public/${g.slugPublico}`} target="_blank" rel="noopener noreferrer"
                      title="Página pública"
                      style={{
                        padding: '0.2rem 0.5rem', background: 'transparent',
                        border: '1px solid var(--cor-borda)', borderRadius: '6px',
                        color: 'var(--cor-texto-suave)', textDecoration: 'none', fontSize: '0.8rem',
                        display: 'inline-flex', alignItems: 'center',
                      }}
                    >
                      <i className="bi bi-share" />
                    </a>
                  )}
                  {podeExcluir && (
                    <button
                      onClick={() => onDelete?.(g.id)}
                      title="Excluir"
                      style={{
                        background: 'transparent', border: '1px solid rgba(239,68,68,0.3)',
                        color: '#ef4444', borderRadius: '6px', padding: '0.2rem 0.5rem',
                        cursor: 'pointer', fontSize: '0.8rem',
                      }}
                    >
                      <i className="bi bi-trash" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {giras.length === 0 && (
            <tr>
              <td colSpan="7">
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--cor-texto-suave)' }}>
                  <i className="bi bi-stars" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.75rem', opacity: 0.4 }} />
                  <p style={{ margin: '0 0 1rem' }}>Nenhuma gira cadastrada</p>
                  <Link href="/giras/nova" className="btn-gold">Criar primeira gira</Link>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}