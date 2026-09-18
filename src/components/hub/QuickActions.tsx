import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  ClipboardList,
  FlaskConical,
  MessageSquareText,
  Stethoscope,
} from "lucide-react";
import { FileStack } from "lucide-react";

/**
 * As ações da tela inicial. Nenhuma exige conta: o médico abre o app e
 * resolve. A descrição diz QUANDO usar, não o que a tela é.
 *
 * A passagem de plantão não tinha porta de entrada nenhuma aqui — só existia
 * digitando /passagem-plantao na barra do navegador. Era a ferramenta mais
 * usada sem atalho na primeira tela.
 */
const ACOES = [
  {
    to: "/documentos" as const,
    label: "Documentos",
    descricao: "Receita, atestado, encaminhamento e orientações",
    icon: FileStack,
    tom: "text-emerald-700 dark:text-emerald-300",
    fundo: "bg-emerald-500/10",
    testid: "hub-documentos",
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
    descricao: "Cole o laudo de laboratório ou de imagem",
    icon: FlaskConical,
    tom: "text-sky-700 dark:text-sky-300",
    fundo: "bg-sky-500/10",
    testid: "hub-resumo-exames",
  },
  {
    to: "/passagem-plantao" as const,
    label: "Passagem de plantão",
    descricao: "Suba as evoluções e saia com o mapa em DOCX",
    icon: ClipboardList,
    tom: "text-amber-700 dark:text-amber-300",
    fundo: "bg-amber-500/10",
    testid: "hub-passagem-plantao",
  },
];

export function QuickActions() {
  return (
    <section aria-labelledby="hub-acoes" className="space-y-3">
      <h2 id="hub-acoes" className="t-eyebrow text-muted-foreground">
        Ações rápidas
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {ACOES.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            search={{}}
            data-testid={a.testid}
            className="group border-border bg-card hover:border-ring/50 focus-visible:ring-ring flex min-h-[6.5rem] flex-col rounded-3xl border p-4 transition-colors hover:shadow-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={`h-10 w-10 rounded-xl ${a.fundo} ${a.tom} flex items-center justify-center`}
              >
                <a.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <ArrowUpRight
                className="text-muted-foreground group-hover:text-foreground h-5 w-5 transition-colors"
                aria-hidden="true"
              />
            </div>
            <div className="mt-3">
              <p className="t-title text-foreground">{a.label}</p>
              <p className="t-body text-muted-foreground mt-1">{a.descricao}</p>
            </div>
          </Link>
        ))}

        {/* A quarta ação leva à lista de locais, logo abaixo na mesma tela —
            não faz sentido navegar para escolher onde se está. */}
        <a
          href="#locais"
          data-testid="hub-plantao-acao"
          className="group border-border bg-card hover:border-ring/50 focus-visible:ring-ring flex min-h-[6.5rem] flex-col rounded-3xl border p-4 transition-colors hover:shadow-sm focus-visible:ring-2 focus-visible:outline-none"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl">
              <Stethoscope className="h-5 w-5" aria-hidden="true" />
            </div>
            <ArrowUpRight
              className="text-muted-foreground group-hover:text-foreground h-5 w-5 transition-colors"
              aria-hidden="true"
            />
          </div>
          <div className="mt-3">
            <p className="t-title text-foreground">Plantão</p>
            <p className="t-body text-muted-foreground mt-1">
              Abrir um plantão no seu local de atendimento
            </p>
          </div>
        </a>
      </div>
    </section>
  );
}
