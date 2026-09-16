import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ClipboardList, FileText, Pill, UserCheck, UserX } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { PacienteVinculado } from "@/lib/documentos/usePacienteVinculado";

const TABS = [
  { to: "/prescricao-alta", label: "RECEITA", icon: Pill, testid: "tab-receita" },
  { to: "/encaminhamento", label: "ENCAMINHAMENTO", icon: FileText, testid: "tab-encaminhamento" },
  { to: "/orientacoes-paciente", label: "ORIENTAÇÕES", icon: ClipboardList, testid: "tab-orientacoes" },
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

export function DocumentosLayout({ titulo, subtitulo, pacienteId, paciente, loadingPaciente, actions, editor, preview }: Props) {
  const nav = useNavigate();
  const search = pacienteId ? { paciente: pacienteId } : {};

  return (
    <div className="min-h-screen bg-background pb-32 print:bg-white print:pb-0">
      <header className="no-print bg-white border-b border-border sticky top-0 z-30 shadow-sm overflow-hidden">
        <div className="absolute top-0 left-0 w-1 bg-primary h-full" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => (pacienteId ? nav({ to: "/paciente/$id", params: { id: pacienteId } }) : nav({ to: "/dashboard" }))}
              className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary transition-all"
              aria-label="Voltar"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-black text-foreground tracking-tight uppercase">{titulo}</h1>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{subtitulo}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">{actions}</div>
        </div>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 flex gap-2 overflow-x-auto" aria-label="Tipo de documento">
          {TABS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              search={search}
              data-testid={t.testid}
              className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 whitespace-nowrap bg-white text-muted-foreground border-border hover:border-primary/40"
              activeProps={{ className: "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 whitespace-nowrap bg-primary text-white border-primary shadow-lg shadow-primary/20" }}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="no-print max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <div
          className={cn(
            "flex items-center gap-3 px-5 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest",
            paciente ? "bg-success/5 border-success/30 text-success" : "bg-secondary border-border text-muted-foreground",
          )}
          data-testid="doc-modo"
        >
          {paciente ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
          {loadingPaciente
            ? "CARREGANDO PACIENTE..."
            : paciente
              ? `VINCULADO A: ${paciente.nome || "PACIENTE"}${paciente.leito ? ` — LEITO ${paciente.leito}` : ""}`
              : "MODO AVULSO — ATENDIMENTO FORA DO SISTEMA (PREENCHA OS DADOS DO PACIENTE)"}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_230mm] gap-8 print:block print:p-0 print:max-w-none">
        <div className="no-print space-y-8 min-w-0">{editor}</div>
        <div className="min-w-0 print:w-auto">
          <div className="no-print text-[10px] font-black tracking-[0.2em] uppercase text-muted-foreground mb-3">Pré-visualização (A4)</div>
          <div className="overflow-x-auto print:overflow-visible">{preview}</div>
        </div>
      </main>
    </div>
  );
}
