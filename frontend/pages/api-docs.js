/**
 * pages/api-docs.js — AxeFlow
 *
 * Página de documentação da API e gestão de API Keys.
 * Acessível apenas a admins (criação/revogação de chaves).
 * Membros e operadores podem ver a documentação mas não gerenciar chaves.
 *
 * Seções:
 *   1. Gestão de chaves (admin): criar, listar, revogar
 *   2. Documentação dos endpoints com exemplos
 *   3. Exemplos de integração: curl, n8n, Make
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import api from '../services/api';

// ── Constante: URL base da API ────────────────────────────────────────────────
const API_BASE = 'https://axeflow-backend.onrender.com';

// ── Scopes disponíveis com metadados visuais ──────────────────────────────────
const SCOPES_META = {
  'giras:read':       { cor: '#60a5fa', label: 'Giras — Leitura',         icone: 'bi-eye' },
  'giras:write':      { cor: '#a78bfa', label: 'Giras — Escrita',         icone: 'bi-pencil' },
  'inscricoes:read':  { cor: '#34d399', label: 'Inscrições — Leitura',    icone: 'bi-eye' },
  'inscricoes:write': { cor: '#10b981', label: 'Inscrições — Escrita',    icone: 'bi-pencil' },
  'presenca:write':   { cor: '#f59e0b', label: 'Presença — Escrita',      icone: 'bi-check2-circle' },
  'relatorios:read':  { cor: '#d4af37', label: 'Relatórios — Leitura',    icone: 'bi-bar-chart' },
  'membros:read':     { cor: '#f97316', label: 'Membros — Leitura',       icone: 'bi-people' },
};

// ── Documentação dos endpoints ────────────────────────────────────────────────
const ENDPOINTS = [
  {
    metodo:  'GET',
    path:    '/v1/giras',
    scope:   'giras:read',
    titulo:  'Listar Giras',
    desc:    'Retorna todas as giras ativas do seu terreiro.',
    resposta: `[
  {
    "id": "uuid",
    "titulo": "Gira de Caboclos",
    "tipo": "Caboclos",
    "acesso": "publica",
    "data": "2026-04-15",
    "horario": "19:00",
    "limite_consulentes": 30,
    "status": "aberta",
    "slug_publico": "gira-de-caboclos-2026-04-15-a3f7"
  }
]`,
  },
  {
    metodo:  'GET',
    path:    '/v1/giras/{id}/inscricoes',
    scope:   'inscricoes:read',
    titulo:  'Inscrições de uma Gira',
    desc:    'Retorna a lista de inscrições de consulentes de uma gira específica.',
    resposta: `[
  {
    "id": "uuid",
    "posicao": 1,
    "status": "confirmado",
    "nome": "Maria Silva",
    "telefone": "5511999999999",
    "criado_em": "2026-04-10T14:30:00"
  }
]`,
  },
  {
    metodo:  'POST',
    path:    '/v1/giras/{slug}/inscrever',
    scope:   'inscricoes:write',
    titulo:  'Inscrever Consulente',
    desc:    'Inscreve um consulente em uma gira pública via slug. Ideal para integrar com WhatsApp.',
    body: `{
  "nome": "Maria Silva",
  "telefone": "11999999999",
  "primeira_visita": false,
  "observacoes": "Veio encaminhada pela Maria"
}`,
    resposta: `{
  "id": "uuid",
  "posicao": 5,
  "status": "confirmado",
  "consulente_nome": "Maria Silva"
}`,
  },
  {
    metodo:  'GET',
    path:    '/v1/relatorios/consulentes',
    scope:   'relatorios:read',
    titulo:  'Ranking de Consulentes',
    desc:    'Retorna o ranking de presença de todos os consulentes do terreiro.',
    resposta: `[
  {
    "id": "uuid",
    "nome": "Maria Silva",
    "telefone": "5511999999999",
    "score": 92,
    "label": "Confiável",
    "cor": "verde",
    "comparecimentos": 12,
    "faltas": 1
  }
]`,
  },
  {
    metodo:  'PATCH',
    path:    '/v1/inscricoes/{id}/presenca',
    scope:   'presenca:write',
    titulo:  'Marcar Presença',
    desc:    'Atualiza o status de presença de um consulente após a gira.',
    body: `{
  "status": "compareceu"
}`,
    resposta: `{
  "ok": true,
  "status": "compareceu"
}`,
  },
];

// ── Componente: badge de método HTTP ──────────────────────────────────────────
function MetodoBadge({ metodo }) {
  const cores = {
    GET:    { bg: 'rgba(96,165,250,0.15)',  text: '#60a5fa',  border: 'rgba(96,165,250,0.3)' },
    POST:   { bg: 'rgba(16,185,129,0.15)', text: '#10b981',  border: 'rgba(16,185,129,0.3)' },
    PATCH:  { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b',  border: 'rgba(245,158,11,0.3)' },
    DELETE: { bg: 'rgba(239,68,68,0.15)',  text: '#ef4444',  border: 'rgba(239,68,68,0.3)' },
  };
  const c = cores[metodo] || cores.GET;
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.5px',
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      borderRadius: '6px', padding: '2px 8px', fontFamily: 'monospace',
    }}>
      {metodo}
    </span>
  );
}

// ── Componente: bloco de código com botão copiar ──────────────────────────────
function BlocoCodigo({ codigo, linguagem = 'bash' }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    await navigator.clipboard.writeText(codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div style={{ position: 'relative' }}>
      <pre style={{
        background: '#0a0515',
        border: '1px solid rgba(212,175,55,0.15)',
        borderRadius: '8px',
        padding: '1rem',
        overflowX: 'auto',
        fontSize: '0.78rem',
        lineHeight: 1.6,
        color: '#e8e0f0',
        margin: 0,
        fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
      }}>
        {codigo}
      </pre>
      <button
        onClick={copiar}
        style={{
          position: 'absolute', top: '0.5rem', right: '0.5rem',
          background: copiado ? 'rgba(16,185,129,0.2)' : 'rgba(212,175,55,0.1)',
          border: `1px solid ${copiado ? 'rgba(16,185,129,0.4)' : 'rgba(212,175,55,0.25)'}`,
          color: copiado ? '#10b981' : 'var(--cor-texto-suave)',
          borderRadius: '6px', padding: '0.25rem 0.6rem',
          cursor: 'pointer', fontSize: '0.72rem',
          transition: 'all 0.15s',
        }}
      >
        {copiado ? '✓ Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

// ── Componente: card de endpoint documentado ──────────────────────────────────
function CardEndpoint({ ep, apiBase }) {
  const [aberto, setAberto] = useState(false);
  const scopeMeta = SCOPES_META[ep.scope] || {};

  // Monta exemplo curl com placeholder da chave
  const exemploCurl = ep.body
    ? `curl -X ${ep.metodo} "${apiBase}${ep.path}" \\
  -H "Authorization: Bearer axf_SUA_CHAVE_AQUI" \\
  -H "Content-Type: application/json" \\
  -d '${ep.body}'`
    : `curl -X ${ep.metodo} "${apiBase}${ep.path}" \\
  -H "Authorization: Bearer axf_SUA_CHAVE_AQUI"`;

  return (
    <div style={{
      border: '1px solid var(--cor-borda)',
      borderRadius: '10px',
      overflow: 'hidden',
      background: 'rgba(255,255,255,0.01)',
    }}>
      {/* Cabeçalho clicável */}
      <button
        onClick={() => setAberto(v => !v)}
        style={{
          width: '100%', background: 'none', border: 'none',
          padding: '0.85rem 1rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          textAlign: 'left',
        }}
      >
        <MetodoBadge metodo={ep.metodo} />
        <code style={{
          fontSize: '0.85rem', color: 'var(--cor-texto)',
          fontFamily: "'Fira Code', monospace", flex: 1,
        }}>
          {ep.path}
        </code>
        {/* Badge de scope */}
        <span style={{
          fontSize: '0.68rem', color: scopeMeta.cor || '#94a3b8',
          background: `${scopeMeta.cor || '#94a3b8'}15`,
          border: `1px solid ${scopeMeta.cor || '#94a3b8'}30`,
          borderRadius: '20px', padding: '1px 8px', whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: '0.3rem',
        }}>
          <i className={`bi ${scopeMeta.icone || 'bi-lock'}`}></i>
          {ep.scope}
        </span>
        <i className={`bi bi-chevron-${aberto ? 'up' : 'down'}`}
           style={{ color: 'var(--cor-texto-suave)', fontSize: '0.8rem', flexShrink: 0 }} />
      </button>

      {/* Conteúdo expandido */}
      {aberto && (
        <div style={{
          borderTop: '1px solid var(--cor-borda)',
          padding: '1rem',
          display: 'flex', flexDirection: 'column', gap: '1rem',
        }}>
          <p style={{ color: 'var(--cor-texto-suave)', fontSize: '0.85rem', margin: 0 }}>
            {ep.desc}
          </p>

          {/* Body (se POST/PATCH) */}
          {ep.body && (
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--cor-texto-suave)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Request Body
              </div>
              <BlocoCodigo codigo={ep.body} linguagem="json" />
            </div>
          )}

          {/* Resposta */}
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--cor-texto-suave)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Resposta (200)
            </div>
            <BlocoCodigo codigo={ep.resposta} linguagem="json" />
          </div>

          {/* Exemplo curl */}
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--cor-texto-suave)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Exemplo curl
            </div>
            <BlocoCodigo codigo={exemploCurl} linguagem="bash" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ApiDocs() {
  const router = useRouter();

  const [user, setUser]       = useState(null);
  const [chaves, setChaves]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [abaSelecionada, setAbaSelecionada] = useState('docs'); // 'docs' | 'chaves' | 'exemplos'

  // ── Estado do modal de criação ────────────────────────────────────────────
  const [showCriar, setShowCriar]     = useState(false);
  const [formNome, setFormNome]       = useState('');
  const [formDesc, setFormDesc]       = useState('');
  const [scopesSel, setScopesSel]     = useState([]);
  const [criando, setCriando]         = useState(false);
  const [chaveCriada, setChaveCriada] = useState(null); // exibida UMA VEZ
  const [erroCriar, setErroCriar]     = useState('');

  // ── Estado de revogação ───────────────────────────────────────────────────
  const [revogando, setRevogando] = useState({});

  // ── Carregamento inicial ──────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    Promise.all([api.get('/auth/me'), api.get('/api-keys')])
      .then(([meRes, chavesRes]) => {
        setUser(meRes.data);
        setChaves(chavesRes.data);
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, []);

  // ── Criar nova chave ──────────────────────────────────────────────────────
  const handleCriar = async (e) => {
    e.preventDefault();
    if (scopesSel.length === 0) { setErroCriar('Selecione ao menos um scope.'); return; }

    setCriando(true);
    setErroCriar('');
    try {
      const res = await api.post('/api-keys', {
        nome:      formNome,
        descricao: formDesc || null,
        scopes:    scopesSel,
      });
      setChaveCriada(res.data.chave); // exibida UMA VEZ
      setChaves(prev => [res.data, ...prev]);
      setFormNome('');
      setFormDesc('');
      setScopesSel([]);
    } catch (err) {
      setErroCriar(err?.response?.data?.detail || 'Erro ao criar chave.');
    } finally {
      setCriando(false);
    }
  };

  // ── Revogar chave ─────────────────────────────────────────────────────────
  const handleRevogar = useCallback(async (keyId, nome) => {
    if (!confirm(`Revogar a chave "${nome}"? Esta ação não pode ser desfeita.`)) return;
    setRevogando(prev => ({ ...prev, [keyId]: true }));
    try {
      await api.delete(`/api-keys/${keyId}`);
      setChaves(prev => prev.map(k =>
        k.id === keyId ? { ...k, ativa: false, revoked_at: new Date().toISOString() } : k
      ));
    } finally {
      setRevogando(prev => ({ ...prev, [keyId]: false }));
    }
  }, []);

  // ── Toggle de scope na criação ────────────────────────────────────────────
  const toggleScope = (scope) => {
    setScopesSel(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner-gold"></div>
    </div>
  );

  const isAdmin = user?.role === 'admin';

  return (
    <>
      <Head><title>API & Integrações | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">

          {/* ── Topbar ── */}
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>
                API & Integrações
              </h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>
                Conecte o AxeFlow com WhatsApp, n8n, Make e mais
              </small>
            </div>
            {isAdmin && abaSelecionada === 'chaves' && (
              <button
                className="btn-gold"
                onClick={() => { setShowCriar(true); setChaveCriada(null); }}
                style={{ fontSize: '0.85rem' }}
              >
                <i className="bi bi-plus-lg me-1"></i> Nova Chave
              </button>
            )}
          </div>

          <div className="page-content">

            {/* ── Abas de navegação ── */}
            <div style={{
              display: 'flex', gap: '0.25rem',
              borderBottom: '1px solid var(--cor-borda)',
              marginBottom: '1.5rem',
            }}>
              {[
                { id: 'docs',     label: 'Documentação',      icone: 'bi-book' },
                { id: 'chaves',   label: 'Minhas Chaves',     icone: 'bi-key', badge: chaves.filter(k => k.ativa).length },
                { id: 'exemplos', label: 'Exemplos n8n/Make', icone: 'bi-diagram-3' },
              ].map(aba => (
                <button
                  key={aba.id}
                  onClick={() => setAbaSelecionada(aba.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0.6rem 1rem', fontSize: '0.85rem', fontWeight: 600,
                    color: abaSelecionada === aba.id ? 'var(--cor-acento)' : 'var(--cor-texto-suave)',
                    borderBottom: abaSelecionada === aba.id
                      ? '2px solid var(--cor-acento)'
                      : '2px solid transparent',
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    transition: 'color 0.15s',
                    marginBottom: '-1px',
                  }}
                >
                  <i className={`bi ${aba.icone}`}></i>
                  {aba.label}
                  {aba.badge > 0 && (
                    <span style={{
                      background: 'rgba(212,175,55,0.2)', color: 'var(--cor-acento)',
                      borderRadius: '10px', padding: '0 6px', fontSize: '0.7rem',
                    }}>
                      {aba.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ════════════════════════════════════════════════════════════════
                ABA: DOCUMENTAÇÃO
            ════════════════════════════════════════════════════════════════ */}
            {abaSelecionada === 'docs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* Intro */}
                <div className="card-custom">
                  <div className="card-header">
                    <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                      ✦ Autenticação
                    </span>
                  </div>
                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <p style={{ color: 'var(--cor-texto-suave)', fontSize: '0.88rem', lineHeight: 1.7, margin: 0 }}>
                      A API do AxeFlow usa <strong style={{ color: 'var(--cor-texto)' }}>API Keys</strong> para
                      autenticar integrações externas. Inclua a chave em todas as requisições via header HTTP:
                    </p>
                    <BlocoCodigo codigo={`Authorization: Bearer axf_SUA_CHAVE_AQUI`} />
                    <div style={{
                      background: 'rgba(212,175,55,0.06)',
                      border: '1px solid rgba(212,175,55,0.2)',
                      borderRadius: '8px', padding: '0.75rem 1rem',
                      display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
                    }}>
                      <i className="bi bi-shield-lock" style={{ color: '#d4af37', flexShrink: 0, marginTop: '1px' }}></i>
                      <span style={{ fontSize: '0.8rem', color: 'var(--cor-texto-suave)', lineHeight: 1.6 }}>
                        Cada chave acessa <strong style={{ color: 'var(--cor-texto)' }}>somente os dados do seu terreiro</strong>.
                        Jamais compartilhe sua chave publicamente. Em caso de vazamento, revogue imediatamente
                        na aba <em>Minhas Chaves</em>.
                      </span>
                    </div>
                    <BlocoCodigo
                      codigo={`# URL base da API\n${API_BASE}`}
                    />
                  </div>
                </div>

                {/* Endpoints */}
                <div className="card-custom">
                  <div className="card-header">
                    <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                      ✦ Endpoints Disponíveis
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--cor-texto-suave)', marginLeft: 'auto' }}>
                      Clique para expandir
                    </span>
                  </div>
                  <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {ENDPOINTS.map(ep => (
                      <CardEndpoint key={ep.path + ep.metodo} ep={ep} apiBase={API_BASE} />
                    ))}
                  </div>
                </div>

                {/* Códigos de erro */}
                <div className="card-custom">
                  <div className="card-header">
                    <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                      ✦ Códigos de Resposta
                    </span>
                  </div>
                  <div style={{ padding: '1rem' }}>
                    <table className="table-custom">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Significado</th>
                          <th>Ação recomendada</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { cod: '200', cor: '#10b981', sig: 'Sucesso',                  acao: '—' },
                          { cod: '400', cor: '#f59e0b', sig: 'Dados inválidos',           acao: 'Verifique o body da requisição' },
                          { cod: '401', cor: '#ef4444', sig: 'Chave ausente/inválida',    acao: 'Verifique o header Authorization' },
                          { cod: '403', cor: '#f97316', sig: 'Scope insuficiente',        acao: 'Crie uma chave com o scope necessário' },
                          { cod: '404', cor: '#94a3b8', sig: 'Recurso não encontrado',    acao: 'Verifique o ID/slug informado' },
                          { cod: '429', cor: '#a78bfa', sig: 'Rate limit atingido',       acao: 'Aguarde antes de retentar' },
                          { cod: '500', cor: '#ef4444', sig: 'Erro interno',              acao: 'Contate o suporte' },
                        ].map(r => (
                          <tr key={r.cod}>
                            <td>
                              <span style={{
                                fontFamily: 'monospace', fontWeight: 700, color: r.cor,
                                background: `${r.cor}15`, borderRadius: '4px', padding: '1px 6px',
                              }}>
                                {r.cod}
                              </span>
                            </td>
                            <td style={{ color: 'var(--cor-texto)' }}>{r.sig}</td>
                            <td style={{ color: 'var(--cor-texto-suave)', fontSize: '0.82rem' }}>{r.acao}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════
                ABA: MINHAS CHAVES
            ════════════════════════════════════════════════════════════════ */}
            {abaSelecionada === 'chaves' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Aviso para não-admin */}
                {!isAdmin && (
                  <div style={{
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: '10px', padding: '0.85rem 1rem',
                    display: 'flex', gap: '0.5rem', alignItems: 'center',
                    fontSize: '0.85rem', color: '#fcd34d',
                  }}>
                    <i className="bi bi-info-circle"></i>
                    Somente administradores podem criar e revogar chaves de API.
                  </div>
                )}

                {/* Alerta chave recém-criada — exibida UMA VEZ */}
                {chaveCriada && (
                  <div style={{
                    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.35)',
                    borderRadius: '12px', padding: '1.25rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>🔑</span>
                      <strong style={{ color: '#10b981' }}>Chave criada! Copie agora — não será exibida novamente.</strong>
                    </div>
                    <BlocoCodigo codigo={chaveCriada} />
                    <button
                      onClick={() => setChaveCriada(null)}
                      style={{
                        marginTop: '0.75rem', background: 'none', border: 'none',
                        color: 'var(--cor-texto-suave)', cursor: 'pointer', fontSize: '0.8rem',
                      }}
                    >
                      ✓ Já copiei, fechar
                    </button>
                  </div>
                )}

                {/* Lista de chaves */}
                <div className="card-custom">
                  <div className="card-header">
                    <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                      ✦ Chaves Cadastradas
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--cor-texto-suave)' }}>
                      {chaves.filter(k => k.ativa).length} ativa{chaves.filter(k => k.ativa).length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {chaves.length === 0 ? (
                    <div className="empty-state">
                      <i className="bi bi-key d-block"></i>
                      <p>Nenhuma chave criada ainda</p>
                      {isAdmin && (
                        <button className="btn-gold" onClick={() => setShowCriar(true)}>
                          Criar primeira chave
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="table-custom">
                        <thead>
                          <tr>
                            <th>Nome</th>
                            <th>Prefixo</th>
                            <th>Scopes</th>
                            <th>Uso</th>
                            <th>Status</th>
                            {isAdmin && <th>Ações</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {chaves.map(k => (
                            <tr key={k.id} style={{ opacity: k.ativa ? 1 : 0.5 }}>
                              <td>
                                <div style={{ fontWeight: 600 }}>{k.nome}</div>
                                {k.descricao && (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--cor-texto-suave)' }}>
                                    {k.descricao}
                                  </div>
                                )}
                              </td>
                              <td>
                                <code style={{
                                  background: 'rgba(212,175,55,0.08)',
                                  border: '1px solid rgba(212,175,55,0.2)',
                                  borderRadius: '4px', padding: '1px 6px',
                                  fontSize: '0.8rem', color: 'var(--cor-acento)',
                                }}>
                                  {k.prefix}...
                                </code>
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                  {(k.scopes || []).map(s => {
                                    const m = SCOPES_META[s];
                                    return (
                                      <span key={s} style={{
                                        fontSize: '0.65rem', color: m?.cor || '#94a3b8',
                                        background: `${m?.cor || '#94a3b8'}12`,
                                        border: `1px solid ${m?.cor || '#94a3b8'}25`,
                                        borderRadius: '4px', padding: '0 5px',
                                      }}>
                                        {s}
                                      </span>
                                    );
                                  })}
                                </div>
                              </td>
                              <td style={{ color: 'var(--cor-texto-suave)', fontSize: '0.8rem' }}>
                                <div>{k.request_count || 0} req</div>
                                {k.last_used_at && (
                                  <div style={{ fontSize: '0.72rem' }}>
                                    {new Date(k.last_used_at).toLocaleDateString('pt-BR')}
                                  </div>
                                )}
                              </td>
                              <td>
                                <span className={`badge-status ${k.ativa ? 'badge-confirmado' : 'badge-cancelado'}`}>
                                  {k.ativa ? 'Ativa' : 'Revogada'}
                                </span>
                              </td>
                              {isAdmin && (
                                <td>
                                  {k.ativa && (
                                    <button
                                      onClick={() => handleRevogar(k.id, k.nome)}
                                      disabled={revogando[k.id]}
                                      style={{
                                        background: 'transparent',
                                        border: '1px solid rgba(239,68,68,0.4)',
                                        color: '#ef4444', borderRadius: '6px',
                                        padding: '0.2rem 0.5rem', cursor: 'pointer',
                                        fontSize: '0.78rem',
                                      }}
                                      title="Revogar chave"
                                    >
                                      {revogando[k.id]
                                        ? <span className="spinner-border spinner-border-sm" style={{ width: '0.7rem', height: '0.7rem' }} />
                                        : <i className="bi bi-x-circle"></i>
                                      }
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════
                ABA: EXEMPLOS n8n / Make
            ════════════════════════════════════════════════════════════════ */}
            {abaSelecionada === 'exemplos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* n8n */}
                <div className="card-custom">
                  <div className="card-header">
                    <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                      ✦ Integração com n8n
                    </span>
                  </div>
                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <p style={{ color: 'var(--cor-texto-suave)', fontSize: '0.88rem', lineHeight: 1.7, margin: 0 }}>
                      No n8n, use o node <strong style={{ color: 'var(--cor-texto)' }}>HTTP Request</strong> com as configurações abaixo
                      para listar giras ou inscrever consulentes automaticamente.
                    </p>

                    <div style={{ fontSize: '0.8rem', color: 'var(--cor-acento)', fontWeight: 600, marginBottom: '-0.5rem' }}>
                      Listar giras abertas
                    </div>
                    <BlocoCodigo codigo={`# Configuração do node HTTP Request no n8n
Method: GET
URL: ${API_BASE}/v1/giras

Headers:
  Authorization: Bearer axf_SUA_CHAVE_AQUI
  Content-Type: application/json

# Filtrar apenas giras abertas no Expression:
# {{ $json.filter(g => g.status === 'aberta') }}`} />

                    <div style={{ fontSize: '0.8rem', color: 'var(--cor-acento)', fontWeight: 600, marginBottom: '-0.5rem', marginTop: '0.5rem' }}>
                      Inscrever consulente (ex: via bot WhatsApp)
                    </div>
                    <BlocoCodigo codigo={`# Configuração do node HTTP Request no n8n
Method: POST
URL: ${API_BASE}/v1/giras/{{ $json.slug_publico }}/inscrever

Headers:
  Authorization: Bearer axf_SUA_CHAVE_AQUI
  Content-Type: application/json

Body (JSON):
{
  "nome": "{{ $json.nome }}",
  "telefone": "{{ $json.telefone }}",
  "primeira_visita": false,
  "observacoes": "Inscrição via WhatsApp Bot"
}`} />
                  </div>
                </div>

                {/* Make (Integromat) */}
                <div className="card-custom">
                  <div className="card-header">
                    <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                      ✦ Integração com Make (Integromat)
                    </span>
                  </div>
                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <p style={{ color: 'var(--cor-texto-suave)', fontSize: '0.88rem', lineHeight: 1.7, margin: 0 }}>
                      No Make, use o módulo <strong style={{ color: 'var(--cor-texto)' }}>HTTP → Make a request</strong>.
                    </p>
                    <BlocoCodigo codigo={`# Módulo: HTTP → Make a request

URL: ${API_BASE}/v1/giras
Method: GET

Headers:
  Name: Authorization
  Value: Bearer axf_SUA_CHAVE_AQUI

# Para inscrição:
URL: ${API_BASE}/v1/giras/SLUG_DA_GIRA/inscrever
Method: POST
Body type: Raw
Content type: application/json
Request content:
{
  "nome": "{{1.nome}}",
  "telefone": "{{1.telefone}}"
}`} />
                  </div>
                </div>

                {/* Python/Requests */}
                <div className="card-custom">
                  <div className="card-header">
                    <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>
                      ✦ Exemplo Python
                    </span>
                  </div>
                  <div style={{ padding: '1.25rem' }}>
                    <BlocoCodigo codigo={`import requests

API_BASE = "${API_BASE}"
API_KEY  = "axf_SUA_CHAVE_AQUI"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

# Listar giras
giras = requests.get(f"{API_BASE}/v1/giras", headers=headers).json()
giras_abertas = [g for g in giras if g["status"] == "aberta"]

# Inscrever consulente
slug = giras_abertas[0]["slug_publico"]
res  = requests.post(
    f"{API_BASE}/v1/giras/{slug}/inscrever",
    headers=headers,
    json={
        "nome":     "Maria Silva",
        "telefone": "11999999999",
    }
)
print(res.json())  # {"posicao": 5, "status": "confirmado", ...}`} />
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>
      </div>
      <BottomNav />

      {/* ── Modal: Criar nova chave ── */}
      {showCriar && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem',
        }}>
          <div className="card-custom" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-header d-flex justify-content-between align-items-center">
              <span style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)' }}>✦ Nova API Key</span>
              <button
                onClick={() => { setShowCriar(false); setErroCriar(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--cor-texto-suave)', cursor: 'pointer', fontSize: '1.2rem' }}
              >×</button>
            </div>
            <div style={{ padding: '1.25rem' }}>
              {erroCriar && (
                <div className="alert-custom alert-danger-custom mb-3">{erroCriar}</div>
              )}
              <form onSubmit={handleCriar}>
                <div className="mb-3">
                  <label className="form-label-custom">Nome da chave *</label>
                  <input
                    className="form-control-custom"
                    value={formNome}
                    onChange={e => setFormNome(e.target.value)}
                    placeholder="Ex: Bot WhatsApp, Integração n8n..."
                    required minLength={3} maxLength={100}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label-custom">
                    Descrição
                    <span style={{ color: 'var(--cor-texto-suave)', fontWeight: 400, marginLeft: '0.4rem', fontSize: '0.78rem' }}>
                      (opcional)
                    </span>
                  </label>
                  <input
                    className="form-control-custom"
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    placeholder="Para que essa chave será usada?"
                    maxLength={300}
                  />
                </div>

                {/* Seleção de scopes */}
                <div className="mb-4">
                  <label className="form-label-custom">Permissões (scopes) *</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem' }}>
                    {Object.entries(SCOPES_META).map(([scope, meta]) => {
                      const selecionado = scopesSel.includes(scope);
                      return (
                        <label
                          key={scope}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.5rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
                            background: selecionado ? `${meta.cor}10` : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${selecionado ? meta.cor + '40' : 'var(--cor-borda)'}`,
                            transition: 'all 0.15s',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selecionado}
                            onChange={() => toggleScope(scope)}
                            style={{ display: 'none' }}
                          />
                          <div style={{
                            width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                            background: selecionado ? meta.cor : 'transparent',
                            border: `2px solid ${selecionado ? meta.cor : 'rgba(255,255,255,0.2)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {selecionado && <i className="bi bi-check" style={{ fontSize: '0.65rem', color: '#fff' }}></i>}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: selecionado ? meta.cor : 'var(--cor-texto)' }}>
                              {meta.label}
                            </div>
                            <code style={{ fontSize: '0.7rem', color: 'var(--cor-texto-suave)' }}>{scope}</code>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn-outline-gold"
                    onClick={() => { setShowCriar(false); setErroCriar(''); }}
                    style={{ flex: 1 }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-gold"
                    disabled={criando || !formNome || scopesSel.length === 0}
                    style={{ flex: 1 }}
                  >
                    {criando
                      ? <><span className="spinner-border spinner-border-sm me-1"></span>Criando...</>
                      : <><i className="bi bi-key me-1"></i>Criar Chave</>
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}