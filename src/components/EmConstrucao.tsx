import { Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, HardHat } from "lucide-react";
import { acentoDo, ATALHOS_GLOBAIS, type Local } from "@/lib/ambientes";

/**
 * Tela para um local ainda sem template de evolução.
 * Nunca é um beco sem saída: além de voltar, oferece o que já funciona hoje.
 */
export function EmConstrucao({ local }: { local: Local }) {
  const acento = acentoDo(local);
  const atalhos = local.atalhos.length ? local.atalhos : ATALHOS_GLOBAIS;

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          to="/"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-2 inline-flex min-h-[2.75rem] items-center gap-2 rounded-xl px-2 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          <span className="t-label">Voltar para a central</span>
        </Link>

        <div
          className={`mt-6 rounded-3xl border ${acento.border} bg-card p-6 sm:p-8`}
          data-testid="em-construcao"
        >
          <div className="flex items-start gap-4">
            <div
              className={`h-14 w-14 shrink-0 rounded-2xl ${acento.bg} ${acento.text} flex items-center justify-center`}
            >
              <local.icon className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="t-eyebrow text-muted-foreground">Local de atendimento</p>
              <h1 className="t-display text-foreground mt-1">{local.label}</h1>
              <p className="t-body text-muted-foreground mt-2">{local.descricao}</p>
            </div>
          </div>

          <div className="bg-secondary mt-6 flex items-start gap-3 rounded-2xl p-4">
            <HardHat className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="t-body text-foreground">
              Este local ainda não tem modelo de evolução próprio. Estou construindo — enquanto
              isso, o que já está pronto continua à mão.
            </p>
          </div>
        </div>

        <section aria-labelledby="em-construcao-atalhos" className="mt-8">
          <h2 id="em-construcao-atalhos" className="t-eyebrow text-muted-foreground">
            Disponível agora
          </h2>
          <ul className="mt-3 space-y-3">
            {atalhos.map((a) => (
              <li key={a.to + a.label}>
                <Link
                  to={a.to}
                  className="border-border bg-card hover:bg-secondary focus-visible:ring-ring flex items-center gap-4 rounded-2xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <div className="bg-secondary text-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                    <a.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="t-title text-foreground">{a.label}</p>
                    <p className="t-body text-muted-foreground">{a.descricao}</p>
                  </div>
                  <ChevronRight
                    className="text-muted-foreground h-5 w-5 shrink-0"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
