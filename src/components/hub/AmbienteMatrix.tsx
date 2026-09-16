import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { AMBIENTES } from "@/lib/ambientes";

/**
 * Matriz de ambientes. Os chips de subambiente levam direto ao destino final
 * — um toque em vez de dois — e já mostram "Em breve" quando o subambiente
 * ainda não tem fluxo, para o médico não descobrir depois do clique.
 */
export function AmbienteMatrix({ primeiroAcesso = false }: { primeiroAcesso?: boolean }) {
  return (
    <section aria-labelledby="hub-ambientes" className="space-y-4">
      <div>
        <h2 id="hub-ambientes" className="t-display text-foreground">
          Onde você está atendendo?
        </h2>
        <p className="t-body text-muted-foreground mt-1">
          {primeiroAcesso
            ? "Escolha o ambiente para abrir seu primeiro plantão."
            : "O ambiente define o modelo de evolução e os agentes usados."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {AMBIENTES.map((amb) => (
          <article
            key={amb.id}
            data-testid={`hub-ambiente-${amb.id}`}
            className={`rounded-3xl border ${amb.accent.border} bg-card flex flex-col gap-4 p-5`}
          >
            <Link
              to="/ambiente/$ambienteId"
              params={{ ambienteId: amb.id }}
              className="group focus-visible:ring-ring -m-2 flex items-start gap-4 rounded-2xl p-2 focus-visible:ring-2 focus-visible:outline-none"
            >
              <div
                className={`h-12 w-12 shrink-0 rounded-2xl ${amb.accent.bg} ${amb.accent.text} flex items-center justify-center`}
              >
                <amb.icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="t-title text-foreground">
                  <span aria-hidden="true" className="mr-1.5">
                    {amb.emoji}
                  </span>
                  {amb.label}
                </h3>
                <p className="t-body text-muted-foreground mt-1">{amb.descricao}</p>
              </div>
              <ChevronRight
                className="text-muted-foreground group-hover:text-foreground mt-1 h-5 w-5 shrink-0 transition-colors"
                aria-hidden="true"
              />
            </Link>

            <ul className="flex flex-wrap gap-2" aria-label={`Áreas de ${amb.label}`}>
              {amb.subs.map((s) => (
                <li key={s.id}>
                  <Link
                    to="/ambiente/$ambienteId/$subId"
                    params={{ ambienteId: amb.id, subId: s.id }}
                    data-testid={`hub-sub-${s.id}`}
                    className={`t-label border-border bg-background hover:bg-secondary focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center gap-2 rounded-2xl border px-3.5 transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                      s.implementado ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {s.icon ? <s.icon className="h-4 w-4" aria-hidden="true" /> : null}
                    {s.label}
                    {!s.implementado && (
                      <span className="t-eyebrow bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                        Em breve
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
