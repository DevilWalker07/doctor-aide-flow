import { TracadoEcg } from "./Ilustracoes";

/**
 * O botão da sala vermelha. Na entrada é um disco grande no centro da tela —
 * o primeiro toque possível, antes até do peso; depois do peso ele mora no
 * centro da barra inferior (`NavInferior`). Caixa alta aqui é pedido
 * explícito: é o único texto da tela que precisa ser lido de longe.
 */
export function BotaoRcp({ onClick }: { onClick: () => void }) {
  return (
    <div className="grid justify-items-center gap-3">
      <div className="relative grid place-items-center">
        <span
          className="ped-anel bg-destructive/25 pointer-events-none absolute inset-0 rounded-full"
          aria-hidden="true"
        />
        <span
          className="ped-anel bg-destructive/20 pointer-events-none absolute inset-0 rounded-full"
          style={{ animationDelay: "0.8s" }}
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={onClick}
          data-testid="ped-iniciar-rcp"
          className="bg-destructive text-destructive-foreground focus-visible:ring-ring relative grid h-56 w-56 place-items-center rounded-full shadow-[0_18px_40px_-12px] shadow-red-600/50 ring-8 ring-red-500/15 transition-transform active:scale-95 focus-visible:ring-4 focus-visible:outline-none sm:h-64 sm:w-64"
        >
          <span className="grid justify-items-center gap-2">
            <TracadoEcg className="h-10 w-28 opacity-90" />
            <span className="text-[1.75rem] leading-none font-black tracking-[0.06em] sm:text-3xl">
              INICIAR
            </span>
            <span className="text-[2.6rem] leading-none font-black tracking-[0.08em] sm:text-5xl">
              RCP
            </span>
          </span>
        </button>
      </div>
      <p className="t-body text-muted-foreground max-w-xs text-center">
        Metrônomo, cronômetro e algoritmo PALS. O peso pode entrar depois.
      </p>
    </div>
  );
}
