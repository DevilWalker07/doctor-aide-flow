import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Clock, ExternalLink, History, RefreshCw, Users } from "lucide-react";
import type { Shift } from "@/lib/db";

export interface PlantaoAtivoCtx {
  id: string;
  data?: string;
  data_formatada?: string;
  hospital?: string | null;
  setor?: string | null;
  sector?: string | null;
  tipo?: string | null;
}

interface Props {
  plantaoAtivo: PlantaoAtivoCtx | null;
  stats: { pacientes: number; pendencias: number };
  closedShifts: Shift[];
  onViewHandoff: (shiftId: string) => void;
  onReopen: (shift: Shift) => void;
  formatDate: (iso: string) => string;
}

export function PlantaoPanel({ plantaoAtivo, stats, closedShifts, onViewHandoff, onReopen, formatDate }: Props) {
  const nav = useNavigate();
  if (!plantaoAtivo && closedShifts.length === 0) return null;

  return (
    <section aria-labelledby="hub-plantao" className="space-y-3">
      <h2 id="hub-plantao" className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
        Seus plantões
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
        {plantaoAtivo && (
          <div className="relative rounded-[1.75rem] border border-emerald-500/30 bg-emerald-500/5 p-5 sm:p-6" data-testid="hub-plantao-ativo">
            <span className="absolute top-5 right-5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400" />
            </span>
            <div className="flex items-center gap-2 text-emerald-300">
              <Clock className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Plantão em andamento</span>
            </div>
            <h3 className="mt-3 text-xl font-black uppercase leading-tight text-slate-100">{plantaoAtivo.setor || plantaoAtivo.sector || "Clínica Médica"}</h3>
            <p className="text-xs font-bold text-slate-400 uppercase">
              {plantaoAtivo.data_formatada || plantaoAtivo.data}
              {plantaoAtivo.hospital ? ` · ${plantaoAtivo.hospital}` : ""}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-5 text-xs font-black text-slate-200">
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" /> {stats.pacientes} pacientes
              </span>
              <span className="inline-flex items-center gap-2 text-amber-300">
                <AlertTriangle className="h-4 w-4" /> {stats.pendencias} pendências
              </span>
            </div>
            <button
              onClick={() => nav({ to: "/dashboard" })}
              data-testid="hub-continuar-plantao"
              className="mt-5 w-full py-3.5 rounded-2xl bg-emerald-400 text-slate-950 font-black uppercase tracking-widest text-[10px] hover:bg-emerald-300 transition-colors flex items-center justify-center gap-2"
            >
              Continuar plantão <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {closedShifts.length > 0 && (
          <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center gap-2 mb-3 text-slate-400">
              <History className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Plantões anteriores</span>
            </div>
            <ul className="space-y-2">
              {closedShifts.map((s) => (
                <li key={s.id} className="rounded-2xl bg-slate-950/50 border border-slate-800 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-100 uppercase truncate">{s.sector || "Setor"}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">
                      {formatDate(s.date)} · {s.hospital}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => onViewHandoff(s.id)} className="px-3 py-2 rounded-lg border border-slate-700 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:bg-slate-800 flex items-center gap-1.5">
                      <ExternalLink className="h-3 w-3" /> Passagem
                    </button>
                    <button onClick={() => onReopen(s)} className="px-3 py-2 rounded-lg border border-primary/40 text-primary text-[10px] font-black uppercase tracking-wider hover:bg-primary/10 flex items-center gap-1.5">
                      <RefreshCw className="h-3 w-3" /> Reabrir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
