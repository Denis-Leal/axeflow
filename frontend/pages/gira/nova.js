import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Sidebar from '../../components/Sidebar';
import { createGira } from '../../services/api';

export default function NovaGira() {
  const router = useRouter();
  const [form, setForm] = useState({
    titulo: '', tipo: '', data: '', horario: '',
    limite_consulentes: 20,
    abertura_lista: '', fechamento_lista: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        limite_consulentes: parseInt(form.limite_consulentes),
        horario: form.horario + ':00',
      };
      const res = await createGira(payload);
      router.push(`/giras/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao criar gira');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Nova Gira | Terreiro SaaS</title></Head>
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
                {error && <div className="alert-custom alert-danger-custom mb-3"><i className="bi bi-exclamation-circle me-2"></i>{error}</div>}
                <form onSubmit={handleSubmit}>
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
                    <div className="col-4">
                      <label className="form-label-custom">Limite de Vagas *</label>
                      <input type="number" className="form-control-custom" value={form.limite_consulentes}
                        onChange={e => setForm({ ...form, limite_consulentes: e.target.value })} required min={1} />
                    </div>
                  </div>

                  <div className="divider-ornamental">
                    <span style={{ fontSize: '0.8rem', color: 'var(--cor-texto-suave)' }}>Lista de Inscrições</span>
                  </div>

                  <div className="row g-3 mb-4">
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

                  <button type="submit" className="btn-gold" disabled={loading} style={{ padding: '0.6rem 2rem' }}>
                    {loading ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-stars me-2"></i>}
                    Criar Gira
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
