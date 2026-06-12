import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, X, Sparkles, ChevronRight, ListPlus, FileText, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  evaluateProtocols,
  buildContextFromPatient,
  getProtocol,
} from "@/lib/clinical-protocols/engine";
import { SEVERITY_STYLES } from "@/lib/clinical-protocols/types";
import type { ClinicalFinding, PrescriptionItem } from "@/lib/clinical-protocols/types";

interface Props {
  patient: any;
  /** Chamado quando o médico aceita adicionar achado à lista de problemas. */
  onAddProblem?: (problemEntry: string) => Promise<void> | void;
  /** Chamado quando o médico clica em "Inserir na prescrição". */
  onApplyPrescription?: (items: PrescriptionItem[]) => Promise<void> | void;
}

const DISMISS_KEY_PREFIX = "da_watchdog_dismissed_";

function getDismissedIds(patientId: string): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY_PREFIX + patientId);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function persistDismissed(patientId: string, set: Set<string>) {
  try {
    localStorage.setItem(DISMISS_KEY_PREFIX + patientId, JSON.stringify([...set]));
  } catch { /* quota */ }
}

export default function ClinicalWatchdog({ patient, onAddProblem, onApplyPrescription }: Props) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const nav = useNavigate();

  const ctx = useMemo(() => buildContextFromPatient(patient), [patient]);

  // Achados — recalculados sempre que o paciente muda. Filtramos os
  // dispensados pelo médico (localStorage por paciente).
  const allFindings = useMemo(() => evaluateProtocols(ctx), [ctx]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (patient?.id) setDismissed(getDismissedIds(patient.id));
  }, [patient?.id]);

  const findings = useMemo(
    () => allFindings.filter((f) => !dismissed.has(f.protocol_id)),
    [allFindings, dismissed],
  );

  // Auto-ordenação por severidade
  const sorted = [...findings].sort(
    (a, b) => SEVERITY_STYLES[a.severity].order - SEVERITY_STYLES[b.severity].order,
  );

  // Se houver achados críticos ao montar, abre o drawer
  useEffect(() => {
    if (sorted.some((f) => f.severity === "critico") && !open) {
      // Não força — só sinaliza pelo badge pulsante
    }
  }, [sorted.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissFinding = (findingId: string, protocolId: string) => {
    const next = new Set(dismissed);
    next.add(protocolId);
    setDismissed(next);
    if (patient?.id) persistDismissed(patient.id, next);
    toast.info("Achado dispensado. Novo lab vai reavaliar.");
  };

  const addToProblemList = async (f: ClinicalFinding) => {
    if (busy) return;
    setBusy(f.id);
    try {
      if (onAddProblem) {
        await onAddProblem(f.problem_entry);
        toast.success("Adicionado à lista de problemas.");
      } else {
        // Fallback: copia pra clipboard
        await navigator.clipboard.writeText(f.problem_entry);
        toast.success("Copiado pra colar na lista de problemas.");
      }
    } catch (e: any) {
      toast.error("Falhou: " + (e?.message || "?"));
    } finally {
      setBusy(null);
    }
  };

  const applyPrescription = async (f: ClinicalFinding) => {
    if (busy) return;
    const p = getProtocol(f.protocol_id);
    if (!p) return;
    setBusy(f.id);
    try {
      const items = p.prescription(ctx);
      if (onApplyPrescription) {
        await onApplyPrescription(items);
        toast.success("Itens enviados pra prescrição.");
      } else {
        // Fallback: navega pra /prescricao com search param "vigia_items"
        const encoded = encodeURIComponent(JSON.stringify(items));
        nav({
          to: "/prescricao/$id",
          params: { id: patient.id },
          search: { vigia_items: encoded } as any,
        });
      }
    } catch (e: any) {
      toast.error("Falhou: " + (e?.message || "?"));
    } finally {
      setBusy(null);
    }
  };

  const critCount = sorted.filter((f) => f.severity === "critico").length;
  const hasFindings = sorted.length > 0;

  if (!hasFindings && !open) {
    // Sem achados → não mostra nada (silencioso)
    return null;
  }

  return (
    <>
      {/* FAB / Trigger button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={`fixed right-4 top-32 md:top-40 z-30 inline-flex items-center gap-2 px-4 h-11 rounded-full shadow-lg transition-all border ${
            critCount > 0
              ? "bg-red-500 text-white border-red-600 animate-pulse"
              : "bg-elevated text-foreground border-border hover:border-primary"
          }`}
          aria-label="Abrir vigia clínico"
        >
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-semibold tabular-nums">{sorted.length}</span>
          <span className="hidden sm:inline text-[12px] font-medium">achado{sorted.length > 1 ? "s" : ""}</span>
        </button>
      )}

      {/* Drawer */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm flex justify-end"
          onClick={() => setOpen(false)}
        >
          <aside
            className="w-full max-w-md bg-background h-full border-l border-border shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
            aria-label="Vigia clínico"
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-border bg-elevated">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Vigia Clínico</h2>
                  <p className="text-[11px] text-muted-foreground">{sorted.length} achado{sorted.length > 1 ? "s" : ""}</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-9 w-9 rounded-md hover:bg-subtle flex items-center justify-center text-muted-foreground"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
              {sorted.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Check className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-[13px]">Nenhum achado clínico no momento.</p>
                  <p className="text-[11px] mt-1 opacity-80">Quadro será reavaliado a cada novo lab/atualização.</p>
                </div>
              )}

              {sorted.map((f) => (
                <FindingCard
                  key={f.id}
                  finding={f}
                  expanded={expanded === f.id}
                  busy={busy === f.id}
                  onToggle={() => setExpanded((cur) => (cur === f.id ? null : f.id))}
                  onAddProblem={() => addToProblemList(f)}
                  onApplyPrescription={() => applyPrescription(f)}
                  onDismiss={() => dismissFinding(f.id, f.protocol_id)}
                  patientCtx={ctx}
                />
              ))}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function FindingCard({
  finding,
  expanded,
  busy,
  onToggle,
  onAddProblem,
  onApplyPrescription,
  onDismiss,
  patientCtx,
}: {
  finding: ClinicalFinding;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onAddProblem: () => void;
  onApplyPrescription: () => void;
  onDismiss: () => void;
  patientCtx: any;
}) {
  const protocol = getProtocol(finding.protocol_id);
  const style = SEVERITY_STYLES[finding.severity];

  if (!protocol) return null;

  const prescriptionItems = expanded ? protocol.prescription(patientCtx) : [];

  return (
    <article className={`rounded-xl border ${style.border} ${style.bg} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-foreground/5 transition-colors"
      >
        <div className="shrink-0 mt-0.5">
          <AlertTriangle className={`h-4 w-4 ${style.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${style.text}`}>{style.label}</span>
            <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
          </div>
          <h3 className={`text-sm font-semibold ${style.text}`}>{finding.title}</h3>
          <p className="text-[12px] text-foreground/80 mt-0.5">{finding.evidence}</p>
          {!expanded && (
            <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">{protocol.summary}</p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-foreground/10 pt-3">
          {/* Resumo */}
          <p className="text-[12px] text-foreground/80 leading-relaxed">{protocol.summary}</p>

          {/* Warnings */}
          <div className="space-y-1.5">
            {protocol.warnings.map((w, i) => (
              <div key={i} className={`flex items-start gap-2 p-2 rounded-md ${style.bg} ${style.border} border`}>
                <AlertTriangle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${style.text}`} />
                <p className={`text-[11px] font-medium ${style.text} leading-relaxed`}>{w}</p>
              </div>
            ))}
          </div>

          {/* Prescrição calculada */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Conduta sugerida</p>
            <ul className="space-y-1.5 bg-elevated rounded-md border border-border p-3">
              {prescriptionItems.map((item, i) => (
                <li key={i} className="text-[12px] leading-relaxed">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-2">{item.section}:</span>
                  {item.text}
                </li>
              ))}
            </ul>
          </div>

          {/* Protocol text completo */}
          <details className="group">
            <summary className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer select-none flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Ver protocolo completo
            </summary>
            <pre className="mt-2 text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap font-sans bg-subtle p-3 rounded-md max-h-64 overflow-y-auto">
{protocol.protocol_text}
            </pre>
          </details>

          {/* Ações */}
          <div className="flex flex-col gap-2 pt-2 border-t border-foreground/10">
            <button
              onClick={onAddProblem}
              disabled={busy}
              className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-medium inline-flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ListPlus className="h-3.5 w-3.5" />}
              Adicionar à lista de problemas
            </button>
            <button
              onClick={onApplyPrescription}
              disabled={busy}
              className="h-9 px-3 rounded-md border border-border bg-elevated text-[12px] font-medium inline-flex items-center justify-center gap-1.5 hover:bg-subtle disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              Inserir na prescrição
            </button>
            <button
              onClick={onDismiss}
              disabled={busy}
              className="h-8 px-3 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-subtle inline-flex items-center justify-center gap-1"
            >
              <X className="h-3 w-3" />
              Dispensar
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
