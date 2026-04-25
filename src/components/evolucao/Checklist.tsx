import { Check, Circle, AlertTriangle, AlertOctagon } from "lucide-react";

export type ChecklistStatus = "done" | "pending" | "warn" | "crit";

export type ChecklistItem = { id: string; label: string; status: ChecklistStatus };

export function Checklist({ items }: { items: ChecklistItem[] }) {
  return (
    <div className="bg-navy text-navy-foreground rounded-2xl p-5 sticky top-24">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest">CHECKLIST DE EVOLUÇÃO</h3>
        <span className="text-[10px] uppercase tracking-wider opacity-60">
          {items.filter(i => i.status === "done").length}/{items.length}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-white/5 transition-colors">
            <StatusIcon s={it.status} />
            <span className={`text-xs uppercase tracking-wide ${it.status === "done" ? "text-white" : "text-white/60"}`}>
              {it.label}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-5 pt-5 border-t border-white/10">
        <p className="text-[10px] uppercase tracking-wider opacity-60 mb-2">DICA DO DOUTOR AJUDA</p>
        <p className="text-xs leading-relaxed text-white/80">
          Quanto mais campos você preencher, melhor será a análise comparativa e a evolução padrão-ouro.
        </p>
      </div>
    </div>
  );
}

function StatusIcon({ s }: { s: ChecklistStatus }) {
  if (s === "done") return <div className="h-5 w-5 rounded-full bg-primary grid place-items-center shrink-0"><Check className="h-3 w-3"/></div>;
  if (s === "warn") return <div className="h-5 w-5 rounded-full bg-warning grid place-items-center shrink-0"><AlertTriangle className="h-3 w-3 text-warning-foreground"/></div>;
  if (s === "crit") return <div className="h-5 w-5 rounded-full bg-destructive grid place-items-center shrink-0"><AlertOctagon className="h-3 w-3"/></div>;
  return <Circle className="h-5 w-5 text-white/30 shrink-0" />;
}