import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Sidebar from '../../components/Sidebar';
import BottomNav from '../../components/BottomNav';
import api from '../../services/api';

// ── Paleta de cores por classificação de score ────────────────────────────────
const COR = {
  verde:    { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)',  text: '#10b981' },
  amarelo:  { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)',  text: '#f59e0b' },
  laranja:  { bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.35)',  text: '#f97316' },
  vermelho: { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)',   text: '#ef4444' },
  cinza:    { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.25)', text: '#94a3b8' },
};

// ── Labels de status de retorno ───────────────────────────────────────────────
const STATUS_RETORNO = {
  ativo:            { label: 'Ativo',           cor: '#10b981', emoji: '🟢', desc: 'Veio nos últimos 60 dias' },
  morno:            { label: 'Morno',           cor: '#f59e0b', emoji: '🟡', desc: 'Entre 60 e 180 dias sem vir' },
  inativo:          { label: 'Inativo',         cor: '#ef4444', emoji: '🔴', desc: 'Mais de 180 dias sem comparecer' },
  nunca_compareceu: { label: 'Nunca compareceu',cor: '#94a3b8', emoji: '⚫', desc: 'Inscreveu mas nunca apareceu' },
};

// ── Ícone por status de inscrição ─────────────────────────────────────────────
const ICONE_STATUS = {
  compareceu: 'bi-check-circle-fill',
  faltou:     'bi-x-circle-fill',
  confirmado: 'bi-clock-fill',
  cancelado:  'bi-dash-circle',
};

export default function PerfilConsulente() {
  const router = useRouter();
  const { id } = router.query;

  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!id) return;

    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    // CORREÇÃO: o endpoint correto é /consulentes/{id}/perfil (inscricao_router),
    // não /membros/consulentes/{id}/perfil (membros_router retorna dados resumidos).
    api.get(`/consulentes/${id}/perfil`)
      .then(r => setPerfil(r.data))
      .catch(err => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          router.push('/login');
        } else {
          setErro('Consulente não encontrado');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
      <div className="spinner-gold"></div>
    </div>
  );

  // ── Erro / não encontrado ─────────────────────────────────────────────────
  if (erro || !perfil) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:'2rem', marginBottom:'1rem' }}>☽✦☾</div>
        <p style={{ color:'var(--cor-texto-suave)' }}>{erro || 'Perfil não encontrado'}</p>
        <Link href="/consulentes" style={{ color:'var(--cor-acento)' }}>← Voltar</Link>
      </div>
    </div>
  );

  // ── Dados derivados ───────────────────────────────────────────────────────
  const sc           = perfil.score;
  const scoreCor     = COR[sc?.cor] || COR.cinza;
  const retorno      = STATUS_RETORNO[perfil.status_retorno] || STATUS_RETORNO.nunca_compareceu;
  const finalizadas  = perfil.comparecimentos + perfil.faltas;
  const taxaPresenca = finalizadas > 0 ? Math.round((perfil.comparecimentos / finalizadas) * 100) : null;

  return (
    <>
      <Head><title>{perfil.nome} | AxeFlow</title></Head>
      <div style={{ display:'flex' }}>
        <Sidebar />
        <div className="main-content">

          {/* ── Topbar ── */}
          <div className="topbar">
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
              {/* Avatar com inicial do nome */}
              <div style={{
                width:'44px', height:'44px', borderRadius:'50%',
                background:'rgba(212,175,55,0.12)', border:'1px solid rgba(212,175,55,0.3)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'Cinzel', color:'var(--cor-acento)', fontSize:'1.2rem', fontWeight:700, flexShrink:0,
              }}>
                {perfil.nome.charAt(0).toUpperCase()}
              </div>
              <div>
                <h5 style={{ fontFamily:'Cinzel', color:'var(--cor-acento)', margin:0 }}>{perfil.nome}</h5>
                <small style={{ color:'var(--cor-texto-suave)' }}>{perfil.telefone}</small>
              </div>
            </div>
            <Link href="/consulentes" style={{ color:'var(--cor-texto-suave)', textDecoration:'none', fontSize:'0.9rem' }}>
              ← Voltar
            </Link>
          </div>

          <div className="page-content">

            {/* ── Badges de status ── */}
            <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginBottom:'1.5rem' }}>
              <span style={{
                background:scoreCor.bg, border:`1px solid ${scoreCor.border}`, color:scoreCor.text,
                borderRadius:'20px', padding:'4px 14px', fontSize:'0.8rem', fontWeight:600,
              }}>
                {sc?.emoji} {sc?.label}{sc?.score != null ? ` — ${sc.score}%` : ''}
              </span>
              <span style={{
                background:`${retorno.cor}18`, border:`1px solid ${retorno.cor}40`, color:retorno.cor,
                borderRadius:'20px', padding:'4px 14px', fontSize:'0.8rem', fontWeight:600,
              }}>
                {retorno.emoji} {retorno.label}
              </span>
              {perfil.primeira_visita && (
                <span style={{
                  background:'rgba(148,163,184,0.08)', border:'1px solid rgba(148,163,184,0.2)',
                  color:'#94a3b8', borderRadius:'20px', padding:'4px 14px', fontSize:'0.8rem',
                }}>
                  🆕 Nunca retornou
                </span>
              )}
              {sc?.alerta && (
                <span style={{
                  background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.3)',
                  color:'#f97316', borderRadius:'20px', padding:'4px 14px', fontSize:'0.8rem', fontWeight:600,
                }}>
                  ⚠ Faltante crônico
                </span>
              )}
            </div>

            {/* ── Cards de métricas ── */}
            <div style={{
              display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(148px, 1fr))',
              gap:'0.75rem', marginBottom:'1.5rem',
            }}>

              <div className="stat-card">
                <div style={{ fontSize:'0.7rem', color:'var(--cor-texto-suave)', marginBottom:'2px' }}>Visitas confirmadas</div>
                <div className="stat-value" style={{ color:'#10b981' }}>{perfil.comparecimentos}</div>
                <div style={{ fontSize:'0.72rem', color:'var(--cor-texto-suave)' }}>comparecimentos</div>
              </div>

              <div className="stat-card">
                <div style={{ fontSize:'0.7rem', color:'var(--cor-texto-suave)', marginBottom:'2px' }}>Faltas</div>
                <div className="stat-value" style={{ color: perfil.faltas >= 3 ? '#ef4444' : 'var(--cor-texto)' }}>
                  {perfil.faltas}
                </div>
                <div style={{ fontSize:'0.72rem', color:'var(--cor-texto-suave)' }}>não apareceu</div>
              </div>

              <div className="stat-card">
                <div style={{ fontSize:'0.7rem', color:'var(--cor-texto-suave)', marginBottom:'4px' }}>Taxa de presença</div>
                {taxaPresenca !== null ? (
                  <>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                      <div className="vagas-bar" style={{ flex:1 }}>
                        <div className="vagas-fill" style={{
                          width:`${taxaPresenca}%`,
                          background: taxaPresenca >= 80 ? '#10b981' : taxaPresenca >= 50 ? '#f59e0b' : '#ef4444',
                        }}></div>
                      </div>
                      <span style={{
                        fontSize:'1rem', fontWeight:700,
                        color: taxaPresenca >= 80 ? '#10b981' : taxaPresenca >= 50 ? '#f59e0b' : '#ef4444',
                      }}>
                        {taxaPresenca}%
                      </span>
                    </div>
                    <div style={{ fontSize:'0.72rem', color:'var(--cor-texto-suave)', marginTop:'4px' }}>
                      {finalizadas} gira{finalizadas !== 1 ? 's' : ''} finalizada{finalizadas !== 1 ? 's' : ''}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize:'0.85rem', color:'var(--cor-texto-suave)' }}>Sem giras finalizadas ainda</div>
                )}
              </div>

              <div className="stat-card">
                <div style={{ fontSize:'0.7rem', color:'var(--cor-texto-suave)', marginBottom:'2px' }}>Última visita</div>
                <div style={{ fontSize:'1.1rem', fontWeight:700, color:retorno.cor }}>
                  {perfil.ultima_visita
                    ? new Date(perfil.ultima_visita + 'T00:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })
                    : '—'}
                </div>
                <div style={{ fontSize:'0.72rem', color:'var(--cor-texto-suave)' }}>
                  {perfil.dias_ausente != null
                    ? perfil.dias_ausente === 0 ? 'hoje'
                      : perfil.dias_ausente === 1 ? 'ontem'
                      : `há ${perfil.dias_ausente} dias`
                    : retorno.desc}
                </div>
              </div>

              <div className="stat-card">
                <div style={{ fontSize:'0.7rem', color:'var(--cor-texto-suave)', marginBottom:'2px' }}>Primeira visita</div>
                <div style={{ fontSize:'1rem', fontWeight:700 }}>
                  {perfil.primeira_data
                    ? new Date(perfil.primeira_data + 'T00:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' })
                    : '—'}
                </div>
                <div style={{ fontSize:'0.72rem', color:'var(--cor-texto-suave)' }}>
                  {perfil.primeira_data && perfil.ultima_visita && perfil.primeira_data !== perfil.ultima_visita
                    ? (() => {
                        const meses = Math.round(
                          (new Date(perfil.ultima_visita) - new Date(perfil.primeira_data)) / (1000 * 60 * 60 * 24 * 30)
                        );
                        return meses > 0 ? `${meses} ${meses === 1 ? 'mês' : 'meses'} de histórico` : 'mesmo mês';
                      })()
                    : 'cadastrado em ' + new Date(perfil.cadastrado_em).toLocaleDateString('pt-BR')}
                </div>
              </div>

              {/* Card de tipos favoritos — apenas se houver dados */}
              {perfil.tipos_favoritos?.length > 0 && (
                <div className="stat-card">
                  <div style={{ fontSize:'0.7rem', color:'var(--cor-texto-suave)', marginBottom:'6px' }}>Giras preferidas</div>
                  {perfil.tipos_favoritos.slice(0, 3).map(([tipo, qtd]) => (
                    <div key={tipo} style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                      <span style={{ fontSize:'0.78rem' }}>{tipo}</span>
                      <span style={{ fontSize:'0.72rem', color:'var(--cor-acento)', fontWeight:600 }}>{qtd}×</span>
                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* ── Linha do tempo de giras ── */}
            <div className="card-custom">
              <div className="card-header" style={{ display:'flex', alignItems:'center' }}>
                <span style={{ fontFamily:'Cinzel', fontSize:'0.9rem', color:'var(--cor-acento)' }}>
                  ✦ Histórico de Giras
                </span>
                <span style={{ fontSize:'0.78rem', color:'var(--cor-texto-suave)', marginLeft:'auto' }}>
                  {perfil.historico.length} registro{perfil.historico.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div style={{ padding:'1.25rem' }}>
                {perfil.historico.length === 0 && (
                  <div className="empty-state"><p>Nenhuma gira registrada ainda</p></div>
                )}

                {perfil.historico.map((h, idx) => {
                  // Cor de fundo por status da inscrição
                  const scGira = {
                    compareceu: { bg:'rgba(16,185,129,0.1)',  text:'#10b981' },
                    faltou:     { bg:'rgba(239,68,68,0.09)',  text:'#ef4444' },
                    confirmado: { bg:'rgba(212,175,55,0.09)', text:'#d4af37' },
                    cancelado:  { bg:'rgba(148,163,184,0.07)',text:'#94a3b8' },
                  }[h.status] || { bg:'rgba(148,163,184,0.07)', text:'#94a3b8' };

                  const isLast = idx === perfil.historico.length - 1;

                  // Campo de data: o backend retorna gira_data no perfil do inscricao_router
                  const dataStr = h.gira_data || h.data;

                  return (
                    <div key={`${h.gira_id}-${idx}`} style={{ display:'flex', gap:'1rem', paddingBottom: isLast ? 0 : '1.1rem' }}>

                      {/* Ícone + linha vertical */}
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                        <div style={{
                          width:'32px', height:'32px', borderRadius:'50%',
                          background:scGira.bg, border:`2px solid ${scGira.text}35`,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          color:scGira.text, fontSize:'0.85rem',
                        }}>
                          <i className={`bi ${ICONE_STATUS[h.status] || 'bi-dash-circle'}`}></i>
                        </div>
                        {!isLast && (
                          <div style={{ width:'2px', flex:1, background:'var(--cor-borda)', marginTop:'4px', minHeight:'16px' }}></div>
                        )}
                      </div>

                      {/* Conteúdo do item */}
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'0.25rem' }}>
                          <div>
                            <Link
                              href={`/giras/${h.gira_id}`}
                              style={{ color:'var(--cor-texto)', textDecoration:'none', fontWeight:600, fontSize:'0.9rem' }}
                            >
                              {h.gira_titulo}
                            </Link>
                            {h.gira_tipo && (
                              <span style={{
                                marginLeft:'6px', fontSize:'0.7rem', color:'var(--cor-texto-suave)',
                                background:'rgba(255,255,255,0.05)', borderRadius:'4px', padding:'1px 6px',
                              }}>
                                {h.gira_tipo}
                              </span>
                            )}
                          </div>
                          {dataStr && (
                            <span style={{ fontSize:'0.75rem', color:'var(--cor-texto-suave)', whiteSpace:'nowrap' }}>
                              {new Date(dataStr + 'T00:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' })}
                            </span>
                          )}
                        </div>

                        <div style={{ display:'flex', gap:'0.5rem', marginTop:'3px', alignItems:'center' }}>
                          <span style={{ fontSize:'0.72rem', color:scGira.text, fontWeight:600 }}>
                            {h.status === 'compareceu' ? '✓ Compareceu'
                              : h.status === 'faltou'     ? '✗ Faltou'
                              : h.status === 'confirmado' ? '⏳ Confirmado'
                              : '— Cancelado'}
                          </span>
                          {h.posicao && (
                            <span style={{ fontSize:'0.7rem', color:'var(--cor-texto-suave)' }}>
                              · {h.posicao}º na lista
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}