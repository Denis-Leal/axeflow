/**
 * components/gira/GiraCard.jsx — AxeFlow
 * Card de gira para mobile. NUNCA usa tabela.
 * Recebe ViewModel — sem dados crus da API.
 */
import Link from 'next/link';
import { toast } from 'react-toastify';
import { Badge, ProgressBar, Button } from '../ui';
import { useRouter } from 'next/router';

export default function GiraCard({ gira, onEntrar, podeGerenciar, podeExcluir, onDelete }) {
  const router = useRouter();
  return (
    <div onClick={() => router.push(`/giras/${gira.id}`)} style={{
      background:    'var(--cor-card)',
      border:        '1px solid var(--cor-borda)',
      borderRadius:  '12px',
      overflow:      'hidden',
      marginBottom:  '0.75rem',
    }}>
      {/* Header: título + badges */}
      <div style={{ padding: '0.85rem 1rem 0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--cor-texto)', lineHeight: 1.3, flex: 1 }}>
            {gira.titulo}
          </div>
          <Badge preset={gira.status} size='sm'>{gira.statusLabel}</Badge>
        </div>

        {gira.tipo && (
          <div style={{ fontSize: '0.78rem', color: 'var(--cor-texto-suave)', marginBottom: '0.5rem' }}>
            {gira.tipo}
          </div>
        )}

        {/* Data + hora + acesso */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--cor-texto-suave)' }}>
          <span><i className="bi bi-calendar3 me-1" />{gira.dataCompacta}</span>
          <span><i className="bi bi-clock me-1" />{gira.horarioFmt}</span>
          <span>{gira.acessoIcon} {gira.acessoLabel}</span>
        </div>
      </div>

      {/* Vagas */}
      <div style={{ padding: '0.5rem 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.78rem', color: 'var(--cor-texto-suave)' }}>
          <span>Vagas</span>
          <span style={{ fontWeight: 700, color: gira.ratio >= 0.9 ? 'var(--cor-perigo)' : 'var(--cor-texto)' }}>
            {gira.vagasOcupadas}
          </span>
        </div>
        <ProgressBar ratio={gira.ratio} height="5px" />
      </div>

      {/* Ações */}
      <div style={{
        padding:     '0.5rem 1rem 0.85rem',
        display:     'flex',
        gap:         '0.4rem',
        flexWrap:    'wrap',
      }}>
        {/* Ação principal: lista de inscrições */}
        <Link
          href={`/giras/${gira.id}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex:           '1',
            minWidth:       '100px',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            '0.35rem',
            padding:        '0.45rem 0.75rem',
            background:     'rgba(212,175,55,0.12)',
            border:         '1px solid rgba(212,175,55,0.35)',
            borderRadius:   '8px',
            color:          'var(--cor-acento)',
            fontWeight:     600,
            fontSize:       '0.82rem',
            textDecoration: 'none',
          }}
        >
          <i className="bi bi-list-ul" /> Inscrições
        </Link>
        {/* Inscrever */}
        {gira.slugPublico && (
          <Link
            href={`/giras/${gira.slugPublico}/inscricoes`}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex:           '1',
              minWidth:       '100px',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            '0.35rem',
              padding:        '0.45rem 0.75rem',
              background:     'rgba(102, 55, 212, 0.12)',
              border:         '1px solid rgba(212,175,55,0.35)',
              borderRadius:   '8px',
              color:          'var(--cor-acento)',
              fontWeight:     600,
              fontSize:       '0.82rem',
              textDecoration: 'none',
            }}
          >
            <i className="bi bi-person-plus"></i>Inscrever
          </Link>
        )}

        {/* Consumo */}
        {!gira.concluida && (
          <button
            // onClick={() => onEntrar?.(gira)}
            onClick={e => {e.stopPropagation(); onEntrar?.(gira)}}
            style={{
              flex:        1,
              minWidth:    '80px',
              padding:     '0.45rem 0.75rem',
              background:  'rgba(107,33,168,0.15)',
              border:      '1px solid rgba(107,33,168,0.35)',
              borderRadius:'8px',
              color:       '#a78bfa',
              fontWeight:  600,
              fontSize:    '0.82rem',
              cursor:      'pointer',
              display:     'flex',
              alignItems:  'center',
              justifyContent: 'center',
              gap:         '0.35rem',
            }}
          >
            <i className="bi bi-box-arrow-in-right" /> Consumo
          </button>
        )}

        {/* Link público */}
        {gira.slugPublico && (
          <button
              onClick={(e) => {
                e.stopPropagation();
                console.log('CLICK COPY');

                const url = `${window.location.origin}/public/${gira.slugPublico}`;

                navigator.clipboard.writeText(url)
                  .then(() => {
                    toast.success('Link copiado para a área de transferência');
                  })
                  .catch((err) => {
                    toast.error('Erro ao copiar o link.', { autoClose: 4000 });
                  });
              }}
            style={{
              padding:     '0.45rem 0.6rem',
              background:  'transparent',
              border:      '1px solid var(--cor-borda)',
              borderRadius:'8px',
              color:       'var(--cor-texto-suave)',
              display:     'flex',
              alignItems:  'center',
              textDecoration: 'none',
            }}
          >
            <i className="bi bi-copy"></i>
          </button>
        )}

        {/* Editar */}
        {podeGerenciar && (
          <Link
            href={`/giras/editar/${gira.id}`}
            onClick={(e) => e.stopPropagation()}
            title="Editar"
            style={{
              padding:     '0.45rem 0.6rem',
              background:  'transparent',
              border:      '1px solid var(--cor-borda)',
              borderRadius:'8px',
              color:       'var(--cor-texto-suave)',
              display:     'flex',
              alignItems:  'center',
              textDecoration: 'none',
            }}
          >
            <i className="bi bi-pencil" />
          </Link>
        )}

        {/* Excluir */}
        {podeExcluir && (
          <button
            // onClick={() => onDelete?.(gira.id)}
            onClick={e => {e.stopPropagation(); onDelete?.(gira.id)}}
            title="Excluir"
            style={{
              padding:     '0.45rem 0.6rem',
              background:  'transparent',
              border:      '1px solid rgba(239,68,68,0.3)',
              borderRadius:'8px',
              color:       '#ef4444',
              cursor:      'pointer',
              display:     'flex',
              alignItems:  'center',
            }}
          >
            <i className="bi bi-trash" />
          </button>
        )}
      </div>
    </div>
  );
}