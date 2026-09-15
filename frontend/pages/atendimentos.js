import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';

import BottomNav from '../components/BottomNav';
import ConfirmModal from '../components/ConfirmModal';
import Sidebar from '../components/Sidebar';
import { useAtendimentos } from '../hooks/useAtendimentos';
import { useIsMobile } from '../hooks/useMediaQuery';
import { getMe } from '../services/api';
import { handleApiError } from '../services/errorHandler';

const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const cobrancaLabel = (tipo) => tipo === 'hora' ? 'Por hora' : 'Por serviço';

function StatusBadge({ ativo }) {
  return (
    <span className={`badge-status ${ativo ? 'badge-confirmado' : 'badge-cancelado'}`}>
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  );
}

function AtendimentoFormModal({ atendimento, onClose, onSave }) {
  const [form, setForm] = useState({
    nome: atendimento?.nome || '',
    descricao: atendimento?.descricao || '',
    valor: atendimento?.valor || '',
    tipo_cobranca: atendimento?.tipo_cobranca || 'servico',
    ativo: atendimento?.ativo ?? true,
  });
  const [salvando, setSalvando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome.trim() || Number(form.valor) <= 0) return;

    setSalvando(true);
    try {
      await onSave({
        ...form,
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        valor: form.valor,
      });
      toast.success(atendimento?.id ? 'Atendimento atualizado' : 'Atendimento cadastrado');
      onClose();
    } catch (err) {
      toast.error(handleApiError(err, 'Salvar atendimento'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <form onSubmit={handleSubmit} style={{ background: 'var(--cor-card)', border: '1px solid var(--cor-borda)', borderRadius: 12, padding: '1.5rem', width: '100%', maxWidth: 520 }}>
        <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', marginBottom: '1rem' }}>
          {atendimento?.id ? 'Editar Atendimento' : 'Novo Atendimento'}
        </h5>

        <div style={{ display: 'grid', gap: '0.85rem' }}>
          <div>
            <label className="form-label-custom">Nome</label>
            <input className="form-control-custom" value={form.nome} onChange={e => setForm(v => ({ ...v, nome: e.target.value }))} required />
          </div>
          <div>
            <label className="form-label-custom">Descrição</label>
            <textarea className="form-control-custom" rows={3} value={form.descricao} onChange={e => setForm(v => ({ ...v, descricao: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label className="form-label-custom">Valor</label>
              <input className="form-control-custom" type="number" min="0.01" step="0.01" value={form.valor} onChange={e => setForm(v => ({ ...v, valor: e.target.value }))} required />
            </div>
            <div>
              <label className="form-label-custom">Cobrança</label>
              <select className="form-control-custom" value={form.tipo_cobranca} onChange={e => setForm(v => ({ ...v, tipo_cobranca: e.target.value }))}>
                <option value="servico">Por serviço</option>
                <option value="hora">Por hora</option>
              </select>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--cor-texto-suave)', fontSize: '0.9rem' }}>
            <input type="checkbox" checked={form.ativo} onChange={e => setForm(v => ({ ...v, ativo: e.target.checked }))} />
            Atendimento ativo
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button type="button" className="btn-outline-gold" onClick={onClose}>Cancelar</button>
          <button className="btn-gold" disabled={salvando || !form.nome.trim() || Number(form.valor) <= 0}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function AtendimentoCard({ item, podeGerenciar, onEdit, onDelete }) {
  return (
    <div style={{ background: 'var(--cor-card)', border: '1px solid var(--cor-borda)', borderRadius: 10, padding: '0.85rem', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
        <div>
          <strong>{item.nome}</strong>
          <div style={{ color: 'var(--cor-texto-suave)', fontSize: '0.8rem', marginTop: 2 }}>{item.descricao || 'Sem descrição'}</div>
        </div>
        <StatusBadge ativo={item.ativo} />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem', color: 'var(--cor-texto-suave)', fontSize: '0.85rem' }}>
        <span>{money(item.valor)}</span>
        <span>{cobrancaLabel(item.tipo_cobranca)}</span>
        <span>{item.total_agendamentos || 0} agendamento(s)</span>
      </div>
      {podeGerenciar && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button className="btn-outline-gold" onClick={() => onEdit(item)}><i className="bi bi-pencil me-1" />Editar</button>
          <button className="btn-outline-gold" onClick={() => onDelete(item)} style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.45)' }}><i className="bi bi-trash me-1" />Excluir</button>
        </div>
      )}
    </div>
  );
}

export default function AtendimentosPage() {
  const router = useRouter();
  const isMobile = useIsMobile();

  const { atendimentos, loading, criar, atualizar, remover } = useAtendimentos();

  const [user, setUser] = useState(null);
  const [carregandoUsuario, setCarregandoUsuario] = useState(true);
  const [busca, setBusca] = useState('');
  const [modalForm, setModalForm] = useState(null);
  const [modalConfirm, setModalConfirm] = useState({ aberto: false });

  const podeGerenciarAtendimentos = ['admin', 'operador'].includes(user?.role);

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      router.replace('/login');
      return;
    }

    getMe()
      .then(r => {
        setUser(r.data);
      })
      .catch(() => {
        router.replace('/login');
      })
      .finally(() => {
        setCarregandoUsuario(false);
      });
  }, [router]);

  useEffect(() => {
    if (!carregandoUsuario && user && !podeGerenciarAtendimentos) {
      toast.error(handleApiError({ message: 'Você não tem permissão para acessar esta página' }));
      router.replace('/');
    }
  }, [carregandoUsuario, user, podeGerenciarAtendimentos, router]);

  const filtrados = useMemo(() => (
    atendimentos.filter(item => item.nome?.toLowerCase().includes(busca.toLowerCase()))
  ), [atendimentos, busca]);

  if (carregandoUsuario || !user) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="spinner-gold" />
      </div>
    );
  }

  if (!podeGerenciarAtendimentos) {
    return null;
  }

  const podeGerenciar = ['admin', 'operador'].includes(user?.role);

  const handleSave = (data) => modalForm?.id ? atualizar(modalForm.id, data) : criar(data);

  const pedirDelete = (item) => {
    setModalConfirm({
      aberto: true,
      titulo: item.total_agendamentos > 0 ? 'Desativar atendimento' : 'Excluir atendimento',
      mensagem: item.total_agendamentos > 0
        ? `O atendimento "${item.nome}" possui histórico e será desativado para novos agendamentos.`
        : `Excluir o atendimento "${item.nome}"?`,
      labelConfirmar: item.total_agendamentos > 0 ? 'Desativar' : 'Excluir',
      onConfirmar: async () => {
        setModalConfirm({ aberto: false });
        try {
          const res = await remover(item.id);
          toast.success(res?.desativado ? 'Atendimento desativado' : 'Atendimento excluído');
        } catch (err) {
          toast.error(handleApiError(err, 'Remover atendimento'));
        }
      },
    });
  };

  if (loading) return <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}><div className="spinner-gold" /></div>;

  return (
    <>
      <Head><title>Atendimentos | AxeFlow</title></Head>
      {modalForm !== null && <AtendimentoFormModal atendimento={modalForm} onClose={() => setModalForm(null)} onSave={handleSave} />}

      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>Atendimentos</h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>{atendimentos.length} tipo(s) cadastrado(s)</small>
            </div>
            {podeGerenciar && <button className="btn-gold" onClick={() => setModalForm({})}><i className="bi bi-plus-lg me-1" />Novo Atendimento</button>}
          </div>

          <div className="page-content">
            <input className="form-control-custom" placeholder="Buscar atendimento..." value={busca} onChange={e => setBusca(e.target.value)} style={{ maxWidth: 340, marginBottom: '1rem' }} />

            {isMobile ? (
              filtrados.length ? filtrados.map(item => (
                <AtendimentoCard key={item.id} item={item} podeGerenciar={podeGerenciar} onEdit={setModalForm} onDelete={pedirDelete} />
              )) : <div className="empty-state"><i className="bi bi-calendar2-heart d-block" /><p>Nenhum atendimento encontrado</p></div>
            ) : (
              <div className="card-custom">
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Valor</th>
                      <th>Cobrança</th>
                      <th>Status</th>
                      <th>Histórico</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map(item => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.nome}</strong>
                          <div style={{ color: 'var(--cor-texto-suave)', fontSize: '0.78rem' }}>{item.descricao || 'Sem descrição'}</div>
                        </td>
                        <td>{money(item.valor)}</td>
                        <td>{cobrancaLabel(item.tipo_cobranca)}</td>
                        <td><StatusBadge ativo={item.ativo} /></td>
                        <td>{item.total_agendamentos || 0}</td>
                        <td>
                          {podeGerenciar && (
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                              <button className="btn-outline-gold" onClick={() => setModalForm(item)}><i className="bi bi-pencil" /></button>
                              <button className="btn-outline-gold" onClick={() => pedirDelete(item)} style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.45)' }}><i className="bi bi-trash" /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!filtrados.length && <tr><td colSpan="6"><div className="empty-state"><i className="bi bi-calendar2-heart d-block" /><p>Nenhum atendimento cadastrado</p></div></td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
      <BottomNav />
      <ConfirmModal
        aberto={modalConfirm.aberto}
        titulo={modalConfirm.titulo}
        mensagem={modalConfirm.mensagem}
        labelConfirmar={modalConfirm.labelConfirmar}
        tipoBotao="perigo"
        onConfirmar={modalConfirm.onConfirmar}
        onCancelar={() => setModalConfirm({ aberto: false })}
      />
    </>
  );
}
