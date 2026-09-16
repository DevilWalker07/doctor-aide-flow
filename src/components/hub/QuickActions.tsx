import { Link } from "@tanstack/react-router";
import { ArrowUpRight, FlaskConical, MessageSquareText, Pill } from "lucide-react";

/**
 * O que o médico consegue fazer sem abrir plantão.
 * A descrição diz QUANDO usar, não o que a tela é.
 */
const ACOES = [
  {
    to: "/prescricao-alta" as const,
    label: "Receituário de alta",
    descricao: "Receita ilustrada, com posologia em linguagem simples",
    icon: Pill,
    tom: "text-emerald-700 dark:text-emerald-300",
    fundo: "bg-emerald-500/10",
    testid: "hub-receituario",
  },
  {
    to: "/copiloto" as const,
    label: "Copiloto clínico",
    descricao: "Dose, diluição e conduta em segundos",
    icon: MessageSquareText,
    tom: "text-violet-700 dark:text-violet-300",
    fundo: "bg-violet-500/10",
    testid: "hub-copiloto",
  },
  {
    to: "/resumo-exames" as const,
    label: "Resumo de exames",
    descricao: "Cole o laudo e receba os valores organizados",
    icon: FlaskConical,
    tom: "text-sky-700 dark:text-sky-300",
    fundo: "bg-sky-500/10",
    testid: "hub-resumo-exames",
  },
];

export function QuickActions() {
  return (
    <section aria-labelledby="hub-acoes" className="space-y-3">
      <h2 id="hub-acoes" className="t-eyebrow text-muted-foreground">
        Sem precisar de plantão
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ACOES.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            search={{}}
            data-testid={a.testid}
            className="group border-border bg-card hover:border-ring/50 focus-visible:ring-ring flex min-h-[7rem] flex-col rounded-3xl border p-5 transition-colors hover:shadow-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={`h-11 w-11 rounded-2xl ${a.fundo} ${a.tom} flex items-center justify-center`}
              >
                <a.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <ArrowUpRight
                className="text-muted-foreground group-hover:text-foreground h-5 w-5 transition-colors"
                aria-hidden="true"
              />
            </div>
            <div className="mt-4">
              <p className="t-title text-foreground">{a.label}</p>
              <p className="t-body text-muted-foreground mt-1">{a.descricao}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
