import { Activity, Droplets, Syringe, Wind } from "lucide-react";
import type { AbaPed } from "@/lib/pediatria/pacienteSalvo";
import { TracadoEcg } from "./Ilustracoes";

const ABAS: { id: AbaPed; rotulo: string; icone: typeof Syringe }[] = [
  { id: "drogas", rotulo: "Drogas", icone: Syringe },
  { id: "iot", rotulo: "Intubação", icone: Wind },
  { id: "choque", rotulo: "Choque", icone: Activity },
  { id: "infusoes", rotulo: "Infusões", icone: Droplets },
];

/**
 * Barra inferior, no alcance do polegar: as quatro seções da ficha e, no
 * centro, o botão de RCP — maior, vermelho, sempre à vista. Substitui as abas
 * do topo, que exigiam esticar o dedo com o celular numa mão só.
 */
export function NavInferior({
  aba,
  onAba,
  onRcp,
}: {
  aba: AbaPed;
  onAba: (a: AbaPed) => void;
  onRcp: () => void;
}) {
  const item = (a: (typeof ABAS)[number]) => {
    const ativo = aba === a.id;
    const Icone = a.icone;
    return (
      <button
        key={a.id}
        type="button"
        onClick={() => onAba(a.id)}
        aria-current={ativo ? "page" : undefined}
        data-testid={`ped-aba-${a.id}`}
        className={`focus-visible:ring-ring grid min-h-14 justify-items-center content-center gap-0.5 rounded-2xl px-1 transition-colors focus-visible:ring-2 focus-visible:outline-none ${
          ativo ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <span
          className={`grid h-8 w-12 place-items-center rounded-full ${ativo ? "bg-primary/12" : ""}`}
        >
          <Icone className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className={`text-[13px] leading-none ${ativo ? "font-bold" : "font-semibold"}`}>
          {a.rotulo}
        </span>
      </button>
    );
  };
  return (
    <nav
      aria-label="Seções da emergência pediátrica"
      className="bg-card/95 border-border fixed inset-x-0 bottom-0 z-30 border-t pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur"
    >
      <div className="mx-auto grid max-w-lg grid-cols-[1fr_1fr_auto_1fr_1fr] items-end gap-1 px-2 pt-1.5">
        {ABAS.slice(0, 2).map(item)}
        <button
          type="button"
          onClick={onRcp}
          data-testid="ped-iniciar-rcp"
          aria-label="Iniciar RCP"
          className="bg-destructive text-destructive-foreground focus-visible:ring-ring relative -mt-7 grid h-[4.75rem] w-[4.75rem] place-items-center rounded-full shadow-[0_10px_24px_-8px] shadow-red-600/70 ring-4 ring-[var(--card)] transition-transform active:scale-95 focus-visible:ring-4 focus-visible:outline-none"
        >
          <span className="grid justify-items-center">
            <TracadoEcg className="h-5 w-12" />
            <span className="text-[15px] leading-none font-black tracking-wide">RCP</span>
          </span>
        </button>
        {ABAS.slice(2).map(item)}
      </div>
    </nav>
  );
}
