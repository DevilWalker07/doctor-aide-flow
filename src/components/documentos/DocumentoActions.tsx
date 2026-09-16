import { Copy, Loader2, Printer, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onCopy: () => string;
  onSave: () => Promise<void>;
  saving: boolean;
  onSuggest?: () => Promise<void>;
  suggesting?: boolean;
  suggestDisabledReason?: string;
}

export function DocumentoActions({
  onCopy,
  onSave,
  saving,
  onSuggest,
  suggesting,
  suggestDisabledReason,
}: Props) {
  const copiar = async () => {
    const texto = onCopy();
    if (!texto.trim()) {
      toast.error("Nada para copiar ainda.");
      return;
    }
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Texto limpo copiado — pronto para colar no WhatsApp.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  };

  const btn =
    "t-label inline-flex min-h-[2.75rem] items-center gap-2 rounded-xl px-3.5 whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <>
      {onSuggest && (
        <button
          type="button"
          onClick={onSuggest}
          disabled={suggesting || Boolean(suggestDisabledReason)}
          title={suggestDisabledReason}
          className={`${btn} border border-ai/40 text-ai hover:bg-ai/5`}
          data-testid="doc-ai-suggest"
        >
          {suggesting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          )}{" "}
          Sugerir com IA
        </button>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className={`${btn} border border-border text-foreground hover:bg-secondary`}
        data-testid="doc-save"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="h-4 w-4" aria-hidden="true" />
        )}{" "}
        Salvar
      </button>
      <button
        type="button"
        onClick={copiar}
        className={`${btn} border border-border text-foreground hover:bg-secondary`}
        data-testid="doc-copy"
      >
        <Copy className="h-4 w-4" aria-hidden="true" /> Copiar texto
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className={`${btn} bg-navy text-navy-foreground hover:opacity-90`}
        data-testid="doc-print"
      >
        <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir A4
      </button>
    </>
  );
}
