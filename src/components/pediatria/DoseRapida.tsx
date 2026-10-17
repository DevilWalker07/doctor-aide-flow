import { Check } from "lucide-react";
import { calcularBolus, formatarMl, formatarNumero } from "../../../shared/pediatria/calculos";
import type { ItemKit } from "../../../shared/pediatria/kits";
import { Seringa } from "./Ilustracoes";

/**
 * Uma linha de droga para as gavetas do modo RCP: volume grande, seringa
 * pequena e "Registrar" — que anota a dose no registro com o horário.
 */
export function DoseRapida({
  item,
  peso,
  vezes = 0,
  onRegistrar,
}: {
  item: ItemKit;
  peso: number | null;
  vezes?: number;
  onRegistrar?: (texto: string) => void;
}) {
  const { droga, papel } = item;
  const r = peso ? calcularBolus(droga, peso) : null;
  return (
    <li
      className={`bg-card grid gap-2 rounded-3xl border p-4 ${r?.atingiuTeto ? "border-warning" : "border-border"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="t-title text-foreground">
            {droga.nome}{" "}
            <span className="t-label text-muted-foreground font-semibold">{droga.via}</span>
          </p>
          <p className="t-label text-muted-foreground font-medium">{papel}</p>
        </div>
        {r ? (
          <div className="shrink-0 text-right">
            <p
              className={`text-3xl leading-none font-black tabular-nums ${r.atingiuTeto ? "text-warning" : "text-primary"}`}
            >
              {formatarMl(r.volumeMl)}
              <span className="ml-1 text-base font-bold">mL</span>
            </p>
            <p className="t-label text-muted-foreground mt-1 tabular-nums">
              {formatarNumero(r.dose, 3)} {droga.unidade}
            </p>
          </div>
        ) : (
          <p className="t-label text-muted-foreground">
            {formatarNumero(droga.dosePorKg, 3)} {droga.unidade}/kg
          </p>
        )}
      </div>
      {r && (
        <>
          <Seringa
            volumeMl={r.volumeMl}
            capacidadeMl={r.seringaMl}
            alerta={r.atingiuTeto}
            className="h-10 w-full max-w-xs"
          />
          <p className="t-label text-muted-foreground font-medium">
            {r.preparo
              ? `Diluir 1 mL + ${r.preparo.diluenteMl} mL ${droga.diluente}. `
              : "Sem diluir. "}
            Seringa de {r.seringaMl} mL.{r.atingiuTeto ? " Dose máxima." : ""}
          </p>
        </>
      )}
      {onRegistrar && (
        <button
          type="button"
          disabled={!r}
          onClick={() =>
            r &&
            onRegistrar(
              `${droga.nome} ${droga.via}: ${formatarNumero(r.dose, 3)} ${droga.unidade} (${formatarMl(r.volumeMl)} mL)`,
            )
          }
          className="touch-target border-border text-foreground hover:bg-accent focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded-2xl border font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
        >
          <Check className="h-5 w-5" aria-hidden="true" />
          {vezes > 0 ? `Registrar de novo (${vezes}×)` : "Registrar administração"}
        </button>
      )}
    </li>
  );
}
