import { Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, HardHat } from "lucide-react";
import { ATALHOS_GLOBAIS, type Ambiente, type SubAmbiente } from "@/lib/ambientes";

interface Props {
  ambiente: Ambiente;
  sub: SubAmbiente;
}

/**
 * Tela para um subambiente ainda sem template de evolução.
 * Nunca é um beco sem saída: além de voltar, oferece o que já funciona hoje.
 */
export function EmConstrucao({ ambiente, sub }: Props) {
  const Icon = sub.icon ?? ambiente.icon;
  const atalhos = ambiente.atalhos.length ? ambiente.atalhos : ATALHOS_GLOBAIS;

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          to="/ambiente/$ambienteId"
          params={{ ambienteId: ambiente.id }}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-2 inline-flex items-center gap-2 rounded-xl px-2 py-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          <span className="t-label">Voltar para {ambiente.curto}</span>
        </Link>

        <div
          className={`mt-6 rounded-3xl border ${ambiente.accent.border} bg-card p-6 sm:p-8`}
          data-testid="em-construcao"
        >
          <div className="flex items-start gap-4">
            <div
              className={`h-14 w-14 shrink-0 rounded-2xl ${ambiente.accent.bg} ${ambiente.accent.text} flex items-center justify-center`}
            >
              <Icon className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="t-eyebrow text-muted-foreground">{ambiente.curto}</p>
              <h1 className="t-display text-foreground mt-1">{sub.label}</h1>
              <p className="t-body text-muted-foreground mt-2">{sub.descricao}</p>
            </div>
          </div>

          <div className="bg-secondary mt-6 flex items-start gap-3 rounded-2xl p-4">
            <HardHat className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="t-body text-foreground">
              Este ambiente ainda não tem template de evolução próprio. Estou construindo — enquanto
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
