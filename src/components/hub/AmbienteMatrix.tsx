import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { AMBIENTES } from "@/lib/ambientes";

export function AmbienteMatrix() {
  return (
    <section aria-labelledby="hub-ambientes" className="space-y-4">
      <div>
        <h2
          id="hub-ambientes"
          className="text-xl sm:text-2xl font-black tracking-tight text-slate-100"
        >
          Onde você está atendendo agora?
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Escolha o ambiente para abrir um plantão com o fluxo e os agentes certos.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {AMBIENTES.map((amb) => (
          <article
            key={amb.id}
            data-testid={`hub-ambiente-${amb.id}`}
            className={`relative rounded-[1.75rem] border ${amb.accent.border} bg-slate-900/60 p-5 flex flex-col gap-4 transition-colors hover:bg-slate-900`}
          >
            <Link
              to="/ambiente/$ambienteId"
              params={{ ambienteId: amb.id }}
              search={{}}
              className="flex items-start gap-4 group focus-visible:outline-none"
            >
              <div
                className={`h-12 w-12 shrink-0 rounded-2xl ${amb.accent.bg} ${amb.accent.text} flex items-center justify-center`}
              >
                <amb.icon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true">{amb.emoji}</span>
                  <h3 className="text-sm font-black uppercase tracking-wide text-slate-100 leading-tight">
                    {amb.label}
                  </h3>
                </div>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">{amb.descricao}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-200 transition-colors mt-1" />
            </Link>

            <ul className="flex flex-wrap gap-2" aria-label={`Sub-áreas de ${amb.label}`}>
              {amb.subs.map((s) => (
                <li key={s.id}>
                  <Link
                    to="/ambiente/$ambienteId"
                    params={{ ambienteId: amb.id }}
                    search={{ sub: s.id }}
                    data-testid={`hub-sub-${s.id}`}
                    className={`inline-flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-950/50 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:text-slate-50 hover:border-slate-500 transition-colors focus-visible:outline-none focus-visible:ring-2 ${amb.accent.ring}`}
                  >
                    {s.icon ? <s.icon className="h-3 w-3" /> : null}
                    {s.label}
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
