import { useState, useMemo } from "react";
import { X, AlertTriangle, CheckCircle2, BookOpen, Loader2 } from "lucide-react";
import SpecialistAvatar from "./SpecialistAvatar";
import type { ConsultResponse, Specialist, SuggestionPriority } from "@/lib/specialists/types";

interface Props {
  open: boolean;
  onClose: () => void;
  specialist: Specialist;
  consult: ConsultResponse | null;
  isLoading?: boolean;
  onAcceptSuggestions?: (acceptedTexts: string[]) => void;
}

const PRIORITY_STYLES: Record<SuggestionPriority, { label: string; bg: string; text: string }> = {
  alta: { label: "ALTA", bg: "bg-red-100", text: "text-red-700" },
  media: { label: "MÉDIA", bg: "bg-amber-100", text: "text-amber-700" },
  baixa: { label: "BAIXA", bg: "bg-slate-100", text: "text-slate-600" },
};

export default function SpecialistDrawer({ open, onClose, specialist, consult, isLoading, onAcceptSuggestions }: Props) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const acceptedTexts = useMemo(() => {
    if (!consult) return [];
    return consult.suggestions.filter(s => selected[s.id]).map(s => s.text);
  }, [consult, selected]);

  if (!open) return null;

  const toggleAll = (val: boolean) => {
    if (!consult) return;
    const next: Record<string, boolean> = {};
    for (const s of consult.suggestions) next[s.id] = val;
    setSelected(next);
  };

  const handleAccept = () => {
    if (acceptedTexts.length === 0) return;
    onAcceptSuggestions?.(acceptedTexts);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <aside
        className="w-full max-w-xl bg-white border-l border-border shadow-2xl flex flex-col h-full"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Parecer de ${specialist.nome}`}
      >
        <header className={`px-6 py-5 border-b border-border ${specialist.cor.bg} ${specialist.cor.text} flex items-center gap-4`}>
          <SpecialistAvatar specialistId={specialist.id} size={56} className="rounded-full bg-white/20" />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-black uppercase tracking-widest">{specialist.nome} — Parecer Clínico</h2>
            <p className="text-[10px] font-bold opacity-90 uppercase tracking-widest">
              {specialist.titulo} · {consult ? `Gerado ${formatTime(consult.generated_at)}` : "Aguardando…"}
            </p>
          </div>
          <button onClick={onClose} className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors" aria-label="Fechar parecer">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {isLoading && (
            <div className="py-20 flex flex-col items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground text-center">
                {specialist.nome} está analisando o caso…
              </p>
              <p className="text-[10px] text-muted-foreground italic mt-2 text-center">Compilando contexto, diagnósticos, ATBs, exames e histórico.</p>
            </div>
          )}

          {!isLoading && consult && consult.sections.length === 0 && (
            <p className="text-xs italic text-muted-foreground text-center py-12">Sem análise estruturada retornada.</p>
          )}

          {!isLoading && consult?.sections.map((sec, i) => (
            <div key={i} className={`p-4 rounded-2xl border ${sec.alert ? "bg-amber-50 border-amber-200" : "bg-secondary/30 border-border"}`}>
              <h3 className={`text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2 ${sec.alert ? "text-amber-700" : "text-foreground"}`}>
                {sec.alert && <AlertTriangle className="h-3.5 w-3.5" />}
                {sec.title}
              </h3>
              <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{sec.content}</p>
            </div>
          ))}

          {!isLoading && consult && consult.suggestions.length > 0 && (
            <div className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground">Condutas sugeridas</h3>
                <div className="flex gap-2">
                  <button onClick={() => toggleAll(true)} className="text-[9px] font-black uppercase tracking-widest text-primary hover:underline">Marcar todas</button>
                  <button onClick={() => toggleAll(false)} className="text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:underline">Limpar</button>
                </div>
              </div>
              <div className="space-y-2">
                {consult.suggestions.map((s) => {
                  const prio = PRIORITY_STYLES[s.priority] || PRIORITY_STYLES.media;
                  return (
                    <label key={s.id} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-secondary/20 hover:bg-secondary/40 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={!!selected[s.id]}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [s.id]: e.target.checked }))}
                        className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer"
                        aria-label={`Selecionar sugestão: ${s.text}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground leading-relaxed">{s.text}</p>
                        <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${prio.bg} ${prio.text}`}>
                          {prio.label}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {!isLoading && consult && consult.references.length > 0 && (
            <div className="bg-secondary/30 border border-border rounded-2xl p-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5" /> Referências
              </h3>
              <ul className="text-[10px] font-bold text-muted-foreground space-y-1">
                {consult.references.map((r, i) => <li key={i}>· {r}</li>)}
              </ul>
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-border bg-white">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {acceptedTexts.length} de {consult?.suggestions.length || 0} selecionada(s)
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-border text-[10px] font-black uppercase tracking-widest hover:bg-secondary transition-all"
              >
                Fechar
              </button>
              <button
                onClick={handleAccept}
                disabled={acceptedTexts.length === 0}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Aceitar selecionadas
              </button>
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground italic mt-2 text-center">
            Parecer consultivo. Sempre revise antes de aplicar.
          </p>
        </footer>
      </aside>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
