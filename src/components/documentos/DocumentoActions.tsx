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
    "px-4 sm:px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";

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
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}{" "}
          Sugerir com IA
        </button>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className={`${btn} border border-border hover:bg-secondary`}
        data-testid="doc-save"
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}{" "}
        Salvar
      </button>
      <button
        type="button"
        onClick={copiar}
        className={`${btn} border border-border hover:bg-secondary`}
        data-testid="doc-copy"
      >
        <Copy className="h-3 w-3" /> Copiar texto limpo
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className={`${btn} bg-navy text-white shadow-xl shadow-navy/20 hover:-translate-y-0.5`}
        data-testid="doc-print"
      >
        <Printer className="h-3 w-3" /> Imprimir A4
      </button>
    </>
  );
}
