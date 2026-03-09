import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { register } from '../services/api';

export default function Registro() {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: '', email: '', senha: '', telefone: '',
    terreiro_nome: '', terreiro_cidade: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(form);
      router.push('/login?cadastro=ok');
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Novo Terreiro | Terreiro SaaS</title></Head>
      <div className="login-wrapper">
        <div className="login-card" style={{ maxWidth: '520px' }}>
          <div className="login-logo">
            <div className="symbol">☽✦☾</div>
            <h1>Novo Terreiro</h1>
            <p style={{ color: 'var(--cor-texto-suave)', fontSize: '0.85rem' }}>Cadastre seu terreiro gratuitamente</p>
          </div>

          {error && <div className="alert-custom alert-danger-custom"><i className="bi bi-exclamation-circle me-2"></i>{error}</div>}

          <form onSubmit={handleSubmit}>
            <h6 style={{ color: 'var(--cor-acento)', fontFamily: 'Cinzel', marginBottom: '1rem' }}>✦ Dados do Terreiro</h6>
            <div className="row g-3 mb-3">
              <div className="col-8">
                <label className="form-label-custom">Nome do Terreiro</label>
                <input className="form-control-custom" value={form.terreiro_nome}
                  onChange={e => setForm({ ...form, terreiro_nome: e.target.value })} required />
              </div>
              <div className="col-4">
                <label className="form-label-custom">Cidade</label>
                <input className="form-control-custom" value={form.terreiro_cidade}
                  onChange={e => setForm({ ...form, terreiro_cidade: e.target.value })} required />
              </div>
            </div>

            <div className="divider-ornamental"><span style={{ fontSize: '0.8rem', color: 'var(--cor-texto-suave)' }}>Administrador</span></div>

            <div className="mb-3">
              <label className="form-label-custom">Nome</label>
              <input className="form-control-custom" value={form.nome}
                onChange={e => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div className="row g-3 mb-3">
              <div className="col-7">
                <label className="form-label-custom">Email</label>
                <input type="email" className="form-control-custom" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="col-5">
                <label className="form-label-custom">Telefone</label>
                <input className="form-control-custom" value={form.telefone}
                  onChange={e => setForm({ ...form, telefone: e.target.value })} />
              </div>
            </div>
            <div className="mb-4">
              <label className="form-label-custom">Senha</label>
              <input type="password" className="form-control-custom" value={form.senha}
                onChange={e => setForm({ ...form, senha: e.target.value })} required minLength={6} />
            </div>

            <button type="submit" className="btn-gold w-100" disabled={loading} style={{ padding: '0.75rem' }}>
              {loading ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-stars me-2"></i>}
              Criar Terreiro
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <Link href="/login" style={{ color: 'var(--cor-texto-suave)', fontSize: '0.9rem' }}>
              Já tenho conta → Entrar
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
