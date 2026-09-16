import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { z } from "zod";
import { getAmbiente, type Ambiente } from "@/lib/ambientes";

export const Route = createFileRoute("/ambiente/$ambienteId/")({
  validateSearch: z.object({ sub: z.string().optional() }),
  loader: ({ params }) => {
    const ambiente = getAmbiente(params.ambienteId);
    if (!ambiente) throw notFound();
    return { ambiente };
  },
  component: AmbientePage,
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.ambiente.curto ?? "Ambiente"} — MEDFLUXO` }],
  }),
});

function AmbientePage() {
  const { ambiente } = Route.useLoaderData() as { ambiente: Ambiente };

  return (
    <div className="bg-background min-h-screen">
      <header className="mx-auto flex max-w-4xl items-center gap-3 px-4 pt-5 sm:px-6">
        <Link
          to="/"
          aria-label="Voltar para a central"
          className="touch-target border-border bg-card text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl border transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <span className="t-eyebrow text-muted-foreground">Ambiente de atendimento</span>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
        <div className="flex items-start gap-4">
          <div
            className={`h-16 w-16 shrink-0 rounded-3xl ${ambiente.accent.bg} ${ambiente.accent.text} flex items-center justify-center`}
          >
            <ambiente.icon className="h-8 w-8" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="t-display text-foreground">
              <span aria-hidden="true" className="mr-2">
                {ambiente.emoji}
              </span>
              {ambiente.label}
            </h1>
            <p className="t-body text-muted-foreground mt-1">{ambiente.descricao}</p>
          </div>
        </div>

        <section aria-labelledby="sub-titulo" className="space-y-3">
          <div>
            <h2 id="sub-titulo" className="t-eyebrow text-muted-foreground">
              Escolha a área
            </h2>
            <p className="t-body text-muted-foreground mt-1">
              Na próxima tela você informa unidade e data. O modelo de evolução já vem configurado.
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ambiente.subs.map((s) => (
              <li key={s.id}>
                <Link
                  to="/ambiente/$ambienteId/$subId"
                  params={{ ambienteId: ambiente.id, subId: s.id }}
                  data-testid={`ambiente-sub-${s.id}`}
                  className={`border-border bg-card hover:bg-secondary focus-visible:ring-ring flex h-full items-start gap-3 rounded-2xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none`}
                >
                  {s.icon ? (
                    <s.icon
                      className={`mt-0.5 h-5 w-5 shrink-0 ${ambiente.accent.text}`}
                      aria-hidden="true"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="t-title text-foreground">{s.label}</span>
                      {/* O selo aparece ANTES do toque: sinalizar, não punir depois. */}
                      {!s.implementado && (
                        <span className="t-eyebrow bg-muted text-muted-foreground rounded-full px-2 py-1">
                          Em breve
                        </span>
                      )}
                    </div>
                    <p className="t-body text-muted-foreground mt-1">{s.descricao}</p>
                  </div>
                  <ChevronRight
                    className="text-muted-foreground mt-1 h-5 w-5 shrink-0"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {ambiente.atalhos.length > 0 && (
          <section aria-labelledby="atalhos-titulo" className="space-y-3">
            <h2 id="atalhos-titulo" className="t-eyebrow text-muted-foreground">
              Ferramentas deste ambiente
            </h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {ambiente.atalhos.map((a) => (
                <li key={a.to + a.label}>
                  <Link
                    to={a.to}
                    data-testid={`ambiente-atalho-${a.to.replace("/", "")}`}
                    className="border-border bg-card hover:bg-secondary focus-visible:ring-ring flex h-full flex-col gap-2 rounded-2xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <div className="bg-secondary text-foreground flex h-11 w-11 items-center justify-center rounded-xl">
                      <a.icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span className="t-title text-foreground">{a.label}</span>
                    <span className="t-body text-muted-foreground">{a.descricao}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
