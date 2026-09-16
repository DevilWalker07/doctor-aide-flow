import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ChevronLeft,
  ClipboardPaste,
  Copy,
  FlaskConical,
  Loader2,
  Sparkles,
} from "lucide-react";
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
    navigator.clipboard.writeText(
      [
        resultado.texto_formatado,
        resultado.eas_formatado,
        ...(resultado.alertas ?? []).map((a) => `⚠ ${a}`),
      ]
        .filter(Boolean)
        .join("\n"),
    );
    toast.success("Resumo copiado.");
  };

  const valores = Object.entries(resultado?.valores ?? {}).filter(([, v]) => v != null && v !== "");

  return (
    <div className="bg-background min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center gap-3 px-4 pt-5 sm:px-6">
        <Link
          to="/"
          aria-label="Voltar para a central"
          className="touch-target border-border bg-card text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl border transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <h1 className="t-title text-foreground flex items-center gap-2">
            <FlaskConical
              className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-300"
              aria-hidden="true"
            />
            Resumo de exames
          </h1>
          <p className="t-label text-muted-foreground font-normal">
            Laboratório e laudos em uma linha
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl grid-cols-1 gap-5 px-4 py-6 sm:px-6 lg:grid-cols-2">
        <section
          aria-labelledby="resumo-entrada"
          className="border-border bg-card space-y-3 rounded-3xl border p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id="resumo-entrada" className="t-title text-foreground">
              Texto dos exames
            </h2>
            <button
              type="button"
              onClick={colar}
              className="t-label text-primary focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-xl px-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              <ClipboardPaste className="h-4 w-4" aria-hidden="true" /> Colar
            </button>
          </div>
          <label htmlFor="resumo-input" className="sr-only">
            Cole o laudo ou a lista de exames
          </label>
          <textarea
            id="resumo-input"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={14}
            placeholder={
              "Cole aqui o laudo, o print transcrito ou a lista de exames.\nEx.: Hb 9,2  Ht 28  Leuco 14.400  Cr 1,8  K 5,6  PCR 87"
            }
            data-testid="resumo-input"
            className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-2xl border p-4 font-mono text-base focus:ring-2 focus:outline-none"
          />
          <button
            type="button"
            onClick={resumir}
            disabled={loading}
            data-testid="resumo-submit"
            className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-2xl text-base font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            )}
            {loading ? "Resumindo…" : "Resumir com IA"}
          </button>
        </section>

        <section
          aria-labelledby="resumo-saida"
          className="border-border bg-card space-y-4 rounded-3xl border p-5"
          data-testid="resumo-resultado"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id="resumo-saida" className="t-title text-foreground">
              Resumo
            </h2>
            {resultado && (
              <button
                type="button"
                onClick={copiar}
                className="t-label text-primary focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-xl px-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                <Copy className="h-4 w-4" aria-hidden="true" /> Copiar
              </button>
            )}
          </div>
          {!resultado ? (
            <p className="t-body text-muted-foreground">
              O resumo aparece aqui: a linha compacta no padrão da evolução, os valores extraídos e
              os alertas.
            </p>
          ) : (
            <>
              <pre className="bg-background border-border text-foreground rounded-2xl border p-4 font-mono text-[0.8125rem] whitespace-pre-wrap">
                {resultado.texto_formatado || "—"}
              </pre>
              {resultado.eas_formatado && (
                <pre className="bg-background border-border text-muted-foreground rounded-2xl border p-4 font-mono text-[0.8125rem] whitespace-pre-wrap">
                  {resultado.eas_formatado}
                </pre>
              )}
              {valores.length > 0 && (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {valores.map(([k, v]) => (
                    <li key={k} className="bg-background border-border rounded-xl border px-3 py-2">
                      <div className="t-eyebrow text-muted-foreground">{k}</div>
                      <div className="t-title text-foreground">{String(v)}</div>
                    </li>
                  ))}
                </ul>
              )}
              {(resultado.alertas ?? []).length > 0 && (
                <ul className="space-y-2">
                  {resultado.alertas!.map((a, i) => (
                    <li
                      key={i}
                      className="t-body text-foreground flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2"
                    >
                      <AlertTriangle
                        className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
                        aria-hidden="true"
                      />
                      {a}
                    </li>
                  ))}
                </ul>
              )}
              {(resultado.campos_nao_encontrados ?? []).length > 0 && (
                <p className="t-body text-muted-foreground">
                  Não encontrados: {resultado.campos_nao_encontrados!.join(", ")}
                </p>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
