import { RefreshCw, ServerCrash } from "lucide-react";
import { useBackendHealth } from "@/hooks/useBackendHealth";

/**
 * Faixa de aviso quando o servidor de IA está fora do ar.
 *
 * O ponto não é avisar que algo quebrou — é dizer o que ainda dá para fazer.
 * De pé, com pressa, o médico precisa saber em um olhar se muda de ferramenta
 * ou se insiste. Some sozinha quando o servidor volta.
 */
export function AvisoBackend() {
  const { estado, motivos, recarregar } = useBackendHealth();
  if (estado !== "offline") return null;

  return (
    <div
      role="status"
      data-testid="aviso-backend"
      className="border-warning/40 bg-warning/10 flex items-start gap-3 rounded-2xl border px-4 py-3"
    >
      <ServerCrash className="text-warning mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="t-title text-foreground">Servidor de IA fora do ar</p>
        <p className="t-body text-muted-foreground mt-1">
          Copiloto, resumo de exames e geração de evolução estão indisponíveis. Documentos,
          atestado, impressão e a lista de leitos continuam funcionando normalmente.
        </p>
        {motivos.length > 0 && (
          <ul className="t-label text-muted-foreground mt-2 list-disc space-y-0.5 pl-4 font-normal">
            {motivos.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={recarregar}
        aria-label="Verificar o servidor de novo"
        className="touch-target text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <RefreshCw className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
