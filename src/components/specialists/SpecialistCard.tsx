import { Sparkles, Loader2 } from "lucide-react";
import SpecialistAvatar from "./SpecialistAvatar";
import type { Specialist } from "@/lib/specialists/types";

interface Props {
  specialist: Specialist;
  isLoading?: boolean;
  hasConsult?: boolean;
  onConsult: () => void;
  variant?: "card" | "inline"; // card = página do paciente; inline = barra de ação
}

export default function SpecialistCard({ specialist, isLoading, hasConsult, onConsult, variant = "card" }: Props) {
  if (variant === "inline") {
    return (
      <button
        onClick={onConsult}
        disabled={isLoading}
        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 ${specialist.cor.bg} ${specialist.cor.text} hover:-translate-y-0.5`}
      >
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {isLoading ? `${specialist.nome} analisando…` : `Parecer do(a) ${specialist.nome}`}
      </button>
    );
  }

  return (
    <div className="bg-white border border-border rounded-[2rem] p-5 shadow-sm flex items-center gap-4">
      <div className={`rounded-2xl ${specialist.cor.bg}/10 p-1`}>
        <SpecialistAvatar specialistId={specialist.id} size={64} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-black uppercase tracking-tight">{specialist.nome}</h3>
          {hasConsult && (
            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600">
              PARECER DISPONÍVEL
            </span>
          )}
        </div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{specialist.titulo} · {specialist.especialidade}</p>
        <p className="text-xs text-muted-foreground italic mt-1.5">"{specialist.saudacao}"</p>
      </div>
      <button
        onClick={onConsult}
        disabled={isLoading}
        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 ${specialist.cor.bg} ${specialist.cor.text} hover:-translate-y-0.5 shrink-0`}
      >
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {isLoading ? "Analisando…" : "Solicitar Parecer"}
      </button>
    </div>
  );
}
