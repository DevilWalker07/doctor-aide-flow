import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft,
  ClipboardList,
  FileSignature,
  FileText,
  Pill,
  UserCheck,
  UserX,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { PacienteVinculado } from "@/lib/documentos/usePacienteVinculado";

const TABS = [
  { to: "/prescricao-alta", label: "Receita", icon: Pill, testid: "tab-receita" },
  { to: "/atestado", label: "Atestado", icon: FileSignature, testid: "tab-atestado" },
  { to: "/encaminhamento", label: "Encaminhamento", icon: FileText, testid: "tab-encaminhamento" },
  {
    to: "/orientacoes-paciente",
    label: "Orientações",
    icon: ClipboardList,
    testid: "tab-orientacoes",
  },
] as const;

interface Props {
  titulo: string;
  subtitulo: string;
  pacienteId?: string;
  paciente: PacienteVinculado | null;
  loadingPaciente: boolean;
  actions: ReactNode;
  editor: ReactNode;
  preview: ReactNode;
}

export function DocumentosLayout({
  titulo,
  subtitulo,
  pacienteId,
  paciente,
  loadingPaciente,
  actions,
  editor,
  preview,
}: Props) {
  const nav = useNavigate();
  const search = pacienteId ? { paciente: pacienteId } : {};

  return (
    <div className="bg-background min-h-screen pb-24 print:bg-white print:pb-0">
      <header className="no-print bg-card border-border sticky top-0 z-30 border-b">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                pacienteId
                  ? nav({ to: "/paciente/$id", params: { id: pacienteId } })
                  : nav({ to: "/documentos", search: {} })
              }
              className="touch-target border-border text-muted-foreground hover:bg-secondary focus-visible:ring-ring inline-flex shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none"
              aria-label="Voltar"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="t-title text-foreground truncate">{titulo}</h1>
              <p className="t-label text-muted-foreground truncate font-normal">{subtitulo}</p>
            </div>
          </div>

          {/* As ações ficam em faixa própria: apertadas no cabeçalho, "Copiar
              texto limpo" quebrava em três linhas no celular. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>

          <nav
            className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
            aria-label="Tipo de documento"
          >
            {TABS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                search={search}
                data-testid={t.testid}
                className="t-label border-border bg-background text-muted-foreground hover:border-primary/40 focus-visible:ring-ring inline-flex min-h-[2.75rem] shrink-0 items-center gap-2 rounded-xl border px-3.5 whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none"
                activeProps={{
                  className:
                    "t-label border-primary bg-primary text-primary-foreground focus-visible:ring-ring inline-flex min-h-[2.75rem] shrink-0 items-center gap-2 rounded-xl border px-3.5 whitespace-nowrap focus-visible:ring-2 focus-visible:outline-none",
                }}
              >
                <t.icon className="h-4 w-4" aria-hidden="true" /> {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="no-print mx-auto max-w-7xl px-4 pt-5 sm:px-6">
        <div
          className={cn(
            "t-body flex items-center gap-3 rounded-2xl border px-4 py-3",
            paciente
              ? "bg-success/5 border-success/30 text-success"
              : "bg-secondary border-border text-muted-foreground",
          )}
          data-testid="doc-modo"
        >
          {paciente ? (
            <UserCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
          ) : (
            <UserX className="h-5 w-5 shrink-0" aria-hidden="true" />
          )}
          {loadingPaciente
            ? "Carregando paciente…"
            : paciente
              ? `Vinculado a ${paciente.nome || "paciente"}${paciente.leito ? ` — leito ${paciente.leito}` : ""}`
              : "Atendimento avulso — preencha os dados do paciente abaixo"}
        </div>
      </div>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_230mm] print:block print:max-w-none print:p-0">
        <div className="no-print min-w-0 space-y-5">{editor}</div>
        <div className="min-w-0 print:w-auto">
          <p className="no-print t-eyebrow text-muted-foreground mb-3">Como vai ficar impresso</p>
          <div className="a4-preview">{preview}</div>
        </div>
      </main>
    </div>
  );
}
