/**
 * pages/giras.js — AxeFlow (REFATORADO)
 *
 * MUDANÇAS:
 * - Hook useGiras() separa fetch de renderização
 * - buildGirasViewModel() transforma dados antes do JSX
 * - Mobile: cards (sem tabela, sem scroll horizontal)
 * - Desktop: tabela existente preservada
 * - useIsMobile() controla variante de renderização
 * - Dados crus da API NUNCA chegam ao JSX
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import ConfirmModal from '../components/ConfirmModal';
import GiraCard from '../components/gira/GiraCard';
import GiraTable from '../components/gira/GiraTable';
import { Spinner, StatCard } from '../components/ui';
import { useGiras } from '../hooks/useGiras';
import { useIsMobile } from '../hooks/useMediaQuery';
import { buildGirasViewModel } from '../viewModels/giraViewModel';
import { deleteGira } from '../services/api';
import { handleApiError } from '../services/errorHandler';
import { useGiraAtual } from '../contexts/GiraContext';

export default function Giras() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { giras: rawGiras, user, loading, reload } = useGiras();
  const { setGiraAtual } = useGiraAtual();

  const [erro, setErro]   = useState('');
  const [modal, setModal] = useState({ aberto: false, titulo: '', mensagem: '', onConfirmar: null });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  // ViewModel: transforma ANTES de passar ao JSX
  const giras = buildGirasViewModel(rawGiras);

  const podeGerenciar = ['admin', 'operador'].includes(user?.role);
  const podeExcluir   = user?.role === 'admin';

  const fecharModal = () => setModal(m => ({ ...m, aberto: false, onConfirmar: null }));

  const handleDelete = (id) => {
    setModal({
      aberto: true,
      titulo: 'Excluir gira',
      mensagem: 'Confirmar exclusão? Todos os dados relacionados serão removidos permanentemente.',
      tipoBotao: 'perigo',
      labelConfirmar: 'Excluir',
      onConfirmar: async () => {
        fecharModal();
        try {
          await deleteGira(id);
          reload();
        } catch (err) {
          setErro(handleApiError(err, 'Excluir Gira'));
          setTimeout(() => setErro(''), 5000);
        }
      },
    });
  };

  const handleEntrar = (g) => {
    if (g.concluida) return;
    setGiraAtual({ id: g.id, titulo: g.titulo, data: g.data, status: g.status, acesso: g.acesso });
    router.push(`/giras/${g.id}/consumo`);
  };

  if (loading) return <Spinner center />;

  return (
    <>
      <Head><title>Giras | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>Giras</h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>{giras.length} gira{giras.length !== 1 ? 's' : ''} cadastrada{giras.length !== 1 ? 's' : ''}</small>
            </div>
            {podeGerenciar && (
              <Link href="/giras/nova" className="btn-gold" style={{ fontSize: '0.85rem' }}>
                <i className="bi bi-plus-lg me-1" /> Nova Gira
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
                <i className="bi bi-exclamation-triangle-fill" /> {erro}
              </div>
            )}

            {/* Stats rápidos no mobile */}
            {isMobile && giras.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                <StatCard style={{ textAlign: 'center' }} size="md" sub="Total" value={giras.length} color="var(--cor-acento)" />
                <StatCard style={{ textAlign: 'center' }} size="md" sub="Abertas" value={giras.filter(g => g.aberta).length} color="#10b981" />
                <StatCard style={{ textAlign: 'center' }} size="md" sub="Concluídas" value={giras.filter(g => g.concluida).length} color="#a78bfa" />
              </div>
            )}

            {/* Mobile: cards — Desktop: tabela */}
            {isMobile ? (
              <div>
                {giras.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--cor-texto-suave)' }}>
                    <i className="bi bi-stars" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.75rem', opacity: 0.4 }} />
                    <p>Nenhuma gira cadastrada</p>
                    {podeGerenciar && (
                      <Link href="/giras/nova" className="btn-gold">Criar primeira gira</Link>
                    )}
                  </div>
                ) : (
                  giras.map(g => (
                    <GiraCard
                      key={g.id}
                      gira={g}
                      onEntrar={handleEntrar}
                      podeGerenciar={podeGerenciar}
                      podeExcluir={podeExcluir}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="card-custom">
                <GiraTable
                  giras={giras}
                  onEntrar={handleEntrar}
                  podeGerenciar={podeGerenciar}
                  podeExcluir={podeExcluir}
                  onDelete={handleDelete}
                />
              </div>
            )}
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