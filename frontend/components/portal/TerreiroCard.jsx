import Link from 'next/link';

const dataFmt = value => new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');

export default function TerreiroCard({ terreiro }) {
  const proxima = terreiro.giras[0];
  return <article className="card-custom p-4 h-100">
    <div className="d-flex justify-content-between gap-2"><small style={{color:'var(--cor-acento)'}}>{terreiro.cidade}{terreiro.bairro ? ` · ${terreiro.bairro}` : ''}</small>{terreiro.distancia_km != null && <small style={{color:'var(--cor-texto-suave)'}}>{terreiro.distancia_km} km</small>}</div>
    <h3 style={{fontSize:'1.1rem',marginTop:'.5rem'}}>{terreiro.nome}</h3>
    <p style={{color:'var(--cor-texto-suave)',fontSize:'.9rem'}}>{terreiro.descricao || 'Conheça este terreiro no Portal AxeFlow.'}</p>
    {proxima && <div style={{borderTop:'1px solid var(--cor-borda)',paddingTop:'.75rem',fontSize:'.85rem'}}><span style={{color:'var(--cor-acento)'}}>Próxima gira</span><br/><b>{proxima.titulo}</b> · {dataFmt(proxima.data)}{terreiro.total_giras_abertas > 1 && <small className="d-block" style={{color:'var(--cor-texto-suave)',marginTop:4}}>+ {terreiro.total_giras_abertas - 1} gira{terreiro.total_giras_abertas > 2 ? 's' : ''} aberta{terreiro.total_giras_abertas > 2 ? 's' : ''}</small>}</div>}
    <Link href={`/portal/${terreiro.slug}`} className="btn-outline-gold d-inline-block mt-3" style={{textDecoration:'none'}}>Ver terreiro</Link>
  </article>;
}
