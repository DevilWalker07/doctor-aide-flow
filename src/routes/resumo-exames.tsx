import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronLeft, ClipboardPaste, Copy, FlaskConical, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { extractLabWithAI } from "@/lib/ai/aiService";
import type { LabExtractionResult } from "@/lib/types/lab";

export const Route = createFileRoute("/resumo-exames")({
  component: ResumoExamesPage,
  head: () => ({ meta: [{ title: "Resumo de Exames — MEDFLUXO" }] }),
});

function ResumoExamesPage() {
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<LabExtractionResult | null>(null);

  const resumir = async () => {
    if (texto.trim().length < 10) {
      toast.error("Cole o texto do laudo ou dos exames.");
      return;
    }
    setLoading(true);
    try {
      setResultado(await extractLabWithAI(texto));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao resumir.");
    } finally {
      setLoading(false);
    }
  };

  const colar = async () => {
    try {
      setTexto(await navigator.clipboard.readText());
    } catch {
      toast.error("Não foi possível ler a área de transferência.");
    }
  };

  const copiar = () => {
    if (!resultado?.texto_formatado) return;
    navigator.clipboard.writeText([resultado.texto_formatado, resultado.eas_formatado, ...(resultado.alertas ?? []).map((a) => `⚠ ${a}`)].filter(Boolean).join("\n"));
    toast.success("Resumo copiado.");
  };

  const valores = Object.entries(resultado?.valores ?? {}).filter(([, v]) => v != null && v !== "");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 flex items-center gap-3">
        <Link to="/" aria-label="Voltar ao hub" className="h-11 w-11 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center justify-center text-slate-400 hover:text-slate-100 transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-sky-300" /> Resumo de Exames
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Laboratório e laudos em uma linha</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-[1.75rem] border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Texto dos exames</h2>
            <button type="button" onClick={colar} className="text-[10px] font-black uppercase tracking-widest text-sky-300 hover:underline flex items-center gap-1">
              <ClipboardPaste className="h-3 w-3" /> Colar
            </button>
          </div>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={14}
            placeholder={"Cole aqui o laudo, o print transcrito ou a lista de exames.\nEx.: Hb 9,2  Ht 28  Leuco 14.400  Cr 1,8  K 5,6  PCR 87"}
            data-testid="resumo-input"
            className="w-full rounded-2xl bg-slate-950 border border-slate-800 p-4 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
          />
          <button
            type="button"
            onClick={resumir}
            disabled={loading}
            data-testid="resumo-submit"
            className="w-full py-4 rounded-2xl bg-sky-400 text-slate-950 font-black uppercase tracking-widest text-[11px] hover:bg-sky-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Resumir com IA
          </button>
        </section>

        <section className="rounded-[1.75rem] border border-slate-800 bg-slate-900/60 p-5 space-y-4" data-testid="resumo-resultado">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Resumo</h2>
            {resultado && (
              <button type="button" onClick={copiar} className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-100 flex items-center gap-1">
                <Copy className="h-3 w-3" /> Copiar
              </button>
            )}
          </div>
          {!resultado ? (
            <p className="text-sm text-slate-500">O resumo aparece aqui: linha compacta no padrão da evolução, valores extraídos e alertas.</p>
          ) : (
            <>
              <pre className="whitespace-pre-wrap rounded-2xl bg-slate-950 border border-slate-800 p-4 text-xs font-mono text-slate-100">{resultado.texto_formatado || "—"}</pre>
              {resultado.eas_formatado && <pre className="whitespace-pre-wrap rounded-2xl bg-slate-950 border border-slate-800 p-4 text-xs font-mono text-slate-300">{resultado.eas_formatado}</pre>}
              {valores.length > 0 && (
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {valores.map(([k, v]) => (
                    <li key={k} className="rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">{k}</div>
                      <div className="text-sm font-black">{String(v)}</div>
                    </li>
                  ))}
                </ul>
              )}
              {(resultado.alertas ?? []).length > 0 && (
                <ul className="space-y-1.5">
                  {resultado.alertas!.map((a, i) => (
                    <li key={i} className="flex gap-2 text-xs font-bold text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" /> {a}
                    </li>
                  ))}
                </ul>
              )}
              {(resultado.campos_nao_encontrados ?? []).length > 0 && <p className="text-[10px] text-slate-500 uppercase tracking-wide">Não encontrados: {resultado.campos_nao_encontrados!.join(", ")}</p>}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
