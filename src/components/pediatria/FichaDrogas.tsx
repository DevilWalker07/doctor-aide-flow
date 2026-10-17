import { AlertTriangle, ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { calcularBolus, formatarMl, formatarNumero } from "../../../shared/pediatria/calculos";
import {
  DROGAS_BOLUS,
  GRUPOS,
  type DrogaBolus,
  type GrupoDroga,
} from "../../../shared/pediatria/drogas";
import { Seringa } from "./Ilustracoes";

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const unidadeTexto = (u: DrogaBolus["unidade"]) => u;

function CartaoDroga({
  droga,
  peso,
  destaque,
}: {
  droga: DrogaBolus;
  peso: number;
  destaque: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const r = calcularBolus(droga, peso);
  const u = unidadeTexto(droga.unidade);
  const concFinal = formatarNumero(r.concentracaoFinal, 3);

  return (
    <li
      data-testid={`ped-droga-${droga.id}`}
      className={`bg-card rounded-3xl border p-4 ${
        r.atingiuTeto
          ? "border-warning ped-alerta"
          : destaque
            ? "border-primary/50"
            : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="t-title text-foreground">{droga.nome}</p>
          <p className="t-label text-muted-foreground mt-0.5">
            <span className="bg-secondary text-secondary-foreground mr-2 inline-block rounded-lg px-2 py-0.5">
              {droga.via}
            </span>
            {formatarNumero(droga.dosePorKg, 3)} {u}/kg
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`text-3xl leading-none font-extrabold tabular-nums ${r.atingiuTeto ? "text-warning" : "text-primary"}`}
            data-testid={`ped-ml-${droga.id}`}
          >
            {formatarMl(r.volumeMl)}
            <span className="ml-1 text-base font-bold">mL</span>
          </p>
          <p className="t-label text-muted-foreground mt-1">
            = {formatarNumero(r.dose, 3)} {u}
          </p>
        </div>
      </div>

      <Seringa
        volumeMl={r.volumeMl}
        capacidadeMl={r.seringaMl}
        alerta={r.atingiuTeto}
        className="text-foreground/70 mt-3 h-12 w-full max-w-sm"
      />

      <p className="t-body text-foreground mt-2">
        {r.preparo
          ? `Diluir 1 mL + ${r.preparo.diluenteMl} mL ${droga.diluente} e aspirar ${formatarMl(r.volumeMl)} mL na seringa de ${r.seringaMl} mL.`
          : `Sem diluir. Aspirar ${formatarMl(r.volumeMl)} mL na seringa de ${r.seringaMl} mL.`}
      </p>

      {r.atingiuTeto && (
        <p className="t-body text-foreground mt-2 flex gap-2">
          <AlertTriangle className="text-warning h-5 w-5 shrink-0" aria-hidden="true" />
          Dose máxima atingida: o cálculo daria {formatarMl(r.volumeCalculadoMl)} mL.
        </p>
      )}
      {droga.maxMl === null && (
        <p className="t-label text-muted-foreground mt-2">Sem teto definido na tabela — confira.</p>
      )}
      {droga.nota && <p className="t-label text-muted-foreground mt-2">{droga.nota}</p>}

      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="touch-target text-primary focus-visible:ring-ring t-label mt-1 -ml-2 inline-flex items-center gap-1 rounded-xl px-2 focus-visible:ring-2 focus-visible:outline-none"
      >
        Ver cálculo
        <ChevronDown
          className={`h-4 w-4 transition-transform ${aberto ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {aberto && (
        <ol className="t-body text-foreground bg-muted mt-1 grid list-decimal gap-1 rounded-2xl py-3 pr-3 pl-8 tabular-nums">
          <li>
            Dose: {formatarNumero(droga.dosePorKg, 3)} {u}/kg × {formatarNumero(peso, 1)} kg ={" "}
            {formatarNumero(r.doseCalculada, 3)} {u}
          </li>
          <li>
            Apresentação: {formatarNumero(droga.concentracao, 3)} {u}/mL
            {r.fator > 1 ? ` ÷ ${r.fator} (diluição) = ${concFinal} ${u}/mL` : ""}
          </li>
          <li>
            Volume: {formatarNumero(r.doseCalculada, 3)} ÷ {concFinal} ={" "}
            {formatarMl(r.volumeCalculadoMl)} mL
          </li>
          {droga.maxMl !== null && (
            <li>
              Teto: {formatarMl(droga.maxMl)} mL (
              {formatarNumero(droga.maxMl * r.concentracaoFinal, 3)} {u})
            </li>
          )}
        </ol>
      )}
    </li>
  );
}

export function FichaDrogas({ peso }: { peso: number }) {
  const [grupo, setGrupo] = useState<GrupoDroga | "todas">("todas");
  const [busca, setBusca] = useState("");

  const lista = useMemo(() => {
    const q = sem(busca.trim());
    return DROGAS_BOLUS.filter((d) => grupo === "todas" || d.grupo === grupo).filter(
      (d) => !q || [d.nome, d.via, ...d.sinonimos].some((t) => sem(t).includes(q)),
    );
  }, [grupo, busca]);

  const chip = (ativo: boolean) =>
    `touch-target t-label shrink-0 rounded-full border px-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
      ativo
        ? "bg-foreground text-background border-foreground"
        : "bg-card text-foreground border-border"
    }`;

  return (
    <section aria-label="Drogas da ficha de parada" className="grid gap-4">
      <label className="relative">
        <span className="sr-only">Buscar droga</span>
        <Search
          className="text-muted-foreground absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar: adrenalina, Esmeron, Narcan…"
          className="border-input bg-card text-foreground focus-visible:ring-ring t-body h-12 w-full rounded-2xl border pr-4 pl-12 focus-visible:ring-2 focus-visible:outline-none"
        />
      </label>
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
        role="group"
        aria-label="Filtrar por finalidade"
      >
        <button
          type="button"
          className={chip(grupo === "todas")}
          aria-pressed={grupo === "todas"}
          onClick={() => setGrupo("todas")}
        >
          Todas
        </button>
        {GRUPOS.map((g) => (
          <button
            key={g.id}
            type="button"
            className={chip(grupo === g.id)}
            aria-pressed={grupo === g.id}
            onClick={() => setGrupo(g.id)}
          >
            {g.nome}
          </button>
        ))}
      </div>
      {lista.length === 0 ? (
        <p className="t-body text-muted-foreground py-8 text-center">
          Nenhuma droga com esse nome. Tente o nome genérico.
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {lista.map((d) => (
            <CartaoDroga key={d.id} droga={d} peso={peso} destaque={d.id === "adrenalina-iv"} />
          ))}
        </ul>
      )}
    </section>
  );
}
