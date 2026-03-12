import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Sidebar from '../../components/Sidebar';
import BottomNav from '../../components/BottomNav';
import { createGira, getMe } from '../../services/api';
import { handleApiError } from '../../services/errorHandler';
import api from '../../services/api';

export default function NovaGira() {
  const router = useRouter();
  const [form, setForm] = useState({
    titulo: '', tipo: '', acesso: 'publica', data: '', horario: '',
    limite_consulentes: 20,
    limite_membros: 0,
    abertura_lista: '', fechamento_lista: '',
    responsavel_lista_id: '',
  });
  const [membros, setMembros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    getMe().then(res => {
      if (!['admin', 'operador'].includes(res.data.role)) {
        router.push('/giras?erro=sem-permissao'); // redireciona com mensagem
        return;
      }
      setAutorizado(true);
      api.get('/membros').then(r => {setMembros(r.data);setForm(prev => ({...prev,limite_membros: r.data.length}));}).catch(() => {});
    }).catch(() => { router.push('/login'); });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        limite_consulentes: parseInt(form.limite_consulentes),
        horario: form.horario + ':00',
        responsavel_lista_id: form.responsavel_lista_id || null,
        abertura_lista: form.acesso === 'fechada' ? null : form.abertura_lista || null,
        fechamento_lista: form.acesso === 'fechada' ? null : form.fechamento_lista || null,
      };
      const res = await createGira(payload);
      router.push(`/giras/${res.data.id}`);
    } catch (err) {
      setError(handleApiError(err, 'CriarGira'));
    } finally {
      setLoading(false);
    }
  };

  if (!autorizado) return null;

  return (
    <>
      <Head><title>Nova Gira | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>Nova Gira</h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>Cadastrar nova gira</small>
            </div>
            <Link href="/giras" style={{ color: 'var(--cor-texto-suave)', textDecoration: 'none' }}>
              ← Voltar
            </Link>
          </div>

          <div className="page-content">
            <div className="card-custom" style={{ maxWidth: '700px' }}>
              <div className="card-header">
                <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>✦ Detalhes da Gira</span>
              </div>
              <div className="p-4">
                {error && (
                  <div className="alert-custom alert-danger-custom mb-3">
                    <i className="bi bi-exclamation-circle me-2"></i>{error}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  {/* Tipo de acesso — primeira decisão */}
                  <div className="mb-4">
                    <label className="form-label-custom">Tipo de Gira *</label>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      {[
                        { value: 'publica', emoji: '🌐', label: 'Aberta ao público', desc: 'Consulentes externos podem se inscrever pelo link' },
                        { value: 'fechada', emoji: '🔒', label: 'Fechada (membros)', desc: 'Somente membros do terreiro participam' },
                      ].map(opt => (
                        <button key={opt.value} type="button"
                          onClick={() => setForm({ ...form, acesso: opt.value })}
                          style={{
                            flex: 1, padding: '0.85rem', borderRadius: '10px', cursor: 'pointer',
                            background: form.acesso === opt.value ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)',
                            border: `1.5px solid ${form.acesso === opt.value ? 'var(--cor-acento)' : 'var(--cor-borda)'}`,
                            textAlign: 'left', transition: 'all 0.15s',
                          }}>
                          <div style={{ fontSize: '1.1rem', marginBottom: '3px' }}>{opt.emoji}</div>
                          <div style={{ color: form.acesso === opt.value ? 'var(--cor-acento)' : 'var(--cor-texto)', fontWeight: 600, fontSize: '0.85rem' }}>{opt.label}</div>
                          <div style={{ color: 'var(--cor-texto-suave)', fontSize: '0.72rem', marginTop: '2px' }}>{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Título e Tipo */}
                  <div className="row g-3 mb-3">
                    <div className="col-8">
                      <label className="form-label-custom">Título *</label>
                      <input className="form-control-custom" value={form.titulo}
                        onChange={e => setForm({ ...form, titulo: e.target.value })} required
                        placeholder="Ex: Gira de Caboclos" />
                    </div>
                    <div className="col-4">
                      <label className="form-label-custom">Tipo</label>
                      <input className="form-control-custom" value={form.tipo}
                        onChange={e => setForm({ ...form, tipo: e.target.value })}
                        placeholder="Ex: Caboclos" />
                    </div>
                  </div>

                  {/* Data, Horário e Vagas */}
                  <div className="row g-3 mb-3">
                    <div className="col-4">
                      <label className="form-label-custom">Data *</label>
                      <input type="date" className="form-control-custom" value={form.data}
                        onChange={e => setForm({ ...form, data: e.target.value })} required />
                    </div>
                    <div className="col-4">
                      <label className="form-label-custom">Horário *</label>
                      <input type="time" className="form-control-custom" value={form.horario}
                        onChange={e => setForm({ ...form, horario: e.target.value })} required />
                    </div>
                    {form.acesso === 'publica' && (
                      <div className="col-4">
                        <label className="form-label-custom">Limite de Vagas *</label>

                        <input type="number" className="form-control-custom" value={form.limite_consulentes}
                          onChange={e => setForm({ ...form, limite_consulentes: e.target.value })}
                          required min={1} />
                      </div>                      
                    )}
                    {form.acesso === 'fechada' && (
                      <div className="col-4">
                        <label className="form-label-custom">Limite de Membros *</label>
                        <input type="number" className="form-control-custom" value={form.limite_membros}
                          onChange={e => setForm({ ...form, limite_membros: e.target.value })}
                          required min={1} />
                      </div>
                    )}
                  </div>

                  {/* Abertura e Fechamento — apenas giras públicas */}
                  {form.acesso === 'publica' && (
                  <div className="row g-3 mb-4">
                    {/* Responsável pela lista */}
                  <div className="mb-3">
                    <label className="form-label-custom">
                      Responsável pela Lista
                      <span style={{ color: 'var(--cor-texto-suave)', fontWeight: 400, marginLeft: '0.4rem', fontSize: '0.8rem' }}>
                        (opcional)
                      </span>
                    </label>
                    <select
                      className="form-control-custom"
                      value={form.responsavel_lista_id}
                      onChange={e => setForm({ ...form, responsavel_lista_id: e.target.value })}
                      style={{ appearance: 'auto' }}
                    >
                      <option value="">— Nenhum responsável definido —</option>
                      {membros.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.nome} ({m.role})
                        </option>
                      ))}
                    </select>
                    <small style={{ color: 'var(--cor-texto-suave)', fontSize: '0.78rem' }}>
                      Membro responsável por gerenciar as inscrições desta gira
                    </small>
                  </div>

                    <div className="divider-ornamental">
                      <span style={{ fontSize: '0.8rem', color: 'var(--cor-texto-suave)' }}>Lista de Inscrições</span>
                    </div>
                    <div className="col-6">
                      <label className="form-label-custom">Abertura da Lista *</label>
                      <input type="datetime-local" className="form-control-custom" value={form.abertura_lista}
                        onChange={e => setForm({ ...form, abertura_lista: e.target.value })} required />
                    </div>
                    <div className="col-6">
                      <label className="form-label-custom">Fechamento da Lista *</label>
                      <input type="datetime-local" className="form-control-custom" value={form.fechamento_lista}
                        onChange={e => setForm({ ...form, fechamento_lista: e.target.value })} required />
                    </div>
                  </div>
                  )}

                  <button type="submit" className="btn-gold" disabled={loading} style={{ padding: '0.6rem 2rem' }}>
                    {loading
                      ? <span className="spinner-border spinner-border-sm me-2"></span>
                      : <i className="bi bi-stars me-2"></i>
                    }
                    Criar Gira
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}