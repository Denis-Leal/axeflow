/**
 * pages/giras.js — AxeFlow
 *
 * ALTERAÇÃO: botão "Entrar" agora navega para /gira/[id]/consumo
 * em vez de /inventario. Isso leva direto à tela operacional
 * de consumo da gira específica, que é o fluxo correto.
 *
 * O inventário (/inventario) é o dashboard de leitura — não a
 * tela de operação da gira.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import ConfirmModal from '../components/ConfirmModal';
import { listGiras, deleteGira, getMe } from '../services/api';
import { handleApiError } from '../services/errorHandler';
import { useGiraAtual } from '../contexts/GiraContext';

export default function Giras() {
  const router = useRouter();
  const [giras, setGiras]       = useState([]);
  const [userRole, setUserRole] = useState('');
  const [loading, setLoading]   = useState(true);
  const [erro, setErro]         = useState('');
  const [modal, setModal]       = useState({
    aberto: false, titulo: '', mensagem: '', onConfirmar: null,
  });

  // Contexto de gira ativa — usado pelo botão "Entrar"
  const { setGiraAtual } = useGiraAtual();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    Promise.all([listGiras(), getMe()])
      .then(([girasRes, meRes]) => {
        setGiras(girasRes.data);
        setUserRole(meRes.data.role);
      })
      .catch(err => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          router.push('/login');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const podeGerenciar = ['admin', 'operador'].includes(userRole);
  const podeExcluir   = userRole === 'admin';

  const fecharModal = () => setModal(m => ({ ...m, aberto: false, onConfirmar: null }));

  const handleDelete = (id) => {
    setModal({
      aberto: true,
      titulo: 'Excluir gira',
      mensagem: 'Confirmar exclusão desta gira?\n\nTodos os dados relacionados serão removidos permanentemente.',
      tipoBotao: 'perigo',
      labelConfirmar: 'Excluir',
      onConfirmar: async () => {
        fecharModal();
        try {
          await deleteGira(id);
          setGiras(prev => prev.filter(g => g.id !== id));
        } catch (err) {
          setErro(handleApiError(err, 'Excluir Gira'));
          setTimeout(() => setErro(''), 5000);
        }
      },
    });
  };

  /**
   * Define a gira como ativa no contexto e navega para a tela de consumo.
   *
   * ALTERAÇÃO: destino mudado de /inventario para /gira/[id]/consumo.
   * O /inventario é o dashboard de leitura do estoque — não o lugar
   * certo para registrar consumos de uma gira específica.
   * Giras concluídas são bloqueadas pois o estoque já foi processado.
   */
  const handleEntrar = (g) => {
    if (g.status === 'concluida') return;

    // Persiste dados da gira no contexto para uso nas sub-telas
    setGiraAtual({
      id:     g.id,
      titulo: g.titulo,
      data:   g.data,
      status: g.status,
      acesso: g.acesso,
    });

    // Navega direto para a tela operacional da gira
    router.push(`/giras/${g.id}/consumo`);
  };

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <div className="spinner-gold"></div>
    </div>
  );

  return (
    <>
      <Head><title>Giras | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>Giras</h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>{giras.length} giras cadastradas</small>
            </div>
            {podeGerenciar && (
              <Link href="/giras/nova" className="btn-gold">
                <i className="bi bi-plus-lg me-1"></i> Nova Gira
              </Link>
            )}
          </div>

          <div className="page-content">
            {erro && (
              <div style={{
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: '10px', padding: '0.85rem 1.2rem', marginBottom: '1rem',
                color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <i className="bi bi-exclamation-triangle-fill"></i> {erro}
              </div>
            )}

            <div className="card-custom">
              <div style={{ overflowX: 'auto' }}>
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>Título</th>
                      <th>Tipo</th>
                      <th>Data</th>
                      <th>Horário</th>
                      <th>Vagas</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {giras.map(g => {
                      const concluida = g.status === 'concluida';
                      return (
                        <tr key={g.id}>
                          <td><strong>{g.titulo}</strong></td>
                          <td style={{ color: 'var(--cor-texto-suave)' }}>{g.tipo || '—'}</td>
                          <td>{new Date(g.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                          <td>{g.horario}</td>
                          <td>
                            {g.acesso === 'fechada' ? (
                              <span style={{ color: g.total_inscritos >= g.limite_membros ? '#ef4444' : 'var(--cor-sucesso)' }}>
                                {g.total_inscritos}/{g.limite_membros}
                              </span>
                            ) : (
                              <span style={{ color: g.total_inscritos >= g.limite_consulentes ? '#ef4444' : 'var(--cor-sucesso)' }}>
                                {g.total_inscritos}/{g.limite_consulentes}
                              </span>
                            )}
                          </td>
                          <td><span className={`badge-status badge-${g.status}`}>{g.status}</span></td>
                          <td>
                            <div className="d-flex gap-1">
                              {/*
                                Botão "Entrar" — define gira ativa e vai para /gira/[id]/consumo.
                                ALTERAÇÃO: destino mudado para a tela operacional de consumo.
                                Desabilitado para giras concluídas (estoque já processado).
                              */}
                              <button
                                onClick={() => handleEntrar(g)}
                                disabled={concluida}
                                title={concluida
                                  ? 'Gira concluída — estoque já processado'
                                  : 'Registrar consumo desta gira'
                                }
                                style={{
                                  background: concluida ? 'rgba(148,163,184,0.08)' : 'rgba(212,175,55,0.12)',
                                  border: `1px solid ${concluida ? 'rgba(148,163,184,0.2)' : 'rgba(212,175,55,0.35)'}`,
                                  color: concluida ? '#94a3b8' : 'var(--cor-acento)',
                                  borderRadius: '8px', padding: '0.2rem 0.6rem',
                                  cursor: concluida ? 'not-allowed' : 'pointer',
                                  fontSize: '0.8rem', opacity: concluida ? 0.5 : 1,
                                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                }}
                              >
                                <i className="bi bi-box-arrow-in-right"></i>
                                Consumo
                              </button>

                              <Link href={`/giras/${g.id}`} className="btn-outline-gold"
                                title="Ver inscrições" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>
                                <i className="bi bi-list-ul"></i>
                              </Link>
                              {podeGerenciar && (
                                <Link href={`/giras/editar/${g.id}`} className="btn-outline-gold"
                                  title="Editar gira" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>
                                  <i className="bi bi-pencil"></i>
                                </Link>
                              )}
                              {g.slug_publico && (
                                <a href={`/public/${g.slug_publico}`} target="_blank"
                                  className="btn-outline-gold" title="Página pública"
                                  style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>
                                  <i className="bi bi-share"></i>
                                </a>
                              )}
                              {podeExcluir && (
                                <button onClick={() => handleDelete(g.id)} title="Excluir"
                                  style={{
                                    background: 'transparent',
                                    border: '1px solid rgba(239,68,68,0.4)',
                                    color: '#ef4444', borderRadius: '8px',
                                    padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem',
                                  }}>
                                  <i className="bi bi-trash"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {giras.length === 0 && (
                      <tr><td colSpan="7">
                        <div className="empty-state">
                          <i className="bi bi-stars d-block"></i>
                          <p>Nenhuma gira cadastrada</p>
                          <Link href="/giras/nova" className="btn-gold">Criar primeira gira</Link>
                        </div>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />

      <ConfirmModal
        aberto={modal.aberto}
        titulo={modal.titulo}
        mensagem={modal.mensagem}
        tipoBotao={modal.tipoBotao || 'perigo'}
        labelConfirmar={modal.labelConfirmar || 'Confirmar'}
        onConfirmar={modal.onConfirmar}
        onCancelar={fecharModal}
      />
    </>
  );
}