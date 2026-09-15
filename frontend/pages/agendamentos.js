import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';

import BottomNav from '../components/BottomNav';
import ConfirmModal from '../components/ConfirmModal';
import Sidebar from '../components/Sidebar';
import { useAgendamentos } from '../hooks/useAgendamentos';
import { useAtendimentos } from '../hooks/useAtendimentos';
import { useIsMobile } from '../hooks/useMediaQuery';
import { createConsulente, getMe, listConsulentes } from '../services/api';
import { handleApiError } from '../services/errorHandler';
import { formatPhone } from '../utils/format';

const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function isoDate(dt) {
  return dt ? String(dt).slice(0, 10) : '';
}

function isoTime(dt) {
  return dt ? String(dt).slice(11, 16) : '';
}

function formatDateTime(dt) {
  if (!dt) return '-';
  const raw = String(dt);
  const d = raw.slice(0, 10).split('-').reverse().join('/');
  const h = raw.slice(11, 16);
  return `${d} ${h}`;
}

function statusBadge(status) {
  const map = {
    agendado: ['badge-confirmado', 'Agendado'],
    concluido: ['badge-concluida', 'Concluído'],
    cancelado: ['badge-cancelado', 'Cancelado'],
  };
  const [classe, label] = map[status] || ['badge-cancelado', status];
  return <span className={`badge-status ${classe}`}>{label}</span>;
}

function calcularPreview(tipo, form) {
  if (!tipo) return null;
  if (tipo.tipo_cobranca === 'servico') return { duracao: null, valor: Number(tipo.valor || 0) };
  if (!form.hora_inicio || !form.hora_fim) return null;

  const inicio = new Date(`${form.data || '2000-01-01'}T${form.hora_inicio}:00`);
  const fim = new Date(`${form.data || '2000-01-01'}T${form.hora_fim}:00`);
  const horas = (fim - inicio) / 3600000;
  if (horas <= 0) return null;
  return { duracao: horas, valor: Number(tipo.valor || 0) * horas };
}

function AgendamentoModal({ agendamento, tipos, consulentes, onClose, onSave, onConsulenteCriado }) {
  const [form, setForm] = useState({
    consulente_id: agendamento?.consulente_id || '',
    atendimento_tipo_id: agendamento?.atendimento_tipo_id || '',
    data: isoDate(agendamento?.inicio) || '',
    hora_inicio: isoTime(agendamento?.inicio) || '',
    hora_fim: isoTime(agendamento?.fim) || '',
    observacoes: agendamento?.observacoes || '',
  });
  const [novoConsulente, setNovoConsulente] = useState({ aberto: false, nome: '', telefone: '' });
  const [salvando, setSalvando] = useState(false);

  const tiposDisponiveis = useMemo(() => {
    if (!agendamento?.atendimento_tipo) return tipos;
    if (tipos.some(t => t.id === agendamento.atendimento_tipo.id)) return tipos;
    return [...tipos, agendamento.atendimento_tipo];
  }, [agendamento, tipos]);
  const tipoSelecionado = tiposDisponiveis.find(t => t.id === form.atendimento_tipo_id);
  const preview = calcularPreview(tipoSelecionado, form);

  useEffect(() => {
    if (tipoSelecionado?.tipo_cobranca === 'servico') {
      setForm(v => ({ ...v, hora_fim: '' }));
    }
  }, [tipoSelecionado?.tipo_cobranca]);

  const criarNovoConsulente = async () => {
    if (!novoConsulente.nome.trim()) return;
    try {
      const res = await createConsulente({
        nome: novoConsulente.nome.trim(),
        telefone: novoConsulente.telefone.trim() || null,
        source: 'cadastro_manual',
      });
      await onConsulenteCriado();
      setForm(v => ({ ...v, consulente_id: res.data.id }));
      setNovoConsulente({ aberto: false, nome: '', telefone: '' });
      toast.success('Consulente cadastrado');
    } catch (err) {
      toast.error(handleApiError(err, 'Cadastrar consulente'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.consulente_id || !form.atendimento_tipo_id || !form.data || !form.hora_inicio) return;
    if (tipoSelecionado?.tipo_cobranca === 'hora' && !form.hora_fim) return;

    setSalvando(true);
    try {
      await onSave({
        consulente_id: form.consulente_id,
        atendimento_tipo_id: form.atendimento_tipo_id,
        data: form.data,
        hora_inicio: form.hora_inicio,
        hora_fim: tipoSelecionado?.tipo_cobranca === 'hora' ? form.hora_fim : null,
        observacoes: form.observacoes.trim() || null,
      });
      toast.success(agendamento ? 'Agendamento atualizado' : 'Agendamento criado');
      onClose();
    } catch (err) {
      toast.error(handleApiError(err, 'Salvar agendamento'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }}>
      <form onSubmit={handleSubmit} style={{ background: 'var(--cor-card)', border: '1px solid var(--cor-borda)', borderRadius: 12, padding: '1.5rem', width: '100%', maxWidth: 640 }}>
        <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', marginBottom: '1rem' }}>
          {agendamento ? 'Editar Agendamento' : 'Novo Agendamento'}
        </h5>

        <div style={{ display: 'grid', gap: '0.85rem' }}>
          <div>
            <label className="form-label-custom">Consulente</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem' }}>
              <select className="form-control-custom" value={form.consulente_id} onChange={e => setForm(v => ({ ...v, consulente_id: e.target.value }))} required>
                <option value="">Selecione</option>
                {consulentes.map(c => <option key={c.id} value={c.id}>{c.nome} {c.telefone ? `- ${formatPhone(c.telefone)}` : ''}</option>)}
              </select>
              <button type="button" className="btn-outline-gold" onClick={() => setNovoConsulente(v => ({ ...v, aberto: !v.aberto }))}>
                <i className="bi bi-person-plus" />
              </button>
            </div>
          </div>

          {novoConsulente.aberto && (
            <div style={{ border: '1px solid var(--cor-borda)', borderRadius: 8, padding: '0.85rem', display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
                <input className="form-control-custom" placeholder="Nome do consulente" value={novoConsulente.nome} onChange={e => setNovoConsulente(v => ({ ...v, nome: e.target.value }))} />
                <input className="form-control-custom" placeholder="Telefone" value={novoConsulente.telefone} onChange={e => setNovoConsulente(v => ({ ...v, telefone: e.target.value }))} />
                <button type="button" className="btn-gold" onClick={criarNovoConsulente}>Adicionar</button>
              </div>
            </div>
          )}

          <div>
            <label className="form-label-custom">Tipo de atendimento</label>
            <select className="form-control-custom" value={form.atendimento_tipo_id} onChange={e => setForm(v => ({ ...v, atendimento_tipo_id: e.target.value }))} required>
              <option value="">Selecione</option>
              {tiposDisponiveis.map(t => <option key={t.id} value={t.id}>{t.nome} - {money(t.valor)} {t.tipo_cobranca === 'hora' ? '/ hora' : ''}{t.ativo === false ? ' (inativo)' : ''}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label className="form-label-custom">Data</label>
              <input className="form-control-custom" type="date" value={form.data} onChange={e => setForm(v => ({ ...v, data: e.target.value }))} required />
            </div>
            <div>
              <label className="form-label-custom">{tipoSelecionado?.tipo_cobranca === 'hora' ? 'Hora inicial' : 'Hora'}</label>
              <input className="form-control-custom" type="time" value={form.hora_inicio} onChange={e => setForm(v => ({ ...v, hora_inicio: e.target.value }))} required />
            </div>
            {tipoSelecionado?.tipo_cobranca === 'hora' && (
              <div>
                <label className="form-label-custom">Hora final</label>
                <input className="form-control-custom" type="time" value={form.hora_fim} onChange={e => setForm(v => ({ ...v, hora_fim: e.target.value }))} required />
              </div>
            )}
          </div>

          {tipoSelecionado && (
            <div style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 8, padding: '0.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', color: 'var(--cor-texto)' }}>
              <span>{tipoSelecionado.tipo_cobranca === 'hora' ? 'Por hora' : 'Por serviço'}</span>
              {preview?.duracao && <span>Duração: {preview.duracao.toLocaleString('pt-BR')}h</span>}
              <strong style={{ color: 'var(--cor-acento)' }}>Valor: {preview ? money(preview.valor) : money(tipoSelecionado.valor)}</strong>
            </div>
          )}

          <div>
            <label className="form-label-custom">Observações</label>
            <textarea className="form-control-custom" rows={3} value={form.observacoes} onChange={e => setForm(v => ({ ...v, observacoes: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button type="button" className="btn-outline-gold" onClick={onClose}>Cancelar</button>
          <button className="btn-gold" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  );
}

function AgendamentoCard({ item, podeGerenciar, onEdit, onCancelar, onConcluir }) {
  const tipo = item.atendimento_tipo;
  const consulente = item.consulente;
  return (
    <div style={{ background: 'var(--cor-card)', border: '1px solid var(--cor-borda)', borderRadius: 10, padding: '0.85rem', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div>
          <strong>{consulente?.nome || 'Consulente'}</strong>
          <div style={{ color: 'var(--cor-texto-suave)', fontSize: '0.8rem' }}>{tipo?.nome || 'Atendimento'}</div>
        </div>
        {statusBadge(item.status)}
      </div>
      <div style={{ marginTop: '0.75rem', color: 'var(--cor-texto-suave)', display: 'grid', gap: '0.25rem', fontSize: '0.85rem' }}>
        <span><i className="bi bi-clock me-1" />{formatDateTime(item.inicio)}{tipo?.tipo_cobranca === 'hora' ? ` até ${isoTime(item.fim)}` : ''}</span>
        <span><i className="bi bi-cash-coin me-1" />{money(item.valor)}</span>
        {consulente?.telefone && <span><i className="bi bi-telephone me-1" />{formatPhone(consulente.telefone)}</span>}
      </div>
      {podeGerenciar && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          <button className="btn-outline-gold" onClick={() => onEdit(item)}><i className="bi bi-pencil me-1" />Editar</button>
          {item.status === 'agendado' && <button className="btn-outline-gold" onClick={() => onConcluir(item)}><i className="bi bi-check2 me-1" />Concluir</button>}
          {item.status === 'agendado' && <button className="btn-outline-gold" onClick={() => onCancelar(item)} style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.45)' }}><i className="bi bi-x-lg me-1" />Cancelar</button>}
        </div>
      )}
    </div>
  );
}

export default function AgendamentosPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [status, setStatus] = useState('');
  const { agendamentos, loading, criar, atualizar, cancelar, concluir } = useAgendamentos(status || null);
  const { atendimentos: tiposAtivos } = useAtendimentos({ ativos: true });
  const [consulentes, setConsulentes] = useState([]);
  const [user, setUser] = useState(null);
  const [busca, setBusca] = useState('');
  const [modalForm, setModalForm] = useState(null);
  const [modalConfirm, setModalConfirm] = useState({ aberto: false });


  // Abre o modal de novo agendamento quando
  // a página é acessada através de /agendamentos?action=novo
  useEffect(() => {
    if (!router.isReady) return;

    if (router.query.action === 'novo') {
      setModalForm({});
    }
  }, [router.isReady, router.query.action]);
  
  const carregarConsulentes = async () => {
    const res = await listConsulentes();
    setConsulentes(res.data || []);
  };

  useEffect(() => {
    if (!localStorage.getItem('token')) router.push('/login');
    getMe().then(r => setUser(r.data)).catch(() => {});
    carregarConsulentes().catch(() => {});
  }, [router]);

  const podeGerenciar = ['admin', 'operador'].includes(user?.role);

  const filtrados = useMemo(() => (
    agendamentos.filter(item => {
      const alvo = `${item.consulente?.nome || ''} ${item.atendimento_tipo?.nome || ''}`.toLowerCase();
      return alvo.includes(busca.toLowerCase());
    })
  ), [agendamentos, busca]);

  const handleSave = (data) => modalForm?.id ? atualizar(modalForm.id, data) : criar(data);

  const confirmarStatus = (item, acao) => {
    const concluindo = acao === 'concluir';
    setModalConfirm({
      aberto: true,
      titulo: concluindo ? 'Concluir agendamento' : 'Cancelar agendamento',
      mensagem: `${concluindo ? 'Concluir' : 'Cancelar'} o agendamento de ${item.consulente?.nome || 'consulente'} em ${formatDateTime(item.inicio)}?`,
      labelConfirmar: concluindo ? 'Concluir' : 'Cancelar',
      tipoBotao: concluindo ? 'sucesso' : 'perigo',
      onConfirmar: async () => {
        setModalConfirm({ aberto: false });
        try {
          await (concluindo ? concluir(item.id) : cancelar(item.id));
          toast.success(concluindo ? 'Agendamento concluído' : 'Agendamento cancelado');
        } catch (err) {
          toast.error(handleApiError(err, 'Alterar agendamento'));
        }
      },
    });
  };

  if (loading) return <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}><div className="spinner-gold" /></div>;

  return (
    <>
      <Head><title>Agendamentos | AxeFlow</title></Head>
      {modalForm !== null && (
        <AgendamentoModal
          agendamento={modalForm?.id ? modalForm : null}
          tipos={tiposAtivos}
          consulentes={consulentes}
          onClose={() => setModalForm(null)}
          onSave={handleSave}
          onConsulenteCriado={carregarConsulentes}
        />
      )}

      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>Agendamentos</h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>{agendamentos.length} registro(s)</small>
            </div>
            {podeGerenciar && <button className="btn-gold" onClick={() => setModalForm({})}><i className="bi bi-plus-lg me-1" />Novo Agendamento</button>}
          </div>

          <div className="page-content">
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <input className="form-control-custom" placeholder="Buscar por consulente ou atendimento..." value={busca} onChange={e => setBusca(e.target.value)} style={{ maxWidth: 360 }} />
              <select className="form-control-custom" value={status} onChange={e => setStatus(e.target.value)} style={{ maxWidth: 180 }}>
                <option value="">Todos</option>
                <option value="agendado">Agendados</option>
                <option value="concluido">Concluídos</option>
                <option value="cancelado">Cancelados</option>
              </select>
            </div>

            {isMobile ? (
              filtrados.length ? filtrados.map(item => (
                <AgendamentoCard key={item.id} item={item} podeGerenciar={podeGerenciar} onEdit={setModalForm} onCancelar={(i) => confirmarStatus(i, 'cancelar')} onConcluir={(i) => confirmarStatus(i, 'concluir')} />
              )) : <div className="empty-state"><i className="bi bi-calendar-check d-block" /><p>Nenhum agendamento encontrado</p></div>
            ) : (
              <div className="card-custom">
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>Consulente</th>
                      <th>Atendimento</th>
                      <th>Data e horário</th>
                      <th>Valor</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map(item => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.consulente?.nome || '-'}</strong>
                          <div style={{ color: 'var(--cor-texto-suave)', fontSize: '0.78rem' }}>{formatPhone(item.consulente?.telefone)}</div>
                        </td>
                        <td>
                          {item.atendimento_tipo?.nome || '-'}
                          <div style={{ color: 'var(--cor-texto-suave)', fontSize: '0.78rem' }}>{item.atendimento_tipo?.tipo_cobranca === 'hora' ? 'Por hora' : 'Por serviço'}</div>
                        </td>
                        <td>
                          {formatDateTime(item.inicio)}
                          {item.atendimento_tipo?.tipo_cobranca === 'hora' && <div style={{ color: 'var(--cor-texto-suave)', fontSize: '0.78rem' }}>até {isoTime(item.fim)}</div>}
                        </td>
                        <td>{money(item.valor)}</td>
                        <td>{statusBadge(item.status)}</td>
                        <td>
                          {podeGerenciar && (
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                              <button className="btn-outline-gold" onClick={() => setModalForm(item)}><i className="bi bi-pencil" /></button>
                              {item.status === 'agendado' && <button className="btn-outline-gold" onClick={() => confirmarStatus(item, 'concluir')}><i className="bi bi-check2" /></button>}
                              {item.status === 'agendado' && <button className="btn-outline-gold" onClick={() => confirmarStatus(item, 'cancelar')} style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.45)' }}><i className="bi bi-x-lg" /></button>}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!filtrados.length && <tr><td colSpan="6"><div className="empty-state"><i className="bi bi-calendar-check d-block" /><p>Nenhum agendamento encontrado</p></div></td></tr>}
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
        tipoBotao={modalConfirm.tipoBotao}
        onConfirmar={modalConfirm.onConfirmar}
        onCancelar={() => setModalConfirm({ aberto: false })}
      />
    </>
  );
}
