import { Minus, Plus, Trash2 } from "lucide-react";
import { ControlledInput, ControlledTextarea } from "@/components/ui/controlled-input";
import type { ReceitaItem } from "@/lib/documentos/types";
import { getMedicamento, HORARIOS, type Acao, type Horario } from "@/lib/medical/medicamentos";
import { cn } from "@/lib/utils";
import { AcaoIcon, acaoLabel } from "./AcaoIcon";
import { FarmaciaPopularBadge } from "./FarmaciaPopularBadge";
import { HorarioIcon } from "./HorarioIcon";

const ACOES: Acao[] = ["comprimido", "gotas", "injecao", "inalacao", "topico", "oftalmico"];

interface Props {
  item: ReceitaItem;
  index: number;
  onChange: (next: ReceitaItem) => void;
  onRemove: () => void;
}

export function MedicamentoCard({ item, index, onChange, onRemove }: Props) {
  const med = item.medicamentoId ? getMedicamento(item.medicamentoId) : undefined;
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

  return (
    <article
      className="rounded-[2rem] border border-border bg-white p-5 sm:p-6 shadow-sm space-y-5"
      data-testid={`doc-item-${index}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <AcaoIcon acao={item.acao} />
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Item {index + 1}
            </div>
            <ControlledInput
              value={item.nome}
              onValueChange={(v) => set({ nome: v })}
              placeholder="NOME DO MEDICAMENTO"
              className="px-3 py-2 text-base font-black"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <FarmaciaPopularBadge
            farmaciaPopular={item.farmaciaPopular}
            controlado={item.controlado}
            compact
          />
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remover ${item.nome || "item"}`}
            className="p-3 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20"
            data-testid={`doc-item-remove-${index}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {med && med.presets.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {med.presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => aplicarPreset(p.id)}
              className="px-3 py-1.5 rounded-lg border border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:border-primary/40 hover:text-primary"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ControlledInput
          value={item.apresentacao}
          onValueChange={(v) => set({ apresentacao: v })}
          placeholder="APRESENTAÇÃO (25 mg comprimido)"
          className="px-4 py-3 text-xs"
        />
        <ControlledInput
          value={item.dose}
          onValueChange={(v) => set({ dose: v })}
          placeholder="DOSE (25 mg)"
          className="px-4 py-3 text-xs"
        />
        <ControlledInput
          value={item.quantidade}
          onValueChange={(v) => set({ quantidade: v })}
          placeholder="QUANTIDADE (30 comprimidos)"
          className="px-4 py-3 text-xs"
        />
      </div>

      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
          Horários (unidades por período)
        </div>
        <div className="grid grid-cols-5 gap-2" role="group" aria-label="Horários">
          {HORARIOS.map((h) => {
            const n = item.horarios[h.id] ?? 0;
            return (
              <div
                key={h.id}
                className={cn(
                  "rounded-2xl border p-2 sm:p-3 flex flex-col items-center gap-2 transition-all",
                  n > 0
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                <HorarioIcon horario={h.id} size="md" />
                <span className="text-[9px] font-black uppercase tracking-wider">{h.curto}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setHorario(h.id, -1)}
                    aria-label={`Menos ${h.label}`}
                    className="h-7 w-7 rounded-lg border border-border flex items-center justify-center hover:bg-secondary"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span
                    className="w-5 text-center text-sm font-black"
                    data-testid={`doc-item-${index}-${h.id}`}
                  >
                    {n}
                  </span>
                  <button
                    type="button"
                    onClick={() => setHorario(h.id, 1)}
                    aria-label={`Mais ${h.label}`}
                    className="h-7 w-7 rounded-lg border border-border flex items-center justify-center hover:bg-secondary"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ControlledTextarea
        value={item.instrucao}
        onValueChange={(v) => set({ instrucao: v })}
        placeholder="Instrução em linguagem simples (ex.: Tomar 1 comprimido pela manhã, todos os dias.)"
        rows={2}
        className="text-sm font-semibold"
      />

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-start">
        <ControlledInput
          value={item.duracao}
          onValueChange={(v) => set({ duracao: v })}
          placeholder="DURAÇÃO (Uso contínuo / 7 dias)"
          className="px-4 py-3 text-xs"
        />
        <ControlledInput
          value={item.observacao}
          onValueChange={(v) => set({ observacao: v })}
          placeholder="OBSERVAÇÃO (opcional)"
          className="px-4 py-3 text-xs"
        />
        <div className="flex flex-wrap gap-2">
          <select
            value={item.acao}
            onChange={(e) => set({ acao: e.target.value as Acao })}
            className="bg-secondary/40 border border-border rounded-xl px-3 py-3 text-[10px] font-black uppercase"
            aria-label="Forma de uso"
          >
            {ACOES.map((a) => (
              <option key={a} value={a}>
                {acaoLabel(a)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground px-2">
            <input
              type="checkbox"
              checked={item.farmaciaPopular}
              onChange={(e) => set({ farmaciaPopular: e.target.checked })}
              className="accent-success"
            />{" "}
            Farm. Popular
          </label>
        </div>
      </div>

      {med?.alertas?.length ? (
        <p className="text-[10px] font-bold uppercase tracking-wide text-warning-foreground bg-warning/15 rounded-xl px-4 py-2">
          ⚠ {med.alertas.join(" ")}
        </p>
      ) : null}
    </article>
  );
}
