import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSignature,
  FileText,
  FlaskConical,
  Info,
  Pill,
  Receipt,
  Send,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/documentos")({
  validateSearch: z.object({ paciente: z.string().optional() }),
  component: DocumentosIndexPage,
  head: () => ({ meta: [{ title: "Documentos — MEDFLUXO" }] }),
});

interface TipoDocumento {
  label: string;
  descricao: string;
  icon: LucideIcon;
  /** Rota quando pronto; ausente significa "Em breve". */
  to?: "/prescricao-alta" | "/atestado" | "/encaminhamento" | "/orientacoes-paciente";
  testid: string;
}

const TIPOS: TipoDocumento[] = [
  {
    label: "Receituário",
    descricao: "Receita ilustrada, com posologia em linguagem simples",
    icon: Pill,
    to: "/prescricao-alta",
    testid: "doc-receita",
  },
  {
    label: "Atestado médico",
    descricao: "Afastamento, comparecimento ou acompanhante",
    icon: FileSignature,
    to: "/atestado",
    testid: "doc-atestado",
  },
  {
    label: "Encaminhamento",
    descricao: "Carta de referência para a especialidade",
    icon: Send,
    to: "/encaminhamento",
    testid: "doc-encaminhamento",
  },
  {
    label: "Orientações ao paciente",
    descricao: "Instruções ilustradas para levar para casa",
    icon: ClipboardList,
    to: "/orientacoes-paciente",
    testid: "doc-orientacoes",
  },
  {
    label: "Solicitação de exames",
    descricao: "Pedido de laboratório e imagem",
    icon: FlaskConical,
    testid: "doc-exames",
  },
  {
    label: "Laudo médico",
    descricao: "Relatório para perícia, escola ou convênio",
    icon: FileText,
    testid: "doc-laudo",
  },
  {
    label: "APAC — chequinho do SUS",
    descricao: "Autorização de procedimento de alta complexidade",
    icon: Receipt,
    testid: "doc-apac",
  },
  {
    label: "LME — alto custo",
    descricao: "Laudo para medicamento do componente especializado",
    icon: Stethoscope,
    testid: "doc-lme",
  },
];

function DocumentosIndexPage() {
  const { paciente } = Route.useSearch();
  const { configured, session } = useAuth();
  const semConta = configured && !session;
  const search = paciente ? { paciente } : {};

  return (
    <div className="bg-background min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center gap-3 px-4 pt-5 sm:px-6">
        <Link
          to={paciente ? "/paciente/$id" : "/"}
          params={paciente ? { id: paciente } : undefined}
          aria-label="Voltar"
          className="touch-target border-border bg-card text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl border transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <span className="t-eyebrow text-muted-foreground">Documentos</span>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <h1 className="t-display text-foreground">O que você precisa emitir?</h1>
        <p className="t-body text-muted-foreground mt-2">
          {paciente
            ? "Os dados do paciente já vêm preenchidos."
            : "Dá para emitir sem plantão aberto e sem cadastrar o paciente."}
        </p>

        {semConta && (
          <div
            className="border-border bg-secondary mt-4 flex items-start gap-3 rounded-2xl border p-4"
            data-testid="doc-aviso-local"
          >
            <Info className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="t-body text-foreground">
              Sem conta, o documento fica salvo só neste aparelho. Entre para guardá-lo no seu
              histórico.
            </p>
          </div>
        )}

        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TIPOS.map((t) => {
            const conteudo = (
              <>
                <div className="bg-secondary text-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                  <t.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="t-title text-foreground">{t.label}</span>
                    {/* O selo aparece ANTES do toque, como no resto do app. */}
                    {!t.to && (
                      <span className="t-eyebrow bg-muted text-muted-foreground rounded-full px-2 py-1">
                        Em breve
                      </span>
                    )}
                  </div>
                  <p className="t-body text-muted-foreground">{t.descricao}</p>
                </div>
                {t.to && (
                  <ChevronRight
                    className="text-muted-foreground h-5 w-5 shrink-0"
                    aria-hidden="true"
                  />
                )}
              </>
            );

            const classe =
              "border-border bg-card flex h-full items-center gap-3 rounded-2xl border p-4 transition-colors";

            return (
              <li key={t.testid}>
                {t.to ? (
                  <Link
                    to={t.to}
                    search={search}
                    data-testid={t.testid}
                    className={`${classe} hover:bg-secondary focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none`}
                  >
                    {conteudo}
                  </Link>
                ) : (
                  // Não é link nem botão: não há para onde ir, e um controle
                  // focável que não faz nada é pior que um item inerte.
                  <div data-testid={t.testid} className={`${classe} opacity-60`}>
                    {conteudo}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
