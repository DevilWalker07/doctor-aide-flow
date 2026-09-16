import { Link } from "@tanstack/react-router";
import { ChevronRight, Lock } from "lucide-react";
import { acentoDo, LOCAIS } from "@/lib/ambientes";

/**
 * "Onde você está agora?" — os dez locais de atendimento em lista plana.
 *
 * Um toque leva ao destino final. O selo "Em breve" aparece antes do clique e
 * o selo de conta avisa que o plantão exige login, em vez de deixar o médico
 * descobrir no meio do caminho.
 */
export function LocalPicker({ precisaDeConta = false }: { precisaDeConta?: boolean }) {
  return (
    <section aria-labelledby="hub-locais" className="space-y-4" id="locais">
      <div>
        <h2 id="hub-locais" className="t-display text-foreground">
          Onde você está agora?
        </h2>
        <p className="t-body text-muted-foreground mt-1">
          {precisaDeConta
            ? "Abrir um plantão precisa de conta — os dados de paciente ficam protegidos por ela."
            : "O local define o modelo de evolução e os agentes usados no plantão."}
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {LOCAIS.map((local) => {
          const acento = acentoDo(local);
          return (
            <li key={local.id}>
              <Link
                to="/local/$localId"
                params={{ localId: local.id }}
                data-testid={`hub-local-${local.id}`}
                className={`bg-card hover:bg-secondary focus-visible:ring-ring flex h-full items-center gap-3 rounded-2xl border ${acento.border} p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none`}
              >
                <div
                  className={`h-11 w-11 shrink-0 rounded-2xl ${acento.bg} ${acento.text} flex items-center justify-center`}
                >
                  <local.icon className="h-5 w-5" aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="t-title text-foreground">{local.label}</span>
                    {!local.implementado && (
                      <span className="t-eyebrow bg-muted text-muted-foreground rounded-full px-2 py-1">
                        Em breve
                      </span>
                    )}
                    {local.implementado && precisaDeConta && (
                      <span className="t-eyebrow text-muted-foreground inline-flex items-center gap-1">
                        <Lock className="h-3 w-3" aria-hidden="true" /> Conta
                      </span>
                    )}
                  </div>
                  <p className="t-body text-muted-foreground">{local.descricao}</p>
                </div>

                <ChevronRight
                  className="text-muted-foreground h-5 w-5 shrink-0"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
