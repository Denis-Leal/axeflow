import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";
import { toast } from 'react-toastify';
import {
  criarPublicacao,
  excluirPublicacao,
  getPerfilPublico,
  listPublicacoes,
  salvarPerfilPublico,
} from "../services/api";

const LocationMapPicker = dynamic(() => import("../components/portal/LocationMapPicker"), { ssr: false });

const vazio = {
  publico_ativo: false,
  slug_publico: "",
  descricao_publica: "",
  telefone_publico: "",
  whatsapp_publico: "",
  instagram_publico: "",
  endereco_publico: false,
  endereco_linha: "",
  bairro: "",
  cidade: "",
  uf: "",
  cep: "",
  latitude: "",
  longitude: "",
};

export default function InformacoesPublicas() {
  const [perfil, setPerfil] = useState(vazio);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapaAberto, setMapaAberto] = useState(false);
  const [post, setPost] = useState({
    titulo: "",
    conteudo: "",
    categoria: "aviso",
    publicado: true,
  });
  const carregar = async () => {
    const [p, l] = await Promise.all([getPerfilPublico(), listPublicacoes()]);
    setPerfil({ ...vazio, ...p.data });
    setPosts(l.data);
  };
  useEffect(() => {
    carregar()
      .catch(() => toast.error("Não foi possível carregar as informações."))
      .finally(() => setLoading(false));
  }, []);
  const salvar = async (e) => {
    e.preventDefault();
    toast.dismiss();
    try {
      const r = await salvarPerfilPublico(perfil);
      setPerfil({ ...vazio, ...r.data });
      toast.success("Informações públicas salvas.");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Não foi possível salvar.");
    }
  };
  const publicar = async (e) => {
    e.preventDefault();
    try {
      await criarPublicacao(post);
      setPost({
        titulo: "",
        conteudo: "",
        categoria: "aviso",
        publicado: true,
      });
      await carregar();
    } catch (e) {
      toast.error(
        e.response?.data?.detail || "Não foi possível criar a publicação.",
      );
    }
  };
  const buscarCep = async () => {
    const cep = (perfil.cep || "").replace(/\D/g, "");
    if (cep.length !== 8) return toast.error("Informe um CEP com 8 números.");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (data.erro) return toast.error("CEP não encontrado.");
      setPerfil(v => ({ ...v, cep, endereco_linha: data.logradouro || v.endereco_linha, bairro: data.bairro || v.bairro, cidade: data.localidade || v.cidade, uf: data.uf || v.uf }));
      toast.success("Endereço preenchido pelo CEP. Selecione o ponto no mapa para registrar as coordenadas.");
    } catch (error) {
      toast.error("Não foi possível consultar o CEP agora.");
    }
  };
  if (loading)
    return <div className="spinner-gold" style={{ margin: "45vh auto" }} />;
  const field = (key, label, extra = {}) => (
    <div className="mb-3">
      <label className="form-label-custom">{label}</label>
      <input
        className="form-control-custom"
        value={perfil[key] || ""}
        onChange={(e) => setPerfil({ ...perfil, [key]: e.target.value })}
        {...extra}
      />
    </div>
  );
  return (
    <>
      <Head>
        <title>Informações públicas | AxeFlow</title>
      </Head>
      <div style={{ display: "flex" }}>
        <Sidebar />
        <main className="main-content">
          <div className="topbar">
            <div>
              <h5
                style={{
                  fontFamily: "Cinzel",
                  color: "var(--cor-acento)",
                  margin: 0,
                }}
              >
                Informações públicas
              </h5>
              <small style={{ color: "var(--cor-texto-suave" }}>
                Controle como seu terreiro aparece no Portal AxeFlow.
              </small>
            </div>
          </div>
          <div className="page-content">
            <div
              className="alert-custom mb-4"
              style={{
                background: "rgba(212,175,55,.08)",
                border: "1px solid var(--cor-borda)",
                color: "var(--cor-texto-suave)",
              }}
            >
              O perfil é privado por padrão. Ative-o somente quando estiver
              pronto para aparecer no portal.
            </div>
            {toastContainer}
            <div className="row g-4">
              <div className="col-lg-7">
                <form className="card-custom p-4" onSubmit={salvar}>
                  <h6
                    className="mb-4"
                    style={{ color: "var(--cor-acento)", fontFamily: "Cinzel" }}
                  >
                    Perfil no portal
                  </h6>
                  <label
                    className="mb-4"
                    style={{
                      display: "flex",
                      gap: ".7rem",
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={perfil.publico_ativo}
                      onChange={(e) =>
                        setPerfil({
                          ...perfil,
                          publico_ativo: e.target.checked,
                        })
                      }
                    />
                    <span>Exibir meu terreiro no Portal Público AxeFlow</span>
                  </label>
                  {field("slug_publico", "Endereço público", {
                    placeholder: "ex: casa-de-ogum",
                  })}
                  <div className="mb-3">
                    <label className="form-label-custom">Apresentação</label>
                    <textarea
                      className="form-control-custom"
                      rows="4"
                      value={perfil.descricao_publica || ""}
                      onChange={(e) =>
                        setPerfil({
                          ...perfil,
                          descricao_publica: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="row">
                    <div className="col-md-6">
                      {field("whatsapp_publico", "WhatsApp público")}
                    </div>
                    <div className="col-md-6">
                      {field("instagram_publico", "Instagram")}
                    </div>
                  </div>
                  <hr style={{ borderColor: "var(--cor-borda)" }} />
                  <label
                    className="mb-3"
                    style={{
                      display: "flex",
                      gap: ".7rem",
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={perfil.endereco_publico}
                      onChange={(e) =>
                        setPerfil({
                          ...perfil,
                          endereco_publico: e.target.checked,
                        })
                      }
                    />
                    <span>Mostrar endereço completo ao público</span>
                  </label>
                  {field("endereco_linha", "Endereço")}
                  {field("bairro", "Bairro")}
                  <div className="row">
                    <div className="col-md-7">{field("cidade", "Cidade")}</div>
                    <div className="col-md-2">{field("uf", "UF")}</div>
                    <div className="col-md-3"><div className="mb-3"><label className="form-label-custom">CEP</label><div style={{display:'flex',gap:8}}><input className="form-control-custom" value={perfil.cep || ''} maxLength={9} onChange={e => setPerfil({...perfil, cep:e.target.value})}/><button type="button" className="btn-outline-gold" onClick={buscarCep}>Buscar</button></div></div></div>
                  </div>
                  <div className="row">
                    <div className="col-md-6">{field("latitude", "Latitude")}</div>
                    <div className="col-md-6">{field("longitude", "Longitude")}</div>
                  </div>
                  <button type="button" className="btn-outline-gold me-2" onClick={() => navigator.geolocation?.getCurrentPosition(
                    p => setPerfil(v => ({ ...v, latitude: String(p.coords.latitude), longitude: String(p.coords.longitude) })),
                    () => toast.error("Não foi possível obter a localização. Verifique a permissão do navegador."),
                  )}>
                    Usar minha localização
                  </button>
                  <button type="button" className="btn-outline-gold me-2" onClick={() => setMapaAberto(true)}>Selecionar no mapa</button>
                  <button className="btn-gold" type="submit">
                    Salvar perfil público
                  </button>
                </form>
              </div>
              <div className="col-lg-5">
                <form className="card-custom p-4 mb-4" onSubmit={publicar}>
                  <h6
                    className="mb-3"
                    style={{ color: "var(--cor-acento)", fontFamily: "Cinzel" }}
                  >
                    Novo aviso no mural
                  </h6>
                  <input
                    className="form-control-custom mb-3"
                    placeholder="Título"
                    required
                    value={post.titulo}
                    onChange={(e) =>
                      setPost({ ...post, titulo: e.target.value })
                    }
                  />
                  <textarea
                    className="form-control-custom mb-3"
                    placeholder="Conteúdo"
                    rows="4"
                    required
                    value={post.conteudo}
                    onChange={(e) =>
                      setPost({ ...post, conteudo: e.target.value })
                    }
                  />
                  <select
                    className="form-control-custom mb-3"
                    value={post.categoria}
                    onChange={(e) =>
                      setPost({ ...post, categoria: e.target.value })
                    }
                  >
                    <option value="aviso">Aviso</option>
                    <option value="festa">Festa</option>
                    <option value="doacao">Doação</option>
                    <option value="noticia">Notícia</option>
                  </select>
                  <button className="btn-gold" type="submit">
                    Publicar no mural
                  </button>
                </form>
                <div className="card-custom p-4">
                  <h6
                    className="mb-3"
                    style={{ color: "var(--cor-acento)", fontFamily: "Cinzel" }}
                  >
                    Publicações
                  </h6>
                  {posts.length === 0 ? (
                    <small style={{ color: "var(--cor-texto-suave)" }}>
                      Ainda não há publicações.
                    </small>
                  ) : (
                    posts.map((p) => (
                      <div
                        key={p.id}
                        className="mb-3 pb-3"
                        style={{ borderBottom: "1px solid var(--cor-borda)" }}
                      >
                        <b>{p.titulo}</b>
                        <small
                          className="d-block"
                          style={{ color: "var(--cor-texto-suave)" }}
                        >
                          {p.categoria} ·{" "}
                          {p.publicado ? "publicada" : "rascunho"}
                        </small>
                        <button
                          type="button"
                          onClick={async () => {
                            await excluirPublicacao(p.id);
                            carregar();
                          }}
                          style={{
                            border: 0,
                            background: "none",
                            color: "#ef4444",
                            fontSize: ".8rem",
                            padding: 0,
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      <BottomNav />
      {mapaAberto && <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}><div className="card-custom p-4" style={{width:'min(720px,100%)'}}><h5 style={{color:'var(--cor-acento)',fontFamily:'Cinzel'}}>Selecionar localização</h5><p style={{color:'var(--cor-texto-suave)',fontSize:'.9rem'}}>Clique no ponto exato do terreiro no mapa.</p><LocationMapPicker latitude={perfil.latitude} longitude={perfil.longitude} onChange={p => setPerfil(v => ({...v, latitude:String(p.latitude), longitude:String(p.longitude)}))}/><div className="mt-3 d-flex gap-2 justify-content-end"><button className="btn-outline-gold" onClick={() => setMapaAberto(false)}>Cancelar</button><button className="btn-gold" onClick={() => setMapaAberto(false)}>Confirmar ponto</button></div></div></div>}
    </>
  );
}