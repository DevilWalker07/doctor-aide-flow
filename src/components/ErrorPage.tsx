import { Link } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw, Home, LayoutDashboard } from "lucide-react";

interface Props {
  error?: Error | unknown;
  reset?: () => void;
}

export default function ErrorPage({ error, reset }: Props) {
  const errorMessage = error instanceof Error ? error.message : String(error || "Erro desconhecido");
  const errorStack = error instanceof Error ? error.stack : undefined;
  const errorId = Date.now().toString(36).toUpperCase();

  const handleReload = () => {
    if (reset) reset();
    else if (typeof window !== "undefined") window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-xl bg-elevated border border-border rounded-[2.5rem] p-10 shadow-2xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-14 w-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-foreground uppercase tracking-tight">Algo deu errado nesta tela</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
              ID do erro: {errorId}
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Encontramos um problema ao carregar esta página. Seus dados estão seguros — você pode voltar
          ao painel ou recarregar a página para tentar novamente.
        </p>

        <details className="mb-6 border border-border rounded-2xl bg-secondary/30 overflow-hidden">
          <summary className="px-4 py-3 cursor-pointer text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-secondary/50">
            Detalhes técnicos
          </summary>
          <div className="px-4 py-3 border-t border-border space-y-2">
            <p className="text-[11px] font-mono text-foreground break-words">
              <span className="font-bold">Mensagem:</span> {errorMessage}
            </p>
            {errorStack && (
              <pre className="text-[10px] font-mono text-muted-foreground overflow-x-auto max-h-40 leading-relaxed whitespace-pre-wrap break-words">
                {errorStack.slice(0, 1000)}
                {errorStack.length > 1000 ? "\n…" : ""}
              </pre>
            )}
          </div>
        </details>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            to="/dashboard"
            className="px-5 py-3 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
          >
            <LayoutDashboard className="h-3.5 w-3.5" /> VOLTAR AO DASHBOARD
          </Link>
          <button
            onClick={handleReload}
            className="px-5 py-3 rounded-xl border border-border bg-elevated text-foreground text-[10px] font-black uppercase tracking-widest hover:bg-secondary transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" /> RECARREGAR
          </button>
        </div>
        <div className="mt-3">
          <Link
            to="/"
            className="block text-center text-[10px] font-black text-muted-foreground hover:text-foreground uppercase tracking-widest py-2 transition-colors"
          >
            <Home className="h-3.5 w-3.5 inline mr-1" /> Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}
