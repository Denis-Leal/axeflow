import Head from "next/head";
import Link from "next/link";
import PortalPushButton from "../../components/portal/PortalPushButton";
const backend = process.env.BACKEND_URL || "http://backend:8000";
export default function TerreiroPortal({ terreiro }) {
  if (!terreiro)
    return (
      <main style={{ padding: "4rem", textAlign: "center" }}>
        <h1>Terreiro não encontrado</h1>
        <Link href="/portal">Voltar ao portal</Link>
      </main>
    );
  const endereco = terreiro.endereco_publico
    ? [terreiro.endereco_linha, terreiro.bairro, terreiro.cidade, terreiro.uf]
        .filter(Boolean)
        .join(" · ")
    : `${terreiro.cidade}${terreiro.bairro ? ` · ${terreiro.bairro}` : ""}`;
  return (
    <>
      <Head>
        <title>{terreiro.nome} | Portal AxeFlow</title>
      </Head>
      <main
        style={{
          minHeight: "100vh",
          padding: "3rem max(1.25rem, calc((100vw - 900px)/2))",
        }}
      >
        <Link href="/portal" style={{ color: "var(--cor-acento)" }}>
          ← Explorar portal
        </Link>
        <header className="card-custom p-4 mt-4">
          <small style={{ color: "var(--cor-acento)" }}>{endereco}</small>
          <h1 style={{ fontSize: "1.7rem", marginTop: ".5rem" }}>
            {terreiro.nome}
          </h1>
          {terreiro.descricao_publica && (
            <p
              style={{
                color: "var(--cor-texto-suave)",
                whiteSpace: "pre-line",
              }}
            >
              {terreiro.descricao_publica}
            </p>
          )}
          {terreiro.whatsapp_publico && (
            <a
              className="btn-gold d-inline-block"
              style={{ textDecoration: "none" }}
              href={`https://wa.me/${terreiro.whatsapp_publico.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
            >
              Falar no WhatsApp
            </a>
          )}
          <PortalPushButton terreiroSlug={terreiro.slug_publico} />
        </header>
        <section className="mt-5">
          <h2 style={{ fontSize: "1.2rem" }}>Próximas giras</h2>
          {terreiro.giras.length === 0 ? (
            <p style={{ color: "var(--cor-texto-suave)" }}>
              Não há giras abertas para divulgação no momento.
            </p>
          ) : (
            terreiro.giras.map((g) => (
              <div className="card-custom p-3 mt-3" key={g.slug}>
                <b>{g.titulo}</b>
                <span
                  className="d-block"
                  style={{ color: "var(--cor-texto-suave)" }}
                >
                  {new Date(`${g.data}T00:00:00`).toLocaleDateString("pt-BR")}{" "}
                  às {g.horario}
                </span>
                <Link
                  href={`/public/${g.slug}`}
                  className="btn-outline-gold d-inline-block mt-2"
                  style={{ textDecoration: "none" }}
                >
                  Inscrever-se
                </Link>
              </div>
            ))
          )}
        </section>
        <section className="mt-5">
          <h2 style={{ fontSize: "1.2rem" }}>Mural</h2>
          {terreiro.publicacoes.map((p) => (
            <article className="card-custom p-3 mt-3" key={p.id}>
              <small
                style={{
                  color: "var(--cor-acento)",
                  textTransform: "capitalize",
                }}
              >
                {p.categoria}
              </small>
              <h3 style={{ fontSize: "1rem", marginTop: ".25rem" }}>
                {p.titulo}
              </h3>
              <p
                style={{
                  whiteSpace: "pre-line",
                  color: "var(--cor-texto-suave)",
                  marginBottom: 0,
                }}
              >
                {p.conteudo}
              </p>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
export async function getServerSideProps({ params }) {
  try {
    const r = await fetch(
      `${backend}/public/portal/terreiros/${encodeURIComponent(params.slug)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    return { props: { terreiro: r.ok ? await r.json() : null } };
  } catch {
    return { props: { terreiro: null } };
  }
}
