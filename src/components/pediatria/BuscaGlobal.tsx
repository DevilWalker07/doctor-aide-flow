import {
  ArrowLeft,
  ChevronRight,
  Droplets,
  HeartPulse,
  LayoutGrid,
  Search,
  Stethoscope,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { CAUSAS } from "../../../shared/pediatria/causas";
import { drogaPorId } from "../../../shared/pediatria/kits";
import { buscar, type Resultado } from "@/lib/pediatria/busca";
import type { AbaPed } from "@/lib/pediatria/pacienteSalvo";
import { Conduta } from "./CausasReversiveis";
import { DoseRapida } from "./DoseRapida";
import { Gaveta } from "./Gaveta";

const SUGESTOES = [
  "adrenalina",
  "tubo",
  "tamponamento",
  "intoxicação",
  "noradrenalina",
  "cardioversão",
];

/**
 * Uma busca para tudo: droga (com a dose já calculada no resultado), infusão,
 * conduta dos Hs e Ts e seção da ficha. Abre por cima de qualquer aba.
 */
export function BuscaGlobal({
  aberta,
  onFechar,
  peso,
  onAba,
  onInfusao,
  onRcp,
}: {
  aberta: boolean;
  onFechar: () => void;
  peso: number | null;
  onAba: (a: AbaPed) => void;
  onInfusao: (id: string) => void;
  onRcp: () => void;
}) {
  const [q, setQ] = useState("");
  const [causa, setCausa] = useState<string | null>(null);
  const resultados = buscar(q);
  const fechar = () => {
    setCausa(null);
    onFechar();
  };
  const ir = (r: Resultado) => {
    if (r.tipo === "secao") {
      onAba(r.aba);
      fechar();
    } else if (r.tipo === "infusao") {
      onInfusao(r.id);
      fechar();
    } else if (r.tipo === "rcp") {
      fechar();
      onRcp();
    } else if (r.tipo === "causa") {
      setCausa(r.id);
    }
  };
  const causaAberta = causa ? CAUSAS.find((c) => c.id === causa) : null;

  const linha = (r: Resultado, icone: ReactNode) => (
    <li key={`${r.tipo}-${"id" in r ? r.id : r.titulo}`}>
      <button
        type="button"
        onClick={() => ir(r)}
        data-testid={`busca-${r.tipo}-${"id" in r ? r.id : "aba" in r ? r.aba : "rcp"}`}
        className="bg-card border-border hover:bg-accent focus-visible:ring-ring grid min-h-14 w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border px-3 py-2 text-left focus-visible:ring-2 focus-visible:outline-none"
      >
        {icone}
        <span className="min-w-0">
          <span className="t-body text-foreground block font-bold">{r.titulo}</span>
          <span className="t-label text-muted-foreground block font-medium">{r.sub}</span>
        </span>
        <ChevronRight className="text-muted-foreground h-5 w-5" aria-hidden="true" />
      </button>
    </li>
  );
  const icone = (tipo: Resultado["tipo"]) => {
    const cls = "h-10 w-10 rounded-xl grid place-items-center";
    if (tipo === "rcp")
      return (
        <span className={`${cls} bg-destructive text-destructive-foreground`}>
          <HeartPulse className="h-5 w-5" aria-hidden="true" />
        </span>
      );
    if (tipo === "infusao")
      return (
        <span className={`${cls} bg-primary/10 text-primary`}>
          <Droplets className="h-5 w-5" aria-hidden="true" />
        </span>
      );
    if (tipo === "causa")
      return (
        <span className={`${cls} bg-destructive/10 text-destructive`}>
          <Stethoscope className="h-5 w-5" aria-hidden="true" />
        </span>
      );
    return (
      <span className={`${cls} bg-muted text-foreground`}>
        <LayoutGrid className="h-5 w-5" aria-hidden="true" />
      </span>
    );
  };

  return (
    <Gaveta titulo={causaAberta ? causaAberta.nome : "Buscar"} aberta={aberta} onFechar={fechar}>
      {causaAberta ? (
        <>
          <button
            type="button"
            onClick={() => setCausa(null)}
            className="t-body text-primary focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 justify-self-start rounded-xl font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" /> Voltar à busca
          </button>
          <Conduta causa={causaAberta} peso={peso} registros={{}} />
        </>
      ) : (
        <>
          <label className="relative">
            <span className="sr-only">Buscar droga, conduta ou seção</span>
            <Search
              className="text-muted-foreground absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              autoFocus
              value={q}
              data-testid="busca-campo"
              onChange={(e) => setQ(e.target.value)}
              placeholder="Droga, tubo, conduta…"
              enterKeyHint="search"
              className="border-input bg-card text-foreground focus-visible:ring-ring h-14 w-full rounded-2xl border pr-4 pl-12 text-lg focus-visible:ring-2 focus-visible:outline-none"
            />
          </label>

          {q.trim() === "" ? (
            <div className="grid gap-2">
              <p className="t-label text-muted-foreground">Experimente</p>
              <div className="flex flex-wrap gap-2">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setQ(s)}
                    className="touch-target bg-muted text-foreground t-label focus-visible:ring-ring rounded-full px-4 focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : resultados.length === 0 ? (
            <p className="t-body text-muted-foreground py-6 text-center">
              Nada encontrado para “{q}”. Tente o nome genérico ou outra palavra.
            </p>
          ) : (
            <ul className="grid gap-2" data-testid="busca-resultados">
              {resultados.map((r) =>
                r.tipo === "droga" ? (
                  <DoseRapida
                    key={`droga-${r.id}`}
                    item={{ droga: drogaPorId(r.id), papel: drogaPorId(r.id).nota ?? "" }}
                    peso={peso}
                  />
                ) : (
                  linha(r, icone(r.tipo))
                ),
              )}
            </ul>
          )}
        </>
      )}
    </Gaveta>
  );
}
