import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Loader2, MessageSquareText, SendHorizontal, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { apiJson } from "@/lib/apiClient";
import { AMBIENTES } from "@/lib/ambientes";
import { storage } from "@/lib/storage";

export const Route = createFileRoute("/copiloto")({
  component: CopilotoPage,
  head: () => ({ meta: [{ title: "Copiloto Clínico — MEDFLUXO" }] }),
});

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGESTOES = [
  "Ajuste de dose de vancomicina para ClCr 25",
  "Critérios de sepse e bundle da 1ª hora",
  "Como corrigir Na 122 com segurança?",
  "Checklist de alta para IC descompensada",
];

function CopilotoPage() {
  const [mensagens, setMensagens] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ambiente, setAmbiente] = useState<string>(() => storage.getTipo());
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, loading]);

  const enviar = async (texto: string) => {
    const content = texto.trim();
    if (!content || loading) return;
    const proximo = [...mensagens, { role: "user" as const, content }];
    setMensagens(proximo);
    setInput("");
    setLoading(true);
    try {
      const res = await apiJson<{ reply: string }>("/api/ai/copiloto", {
        messages: proximo.slice(-12),
        ambiente,
      });
      setMensagens([...proximo, { role: "assistant", content: res.reply }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao falar com o copiloto.");
      setMensagens(mensagens);
      setInput(content);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void enviar(input);
  };

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-border mx-auto flex w-full max-w-3xl flex-wrap items-center gap-3 px-4 pt-5 sm:px-6">
        <Link
          to="/"
          aria-label="Voltar para a central"
          className="touch-target border-border bg-card text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl border transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="t-title text-foreground flex items-center gap-2">
            <MessageSquareText className="text-ai h-5 w-5 shrink-0" aria-hidden="true" /> Copiloto
            clínico
          </h1>
          <p className="t-label text-muted-foreground font-normal">
            Apoio à decisão — não substitui julgamento médico
          </p>
        </div>
        <div>
          <label htmlFor="copiloto-contexto" className="sr-only">
            Contexto de atendimento
          </label>
          <select
            id="copiloto-contexto"
            value={ambiente}
            onChange={(e) => setAmbiente(e.target.value)}
            className="t-label bg-card border-border text-foreground focus-visible:ring-ring min-h-[2.75rem] max-w-[13rem] rounded-xl border px-3 focus-visible:ring-2 focus-visible:outline-none"
          >
            {AMBIENTES.flatMap((a) =>
              a.subs.map((sub) => ({ v: sub.tipoEvolucao, l: `${a.curto} · ${sub.label}` })),
            ).map((o) => (
              <option key={o.v + o.l} value={o.v}>
                {o.l}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-5 sm:px-6">
        <div
          className="border-border bg-card min-h-[50vh] flex-1 space-y-3 overflow-y-auto rounded-3xl border p-4 sm:p-5"
          data-testid="copiloto-thread"
          aria-live="polite"
        >
          {mensagens.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 py-8 text-center">
              <p className="t-body text-muted-foreground max-w-md">
                Pergunte sobre doses, ajuste renal, critérios diagnósticos ou peça um checklist. As
                respostas trazem fontes e limites — confira antes de agir.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGESTOES.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => void enviar(sug)}
                    className="t-label border-border bg-background text-foreground hover:border-ai hover:text-ai focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center rounded-xl border px-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          )}
          {mensagens.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-[0.9375rem] leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary border-border text-foreground border"
                }`}
                data-testid={`copiloto-msg-${m.role}`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-secondary border-border text-muted-foreground t-body flex items-center gap-2 rounded-2xl border px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Pensando…
              </div>
            </div>
          )}
          <div ref={fim} />
        </div>

        <form onSubmit={onSubmit} className="mt-4 flex gap-2">
          <label htmlFor="copiloto-input" className="sr-only">
            Sua dúvida clínica
          </label>
          <input
            id="copiloto-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escreva sua dúvida clínica…"
            data-testid="copiloto-input"
            className="bg-card border-border text-foreground placeholder:text-muted-foreground focus:ring-ring min-h-[3rem] flex-1 rounded-2xl border px-4 text-base focus:ring-2 focus:outline-none"
          />
          {mensagens.length > 0 && (
            <button
              type="button"
              onClick={() => setMensagens([])}
              aria-label="Limpar conversa"
              className="border-border text-muted-foreground hover:text-destructive focus-visible:ring-ring inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <Trash2 className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !input.trim()}
            data-testid="copiloto-send"
            aria-label="Enviar pergunta"
            className="bg-ai focus-visible:ring-ring inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            <SendHorizontal className="h-5 w-5" aria-hidden="true" />
          </button>
        </form>
      </main>
    </div>
  );
}
