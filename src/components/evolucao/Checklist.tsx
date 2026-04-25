import { Check, Circle, AlertTriangle, AlertOctagon, Info } from "lucide-react";

export type ChecklistStatus = "done" | "pending" | "warn" | "crit";

export type ChecklistItem = { id: string; label: string; status: ChecklistStatus };

export function Checklist({ items, onNavigate }: { items: ChecklistItem[]; onNavigate?: (id: string) => void }) {
  const doneCount = items.filter((i) => i.status === "done").length;
  const progress = (doneCount / items.length) * 100;

  return (
    <div className="bg-navy text-navy-foreground rounded-[2rem] p-6 sticky top-24 shadow-2xl shadow-navy/20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-white/90">CHECKLIST</h3>
          <span className="text-[10px] uppercase font-bold tracking-widest bg-white/10 px-2 py-1 rounded-md text-white/90">
            {doneCount}/{items.length}
          </span>
        </div>

        <div className="h-1.5 w-full bg-white/10 rounded-full mb-6 overflow-hidden">
          <div className="h-full bg-primary transition-all duration-1000 ease-out rounded-full" style={{ width: `${progress}%` }} />
        </div>

        <ul className="space-y-1">
          {items.map((it) => (
            <li
              key={it.id}
              onClick={() => onNavigate?.(it.id)}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            >
              <StatusIcon s={it.status} />
              <span className={`text-xs font-bold uppercase tracking-widest transition-colors ${it.status === "done" ? "text-white" : "text-white/50 group-hover:text-white/80"}`}>
                {it.label}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-8 pt-6 border-t border-white/10 flex gap-3">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1.5">DICA DO DOUTOR AJUDA</p>
            <p className="text-xs font-medium leading-relaxed text-white/70">
              Quanto mais campos você preencher, melhor será a análise comparativa e a evolução padrão-ouro.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ s }: { s: ChecklistStatus }) {
  if (s === "done") return <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/30"><Check className="h-3 w-3 text-white"/></div>;
  if (s === "warn") return <div className="h-5 w-5 rounded-full bg-warning flex items-center justify-center shrink-0 shadow-lg shadow-warning/30"><AlertTriangle className="h-3 w-3 text-warning-foreground"/></div>;
  if (s === "crit") return <div className="h-5 w-5 rounded-full bg-destructive flex items-center justify-center shrink-0 shadow-lg shadow-destructive/30"><AlertOctagon className="h-3 w-3 text-white"/></div>;
  return <Circle className="h-5 w-5 text-white/20 shrink-0" />;
}