import { ChevronDown, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buscarMedicamentos,
  CLASSES_POR_ESPECIALIDADE,
  ESPECIALIDADES,
  type Especialidade,
  type Medicamento,
} from "@/lib/medical/medicamentos";
import { cn } from "@/lib/utils";
import { FarmaciaPopularBadge } from "./FarmaciaPopularBadge";
import { Section } from "./Section";

interface Props {
  onAdd: (med: Medicamento) => void;
  onAddManual: () => void;
}

export function MedicamentoPicker({ onAdd, onAddManual }: Props) {
  const [query, setQuery] = useState("");
  const [especialidade, setEspecialidade] = useState<Especialidade | "">("");
  const [classe, setClasse] = useState<string | "">("");
  const [soFP, setSoFP] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const resultados = useMemo(
    () =>
      buscarMedicamentos(query, {
        especialidade: especialidade || null,
        classe: classe || null,
        farmaciaPopular: soFP,
      }),
    [query, especialidade, classe, soFP],
  );
  const classes = especialidade ? CLASSES_POR_ESPECIALIDADE[especialidade] : [];

  return (
    <Section
      title="Medicamentos"
      icon={<Search className="h-4 w-4" />}
      right={
        <button
          type="button"
          onClick={onAddManual}
          className="text-primary text-sm font-medium hover:underline"
          data-testid="doc-add-manual"
        >
          + item manual
        </button>
      }
    >
      <div className="relative mb-3">
        <Search className="text-muted-foreground absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar medicamento"
          className="border-border focus:ring-ring focus:bg-card w-full rounded-xl border bg-secondary/40 py-3 pr-4 pl-10 text-base focus:ring-2 focus:outline-none"
          data-testid="doc-med-search"
        />
      </div>

      <button
        type="button"
        onClick={() => setFiltrosAbertos((v) => !v)}
        aria-expanded={filtrosAbertos}
        className="text-muted-foreground mb-3 inline-flex items-center gap-1.5 text-sm font-medium"
      >
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", filtrosAbertos && "rotate-180")}
        />
        Filtrar por especialidade
      </button>

      {filtrosAbertos && (
        <div className="mb-4 space-y-3 rounded-xl bg-secondary/30 p-3">
          <div className="grid grid-cols-1 gap-2">
            <select
              value={especialidade}
              onChange={(e) => {
                setEspecialidade(e.target.value as Especialidade | "");
                setClasse("");
              }}
              className="border-border rounded-lg border bg-card px-3 py-2.5 text-sm"
              aria-label="Especialidade"
            >
              <option value="">Todas as especialidades</option>
              {ESPECIALIDADES.map((esp) => (
                <option key={esp} value={esp}>
                  {esp}
                </option>
              ))}
            </select>
            {classes.length > 0 && (
              <select
                value={classe}
                onChange={(e) => setClasse(e.target.value)}
                className="border-border rounded-lg border bg-card px-3 py-2.5 text-sm"
                aria-label="Classe"
              >
                <option value="">Todas as classes</option>
                {classes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
          <label className="text-muted-foreground flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={soFP}
              onChange={(e) => setSoFP(e.target.checked)}
              className="accent-success h-4 w-4"
            />
            Só Farmácia Popular
          </label>
        </div>
      )}

      <ul
        className="divide-border border-border max-h-80 divide-y overflow-y-auto rounded-xl border"
        data-testid="doc-med-results"
      >
        {resultados.length === 0 && (
          <li className="text-muted-foreground p-6 text-center text-sm">
            Nenhum medicamento encontrado. Use "+ item manual".
          </li>
        )}
        {resultados.map((m) => (
          <li
            key={m.id}
            className="hover:bg-secondary/40 flex items-center justify-between gap-3 p-3"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-foreground text-sm font-semibold">{m.nome}</span>
                <span className="t-label text-muted-foreground font-normal">{m.apresentacao}</span>
                <FarmaciaPopularBadge
                  farmaciaPopular={m.farmaciaPopular}
                  controlado={m.controlado}
                  compact
                />
              </div>
              <div className="t-label text-muted-foreground mt-0.5 font-normal">
                {m.especialidade} · {m.classe}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onAdd(m)}
              className="touch-target text-primary hover:bg-primary/10 shrink-0 inline-flex items-center justify-center rounded-full"
              data-testid={`doc-add-med-${m.id}`}
              aria-label={`Adicionar ${m.nome}`}
            >
              <Plus className="h-5 w-5" />
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
