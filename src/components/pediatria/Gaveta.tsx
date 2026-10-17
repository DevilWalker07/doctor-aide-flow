import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

/**
 * Painel que sobe do rodapé, sobre o modo RCP. Fecha no X, no fundo escuro e
 * no Esc. Não interrompe o metrônomo: a RCP continua enquanto se consulta.
 */
export function Gaveta({
  titulo,
  subtitulo,
  aberta,
  onFechar,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  aberta: boolean;
  onFechar: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!aberta) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberta, onFechar]);

  if (!aberta) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={onFechar}
        className="bg-navy/60 absolute inset-0 backdrop-blur-[2px]"
      />
      <div className="ped-gaveta bg-background relative max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[2rem]">
        <div className="bg-background/95 sticky top-0 z-10 flex items-start gap-3 px-5 pt-3 pb-3 backdrop-blur">
          <div className="min-w-0 flex-1 pt-3">
            <span
              className="bg-border mx-auto mb-3 block h-1.5 w-12 rounded-full sm:hidden"
              aria-hidden="true"
            />
            <h2 className="t-title text-foreground">{titulo}</h2>
            {subtitulo && <p className="t-body text-muted-foreground">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="touch-target bg-muted text-foreground focus-visible:ring-ring mt-3 inline-flex items-center justify-center rounded-2xl focus-visible:ring-2 focus-visible:outline-none"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-4 px-5">{children}</div>
      </div>
    </div>
  );
}
