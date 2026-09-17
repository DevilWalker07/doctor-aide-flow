import { ChevronDown, Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ControlledInput, ControlledTextarea } from "@/components/ui/controlled-input";
import type { ReceitaItem } from "@/lib/documentos/types";
import { getMedicamento, HORARIOS, type Acao, type Horario } from "@/lib/medical/medicamentos";
import { cn } from "@/lib/utils";
import { acaoLabel } from "./AcaoIcon";
import { FarmaciaPopularBadge } from "./FarmaciaPopularBadge";

const ACOES: Acao[] = ["comprimido", "gotas", "injecao", "inalacao", "topico", "oftalmico"];

interface Props {
  item: ReceitaItem;
  index: number;
  onChange: (next: ReceitaItem) => void;
  onRemove: () => void;
}

export function MedicamentoCard({ item, index, onChange, onRemove }: Props) {
  const med = item.medicamentoId ? getMedicamento(item.medicamentoId) : undefined;
  const [expandido, setExpandido] = useState(false);
  const set = (patch: Partial<ReceitaItem>) => onChange({ ...item, ...patch });

  const setHorario = (h: Horario, delta: number) => {
    const atual = item.horarios[h] ?? 0;
    const next = Math.max(0, Math.min(10, atual + delta));
    const horarios = { ...item.horarios };
    if (next === 0) delete horarios[h];
    else horarios[h] = next;
    set({ horarios });
  };

  const aplicarPreset = (presetId: string) => {
    const preset = med?.presets.find((p) => p.id === presetId);
    if (!preset) return;
    set({
      dose: preset.dose,
      quantidade: preset.quantidade,
      horarios: { ...preset.horarios },
      instrucao: preset.instrucao,
      duracao: preset.duracao ?? "",
      observacao: preset.observacao ?? "",
    });
  };

  const horariosResumo = HORARIOS.filter((h) => (item.horarios[h.id] ?? 0) > 0)
    .map((h) => `${h.curto[0]}${h.curto.slice(1).toLowerCase()} ${item.horarios[h.id]}x`)
    .join(" · ");

  return (
    <article className="rounded-2xl border border-border bg-card" data-testid={`doc-item-${index}`}>
      {/* Linha principal — nome + dose ------ quantidade, no espírito do receituário simples */}
      <div className="flex items-start gap-3 p-4">
        <span className="t-label text-muted-foreground shrink-0 pt-2.5">{index + 1})</span>

        <div className="min-w-0 flex-1 space-y-2">
          <ControlledInput
            value={item.nome}
            onValueChange={(v) => set({ nome: v })}
            placeholder="Nome do medicamento"
            className="min-h-0 w-full rounded-lg border-0 bg-transparent px-1 py-1 text-base font-bold focus:bg-secondary/40"
          />
          <ControlledInput
            value={item.quantidade}
            onValueChange={(v) => set({ quantidade: v })}
            placeholder="Quantidade (ex.: 30 comprimidos)"
            className="min-h-0 w-full rounded-lg border-0 bg-transparent px-1 py-1 text-sm font-semibold focus:bg-secondary/40"
          />
          {(item.farmaciaPopular || item.controlado) && (
            <div className="px-1">
              <FarmaciaPopularBadge
                farmaciaPopular={item.farmaciaPopular}
                controlado={item.controlado}
                compact
              />
            </div>
          )}

          <ControlledTextarea
            value={item.instrucao}
            onValueChange={(v) => set({ instrucao: v })}
            placeholder="Instrução em linguagem simples (ex.: Tomar 1 comprimido pela manhã, todos os dias.)"
            rows={2}
            className="min-h-0 rounded-lg border-0 bg-transparent px-1 py-1 text-sm leading-relaxed focus:bg-secondary/40"
          />

          {!expandido && (horariosResumo || item.duracao) && (
            <p className="t-label text-muted-foreground px-1">
              {[horariosResumo, item.duracao].filter(Boolean).join(" · ")}
            </p>
          )}

          {med && med.presets.length > 1 && (
            <div className="flex flex-wrap gap-1.5 px-1">
              {med.presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => aplicarPreset(p.id)}
                  className="text-muted-foreground hover:border-primary/40 hover:text-primary rounded-md border border-border px-2 py-1 text-xs font-medium"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            aria-expanded={expandido}
            aria-label={expandido ? "Ocultar detalhes" : "Mostrar detalhes"}
            className="touch-target text-muted-foreground hover:bg-secondary inline-flex items-center justify-center rounded-full"
          >
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", expandido && "rotate-180")}
            />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remover ${item.nome || "item"}`}
            className="touch-target text-muted-foreground hover:bg-destructive/10 hover:text-destructive inline-flex items-center justify-center rounded-full"
            data-testid={`doc-item-remove-${index}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expandido && (
        <div className="border-border space-y-4 border-t px-4 py-4">
          <div className="grid grid-cols-1 gap-3">
            <ControlledInput
              value={item.apresentacao}
              onValueChange={(v) => set({ apresentacao: v })}
              placeholder="Apresentação (25 mg comprimido)"
              className="px-3 py-2.5 text-sm"
            />
            <ControlledInput
              value={item.dose}
              onValueChange={(v) => set({ dose: v })}
              placeholder="Dose (25 mg)"
              className="px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <div className="t-label text-muted-foreground mb-2">
              Horários (unidades por período)
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Horários">
              {HORARIOS.map((h) => {
                const n = item.horarios[h.id] ?? 0;
                return (
                  <div
                    key={h.id}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-2.5 py-1.5",
                      n > 0 ? "border-primary/40 bg-primary/5" : "border-border",
                    )}
                  >
                    <span className="text-xs font-medium">{h.label}</span>
                    <button
                      type="button"
                      onClick={() => setHorario(h.id, -1)}
                      aria-label={`Menos ${h.label}`}
                      className="touch-target hover:bg-secondary inline-flex items-center justify-center rounded-full"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span
                      className="w-4 text-center text-sm font-bold"
                      data-testid={`doc-item-${index}-${h.id}`}
                    >
                      {n}
                    </span>
                    <button
                      type="button"
                      onClick={() => setHorario(h.id, 1)}
                      aria-label={`Mais ${h.label}`}
                      className="touch-target hover:bg-secondary inline-flex items-center justify-center rounded-full"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <ControlledInput
              value={item.duracao}
              onValueChange={(v) => set({ duracao: v })}
              placeholder="Duração (Uso contínuo / 7 dias)"
              className="px-3 py-2.5 text-sm"
            />
            <ControlledInput
              value={item.observacao}
              onValueChange={(v) => set({ observacao: v })}
              placeholder="Observação (opcional)"
              className="px-3 py-2.5 text-sm"
            />
          </div>

          <div className="flex flex-col gap-3">
            <select
              value={item.acao}
              onChange={(e) => set({ acao: e.target.value as Acao })}
              className="bg-secondary/40 border-border w-full min-h-[2.75rem] rounded-lg border px-2.5 py-2.5 text-sm"
              aria-label="Forma de uso"
            >
              {ACOES.map((a) => (
                <option key={a} value={a}>
                  {acaoLabel(a)}
                </option>
              ))}
            </select>
            <label className="text-muted-foreground flex items-center gap-2 text-sm whitespace-nowrap">
              <input
                type="checkbox"
                checked={item.farmaciaPopular}
                onChange={(e) => set({ farmaciaPopular: e.target.checked })}
                className="accent-success h-4 w-4"
              />
              Farm. Popular
            </label>
          </div>

          {med?.alertas?.length ? (
            <p className="text-warning-foreground bg-warning/15 rounded-lg px-3 py-2 text-xs font-medium">
              ⚠ {med.alertas.join(" ")}
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
}
