import { User } from "lucide-react";
import { ControlledInput } from "@/components/ui/controlled-input";
import type { PacienteDocumento } from "@/lib/documentos/types";
import { Section } from "./Section";

interface Props {
  value: PacienteDocumento;
  onChange: (next: PacienteDocumento) => void;
  vinculado: boolean;
}

export function PacienteHeaderForm({ value, onChange, vinculado }: Props) {
  const set = (patch: Partial<PacienteDocumento>) => onChange({ ...value, ...patch });

  return (
    <Section title="Paciente" icon={<User className="h-4 w-4" />}>
      <div className="grid grid-cols-1 gap-3">
        <ControlledInput
          value={value.nome}
          onValueChange={(v) => set({ nome: v })}
          placeholder="Nome completo do paciente"
          uppercase
          data-testid="doc-paciente-nome"
        />
        <div className="grid grid-cols-2 gap-3">
          <ControlledInput
            value={value.idade ?? ""}
            onValueChange={(v) => set({ idade: v.replace(/\D/g, "").slice(0, 3) })}
            placeholder="Idade"
            inputMode="numeric"
            data-testid="doc-paciente-idade"
          />
          <select
            value={value.sexo ?? ""}
            onChange={(e) => set({ sexo: e.target.value as PacienteDocumento["sexo"] })}
            className="w-full min-h-[3rem] bg-secondary/40 border border-border rounded-xl px-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white"
            aria-label="Sexo"
          >
            <option value="">Sexo</option>
            <option value="F">FEMININO</option>
            <option value="M">MASCULINO</option>
          </select>
        </div>
        <ControlledInput
          value={value.documento ?? ""}
          onValueChange={(v) => set({ documento: v })}
          placeholder="CPF ou CNS (opcional)"
        />
        <ControlledInput
          value={value.leito ?? ""}
          onValueChange={(v) => set({ leito: v })}
          placeholder={vinculado ? "Leito" : "Origem ou leito (opcional)"}
          uppercase
        />
      </div>
    </Section>
  );
}
