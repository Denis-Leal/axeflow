import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Sidebar from '../../components/Sidebar';
import BottomNav from '../../components/BottomNav';
import { createGira, getMe } from '../../services/api';
import { handleApiError } from '../../services/errorHandler';
import api from '../../services/api';
import { Button, FormField, Card, CardHeader, CardBody, StatCard } from '../../components/ui';

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
            <Card style={{ maxWidth: '720px', margin: '0 auto' }}>
              <CardHeader>
                <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>✦ Detalhes da Gira</span>
              </CardHeader>
              <CardBody>
                {error && (
                  <div className="alert-custom alert-danger-custom mb-3">
                    <i className="bi bi-exclamation-circle me-2"></i>{error}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  {/* Tipo de acesso — primeira decisão */}
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {[
                      { value: 'publica', emoji: '🌐', label: 'Aberta', desc: 'Consulentes externos' },
                      { value: 'fechada', emoji: '🔒', label: 'Fechada', desc: 'Somente membros' },
                    ].map(opt => {
                      const active = form.acesso === opt.value;

                      return (
                        <Card
                          key={opt.value}
                          onClick={() => setForm({ ...form, acesso: opt.value })}
                          highlight={active}
                          style={{
                            flex: 1,
                            padding: '0.85rem',
                            cursor: 'pointer',
                            background: active ? 'rgba(212,175,55,0.08)' : undefined,
                          }}
                        >
                          <div style={{ fontSize: '1.2rem' }}>{opt.emoji}</div>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                            {opt.label}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--cor-texto-suave)' }}>
                            {opt.desc}
                          </div>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Título e Tipo */}
                  <div className="row g-3 mb-3">
                    <FormField label={"Título"} required={true}>
                      <input className="form-control-custom" value={form.titulo}
                        onChange={e => setForm({ ...form, titulo: e.target.value })} required
                        placeholder="Ex: Gira de Caboclos" />
                    </FormField>
                    <FormField label={"Tipo"}>
                      <input className="form-control-custom" value={form.tipo}
                        onChange={e => setForm({ ...form, tipo: e.target.value })}
                        placeholder="Ex: Caboclos" />
                    </FormField>
                  </div>

                  {/* Data, Horário e Vagas */}
                  <div className="row g-3 mb-3">
                    <FormField label={"Data"} required={true}>
                      <input type="date" className="form-control-custom" value={form.data}
                        onChange={e => setForm({ ...form, data: e.target.value })} required />
                    </FormField>
                    <FormField label={"Horário"} required={true}>
                      <input type="time" className="form-control-custom" value={form.horario}
                        onChange={e => setForm({ ...form, horario: e.target.value })} required />
                    </FormField>
                    {form.acesso === 'publica' && (
                      <FormField label={"Limite de Vagas"} required={true}>
                        <input type="number" className="form-control-custom" value={form.limite_consulentes}
                          onChange={e => setForm({ ...form, limite_consulentes: e.target.value })}
                          required min={1} />
                      </FormField>
                    )}
                    {form.acesso === 'fechada' && (
                      <FormField label={"Limite de Membros"} required={true}>
                        <input type="number" className="form-control-custom" value={form.limite_membros}
                          onChange={e => setForm({ ...form, limite_membros: e.target.value })}
                          required min={1} />
                      </FormField>
                    )}
                  </div>

                  {/* Abertura e Fechamento — apenas giras públicas */}
                  {form.acesso === 'publica' && (
                  <div className="row g-3 mb-4">
                    {/* Responsável pela lista */}
                  <FormField label={"Responsável pela Lista (opcional)"} hint="Membro responsável por gerenciar as inscrições desta gira" required={true}>
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
                  </FormField>

                    <div className="divider-ornamental">
                      <span style={{ fontSize: '0.8rem', color: 'var(--cor-texto-suave)' }}>Lista de Inscrições</span>
                    </div>
                    <FormField label={"Abertura da Lista"} required={true}>
                      <input type="datetime-local" className="form-control-custom" value={form.abertura_lista}
                        onChange={e => setForm({ ...form, abertura_lista: e.target.value })} required />
                    </FormField>
                    <FormField label={"Fechamento da Lista"} required={true}>
                      <input type="datetime-local" className="form-control-custom" value={form.fechamento_lista}
                        onChange={e => setForm({ ...form, fechamento_lista: e.target.value })} required />
                    </FormField>
                  </div>
                  )}

                  <Button type="submit" loading={loading} variant='primary' fullWidth={true} disabled={loading}>
                    <i className="bi bi-stars me-2"></i> Criar Gira
                  </Button>
                </form>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}