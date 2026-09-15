import { Link } from "@tanstack/react-router";
import { ArrowUpRight, FlaskConical, MessageSquareText, Pill } from "lucide-react";

const ACTIONS = [
  {
    to: "/prescricao-alta" as const,
    label: "Receituário de Alta",
    descricao: "Receita ilustrada, encaminhamento e orientações — sem plantão ativo.",
    icon: Pill,
    accent: "from-emerald-500/20 to-emerald-500/0 text-emerald-300 border-emerald-500/30",
    testid: "hub-receituario",
  },
  {
    to: "/copiloto" as const,
    label: "Copiloto Clínico",
    descricao: "Chat com os agentes de IA para dúvidas rápidas à beira-leito.",
    icon: MessageSquareText,
    accent: "from-violet-500/20 to-violet-500/0 text-violet-300 border-violet-500/30",
    testid: "hub-copiloto",
  },
  {
    to: "/resumo-exames" as const,
    label: "Resumo de Exames",
    descricao: "Cole o laudo e receba os valores organizados com alertas.",
    icon: FlaskConical,
    accent: "from-sky-500/20 to-sky-500/0 text-sky-300 border-sky-500/30",
    testid: "hub-resumo-exames",
  },
];

export function QuickActions() {
  return (
    <section aria-labelledby="hub-acoes" className="space-y-3">
      <h2 id="hub-acoes" className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
        Ações rápidas · sem selecionar plantão
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ACTIONS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            search={{}}
            data-testid={a.testid}
            className={`group relative overflow-hidden rounded-3xl border bg-gradient-to-br ${a.accent} bg-slate-900/70 p-5 transition-all hover:-translate-y-0.5 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="h-11 w-11 rounded-2xl bg-slate-950/60 border border-white/5 flex items-center justify-center">
                <a.icon className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-slate-200 transition-colors" />
            </div>
            <div className="mt-4">
              <div className="text-sm font-black uppercase tracking-wide text-slate-100">{a.label}</div>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">{a.descricao}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
