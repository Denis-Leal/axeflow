import { useState } from "react";
import Head from "next/head";
import { explorarPortal } from "../../services/api";
import { useIsMobile } from "../../hooks/useMediaQuery";
import TerreiroCard from "../../components/portal/TerreiroCard";
import TerreiroTable from "../../components/portal/TerreiroTable";

const backend = process.env.BACKEND_URL || "http://backend:8000";

export default function Portal({ initialTerreiros }) {
  const isMobile = useIsMobile();
  const [terreiros, setTerreiros] = useState(initialTerreiros);
  const [buscando, setBuscando] = useState(false);
  const [proximidadeAtiva, setProximidadeAtiva] = useState(false);
  const [erro, setErro] = useState("");

  const buscarProximos = () => {
    if (!navigator.geolocation)
      return setErro("Seu navegador não suporta geolocalização.");
    setBuscando(true);
    setErro("");
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          const r = await explorarPortal({
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
            raio_km: 30,
          });
          setTerreiros(r.data);
          setProximidadeAtiva(true);
        } catch {
          setErro("Não foi possível buscar terreiros próximos.");
        } finally {
          setBuscando(false);
        }
      },
      () => {
        setErro(
          "Permita o acesso à localização para buscar terreiros próximos.",
        );
        setBuscando(false);
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  return (
    <>
      <Head>
        <title>Portal AxeFlow</title>
        <meta
          name="description"
          content="Encontre terreiros, giras e informações públicas."
        />
      </Head>
      <main
        style={{
          minHeight: "100vh",
          padding: "3rem max(1.25rem, calc((100vw - 1080px)/2))",
        }}
      >
        <header style={{ marginBottom: "2.5rem" }}>
          <div
            style={{
              color: "var(--cor-acento)",
              fontFamily: "Cinzel",
              letterSpacing: 2,
            }}
          >
            AXEFLOW
          </div>
          <h1 style={{ marginTop: ".5rem" }}>Portal Público</h1>
          <p style={{ color: "var(--cor-texto-suave)", maxWidth: 650 }}>
            Encontre terreiros participantes, avisos e próximas giras abertas
            para inscrição.
          </p>
          <button
            className="btn-outline-gold mt-2"
            onClick={buscarProximos}
            disabled={buscando}
          >
            {buscando ? "Buscando…" : "⌖ Terreiros próximos"}
          </button>
          {proximidadeAtiva && (
            <small
              className="d-block mt-2"
              style={{ color: "var(--cor-sucesso)" }}
            >
              Exibindo {terreiros.length} terreiro(s) público(s) em até 30 km,
              ordenados por distância.
            </small>
          )}
          {erro && (
            <small
              className="d-block mt-2"
              style={{ color: "var(--cor-aviso)" }}
            >
              {erro}
            </small>
          )}
        </header>
        {terreiros.length === 0 ? (
          <p style={{ color: "var(--cor-texto-suave)" }}>
            Nenhum terreiro público foi encontrado nesta área.
          </p>
        ) : isMobile ? (
          <section>
            {terreiros.map((t) => (
              <div className="mb-3" key={t.slug}>
                <TerreiroCard terreiro={t} />
              </div>
            ))}
          </section>
        ) : (
          <TerreiroTable terreiros={terreiros} />
        )}
      </main>
    </>
  );
}
export async function getServerSideProps() {
  try {
    const r = await fetch(`${backend}/public/portal/explorar`, {
      signal: AbortSignal.timeout(5000),
    });
    return { props: { initialTerreiros: r.ok ? await r.json() : [] } };
  } catch {
    return { props: { initialTerreiros: [] } };
  }
}
