import Link from 'next/link';

const dataFmt = value => new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');

export default function TerreiroTable({ terreiros }) {
  return <div className="card-custom" style={{overflowX:'auto'}}><table className="table-custom"><thead><tr><th>Terreiro</th><th>Localização</th><th>Próxima gira</th><th>Giras abertas</th><th>Distância</th><th></th></tr></thead><tbody>{terreiros.map(t => { const gira=t.giras[0]; return <tr key={t.slug}><td><b>{t.nome}</b><small className="d-block" style={{color:'var(--cor-texto-suave)'}}>{t.descricao || 'Perfil público AxeFlow'}</small></td><td>{t.cidade}{t.bairro ? ` · ${t.bairro}` : ''}</td><td>{gira ? <><b>{gira.titulo}</b><small className="d-block" style={{color:'var(--cor-texto-suave)'}}>{dataFmt(gira.data)} às {gira.horario}</small></> : 'Sem giras divulgadas'}</td><td>{t.total_giras_abertas}</td><td>{t.distancia_km != null ? `${t.distancia_km} km` : '—'}</td><td><Link href={`/portal/${t.slug}`} className="btn-outline-gold" style={{textDecoration:'none',whiteSpace:'nowrap'}}>Ver terreiro</Link></td></tr>; })}</tbody></table></div>;
}
