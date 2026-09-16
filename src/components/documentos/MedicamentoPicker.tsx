import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buscarMedicamentos,
  CLASSES_POR_ESPECIALIDADE,
  ESPECIALIDADES,
  type Especialidade,
  type Medicamento,
} from "@/lib/medical/medicamentos";
import { FarmaciaPopularBadge } from "./FarmaciaPopularBadge";
import { Chip, Section } from "./Section";

interface Props {
  onAdd: (med: Medicamento) => void;
  onAddManual: () => void;
}

export function MedicamentoPicker({ onAdd, onAddManual }: Props) {
  const [query, setQuery] = useState("");
  const [especialidade, setEspecialidade] = useState<Especialidade | null>(null);
  const [classe, setClasse] = useState<string | null>(null);
  const [soFP, setSoFP] = useState(false);

  const resultados = useMemo(
    () => buscarMedicamentos(query, { especialidade, classe, farmaciaPopular: soFP }),
    [query, especialidade, classe, soFP],
  );
  const classes = especialidade ? CLASSES_POR_ESPECIALIDADE[especialidade] : [];

  return (
    <Section
      title="2. MEDICAMENTOS"
      icon={<Search className="h-4 w-4" />}
      right={
        <button
          type="button"
          onClick={onAddManual}
          className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
          data-testid="doc-add-manual"
        >
          + item manual
        </button>
      }
    >
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome ou classe (ex.: espironolactona, antibiótico)"
          className="w-full bg-secondary/40 border border-border rounded-xl pl-11 pr-4 py-4 text-sm font-bold placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white"
          data-testid="doc-med-search"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {ESPECIALIDADES.map((esp) => (
          <Chip
            key={esp}
            label={esp}
            selected={especialidade === esp}
            onClick={() => {
              setEspecialidade(especialidade === esp ? null : esp);
              setClasse(null);
            }}
          />
        ))}
        <Chip label="Só Farmácia Popular" selected={soFP} onClick={() => setSoFP(!soFP)} />
      </div>
      {classes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 pl-1 border-l-2 border-primary/30">
          {classes.map((c) => (
            <Chip
              key={c}
              label={c}
              selected={classe === c}
              onClick={() => setClasse(classe === c ? null : c)}
            />
          ))}
        </div>
      )}

      <ul
        className="divide-y divide-border max-h-80 overflow-y-auto rounded-2xl border border-border"
        data-testid="doc-med-results"
      >
        {resultados.length === 0 && (
          <li className="p-6 text-xs font-bold text-muted-foreground uppercase text-center">
            Nenhum medicamento encontrado. Use "+ item manual".
          </li>
        )}
        {resultados.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between gap-3 p-4 hover:bg-secondary/40"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black text-foreground">{m.nome}</span>
                <span className="text-xs font-bold text-muted-foreground">{m.apresentacao}</span>
                <FarmaciaPopularBadge
                  farmaciaPopular={m.farmaciaPopular}
                  controlado={m.controlado}
                  compact
                />
              </div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                {m.especialidade} · {m.classe} · {m.presets[0]?.label}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onAdd(m)}
              className="shrink-0 h-10 px-4 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:-translate-y-0.5 transition-all"
              data-testid={`doc-add-med-${m.id}`}
              aria-label={`Adicionar ${m.nome}`}
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
