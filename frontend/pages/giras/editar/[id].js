import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Sidebar from '../../../components/Sidebar';
import BottomNav from '../../../components/BottomNav';
import { getGira, getMe } from '../../../services/api';
import { handleApiError } from '../../../services/errorHandler';
import api from '../../../services/api';

export default function EditarGira() {
  const router = useRouter();
  const { id } = router.query;
  const [form, setForm] = useState(null);
  const [membros, setMembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    // Verifica role antes de carregar
    getMe()
      .then(meRes => {
        if (!['admin', 'operador'].includes(meRes.data.role)) {
          router.push('/giras?erro=sem-permissao');
          return Promise.reject('sem-permissao');
        }
        return Promise.all([getGira(id), api.get('/membros')]);
      })
      .then(results => {
        if (!results) return;
        const [giraRes, membrosRes] = results;
        const g = giraRes.data;
        setForm({
          titulo:               g.titulo || '',
          tipo:                 g.tipo || '',
          acesso:               g.acesso || 'publica',
          data:                 g.data || '',
          horario:              g.horario ? g.horario.slice(0, 5) : '',
          limite_consulentes:   g.limite_consulentes || 20,
          limite_membros:       g.limite_membros || null,
          abertura_lista:       g.abertura_lista ? g.abertura_lista.slice(0, 16) : '',
          fechamento_lista:     g.fechamento_lista ? g.fechamento_lista.slice(0, 16) : '',
          responsavel_lista_id: g.responsavel_lista_id || '',
          status:               g.status || 'aberta',
        });
        setMembros(membrosRes.data);
      })
      .catch(err => { if (err !== 'sem-permissao') router.push('/giras'); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        limite_consulentes: parseInt(form.limite_consulentes),
        limite_membros: parseInt(form.limite_membros) || null,
        horario: form.horario.length === 5 ? form.horario + ':00' : form.horario,
        responsavel_lista_id: form.responsavel_lista_id || null,
      };
      await api.put(`/giras/${id}`, payload);
      router.push(`/giras/${id}`);
    } catch (err) {
      setError(handleApiError(err, 'EditarGira'));
      setSaving(false);
    }
  };

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  if (loading || !form) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner-gold"></div>
    </div>
  );

  return (
    <>
      <Head><title>Editar Gira | AxeFlow</title></Head>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content">
          <div className="topbar">
            <div>
              <h5 style={{ fontFamily: 'Cinzel', color: 'var(--cor-acento)', margin: 0 }}>Editar Gira</h5>
              <small style={{ color: 'var(--cor-texto-suave)' }}>{form.titulo}</small>
            </div>
            <Link href={`/giras/${id}`} style={{ color: 'var(--cor-texto-suave)', textDecoration: 'none', fontSize: '0.9rem' }}>
              ← Voltar
            </Link>
          </div>

          <div className="page-content">
            <div className="card-custom" style={{ maxWidth: '680px' }}>
              <div className="card-header">
                <span style={{ fontFamily: 'Cinzel', fontSize: '0.9rem', color: 'var(--cor-acento)' }}>✦ Dados da Gira</span>
              </div>
              <div style={{ padding: '1.5rem' }}>
                {error && (
                  <div className="alert-custom alert-danger-custom mb-4">
                    <i className="bi bi-exclamation-circle me-2"></i>{error}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className="row g-3">

                    <div className="col-12">
                      <label className="form-label-custom">Tipo de Gira</label>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        {[
                          { value: 'publica', emoji: '🌐', label: 'Aberta ao público' },
                          { value: 'fechada', emoji: '🔒', label: 'Fechada (membros)' },
                        ].map(opt => (
                          <button key={opt.value} type="button"
                            onClick={() => set('acesso', opt.value)}
                            style={{
                              flex: 1, padding: '0.65rem', borderRadius: '8px', cursor: 'pointer',
                              background: form.acesso === opt.value ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)',
                              border: `1.5px solid ${form.acesso === opt.value ? 'var(--cor-acento)' : 'var(--cor-borda)'}`,
                              color: form.acesso === opt.value ? 'var(--cor-acento)' : 'var(--cor-texto)',
                              fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
                            }}>
                            {opt.emoji} {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="col-12">
                      <label className="form-label-custom">Título *</label>
                      <input className="form-control-custom" value={form.titulo} required
                        onChange={e => set('titulo', e.target.value)} placeholder="Ex: Gira de Oxum" />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label-custom">Tipo</label>
                      <input className="form-control-custom" value={form.tipo}
                        onChange={e => set('tipo', e.target.value)} placeholder="Ex: Umbanda, Candomblé..." />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label-custom">Status</label>
                      <select className="form-control-custom" value={form.status}
                        onChange={e => set('status', e.target.value)}>
                        <option value="aberta">Aberta</option>
                        <option value="fechada">Fechada</option>
                        <option value="concluida">Concluída</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label-custom">Data *</label>
                      <input type="date" className="form-control-custom" value={form.data} required
                        onChange={e => set('data', e.target.value)} />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label-custom">Horário *</label>
                      <input type="time" className="form-control-custom" value={form.horario} required
                        onChange={e => set('horario', e.target.value)} />
                    </div>
                    {form.acesso === 'fechada' && (
                      <div className="col-md-6">
                        <label className="form-label-custom">Limite de membros *</label>
                        <input type="number" className="form-control-custom" value={form.limite_membros} required
                          min="1" max="999" onChange={e => set('limite_membros', e.target.value)} />
                      </div>
                    )}
                    {form.acesso !== 'fechada' && (
                      <div className="col-md-6">
                        <label className="form-label-custom">Limite de consulentes *</label>
                        <input type="number" className="form-control-custom" value={form.limite_consulentes} required
                          min="1" max="999" onChange={e => set('limite_consulentes', e.target.value)} />
                      </div>
                    )}

                    {form.acesso !== 'fechada' && (<>
                    <div className="col-md-6">
                      <label className="form-label-custom">Responsável pela lista</label>
                      <select className="form-control-custom" value={form.responsavel_lista_id}
                        onChange={e => set('responsavel_lista_id', e.target.value)}>
                        <option value="">— Nenhum —</option>
                        {membros.map(m => (
                          <option key={m.id} value={m.id}>{m.nome}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label-custom">Abertura da lista *</label>
                      <input type="datetime-local" className="form-control-custom" value={form.abertura_lista}
                        onChange={e => set('abertura_lista', e.target.value)} required={form.acesso !== 'fechada'} />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label-custom">Fechamento da lista *</label>
                      <input type="datetime-local" className="form-control-custom" value={form.fechamento_lista}
                        onChange={e => set('fechamento_lista', e.target.value)} required={form.acesso !== 'fechada'} />
                    </div>
                    </>)}

                    <div className="col-12" style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <button type="submit" className="btn-gold" disabled={saving}
                        style={{ padding: '0.65rem 2rem' }}>
                        {saving
                          ? <><span className="spinner-border spinner-border-sm me-2"></span>Salvando...</>
                          : <><i className="bi bi-check-lg me-2"></i>Salvar alterações</>}
                      </button>
                      <Link href={`/giras/${id}`} className="btn-outline-gold"
                        style={{ padding: '0.65rem 1.5rem', textDecoration: 'none' }}>
                        Cancelar
                      </Link>
                    </div>

                  </div>
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