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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="max-w-4xl w-full mx-auto px-4 sm:px-6 pt-6 flex items-center gap-3">
        <Link
          to="/"
          aria-label="Voltar ao hub"
          className="h-11 w-11 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center justify-center text-slate-400 hover:text-slate-100 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-violet-300" /> Copiloto Clínico
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
            Apoio à decisão · não substitui julgamento médico
          </p>
        </div>
        <select
          value={ambiente}
          onChange={(e) => setAmbiente(e.target.value)}
          aria-label="Contexto de atendimento"
          className="max-w-[45%] rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-[11px] font-bold text-slate-200"
        >
          {AMBIENTES.flatMap((a) =>
            a.subs.map((s) => ({ v: s.tipoEvolucao, l: `${a.curto} · ${s.label}` })),
          ).map((o) => (
            <option key={o.v + o.l} value={o.v}>
              {o.l}
            </option>
          ))}
        </select>
      </header>

      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col">
        <div
          className="flex-1 rounded-[1.75rem] border border-slate-800 bg-slate-900/60 p-4 sm:p-6 space-y-4 overflow-y-auto min-h-[50vh]"
          data-testid="copiloto-thread"
          aria-live="polite"
        >
          {mensagens.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-10">
              <p className="text-sm text-slate-400 max-w-md">
                Pergunte sobre doses, ajustes renais, critérios diagnósticos ou peça um checklist.
                As respostas trazem fontes e limites — confira antes de agir.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void enviar(s)}
                    className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs font-bold text-slate-300 hover:border-violet-400/60 hover:text-violet-200 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {mensagens.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-white" : "bg-slate-950 border border-slate-800 text-slate-100"}`}
                data-testid={`copiloto-msg-${m.role}`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-3 bg-slate-950 border border-slate-800 text-slate-400 text-xs flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> pensando…
              </div>
            </div>
          )}
          <div ref={fim} />
        </div>

        <form onSubmit={onSubmit} className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escreva sua dúvida clínica…"
            data-testid="copiloto-input"
            className="flex-1 rounded-2xl bg-slate-900 border border-slate-800 px-4 py-4 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-400/40"
          />
          {mensagens.length > 0 && (
            <button
              type="button"
              onClick={() => setMensagens([])}
              aria-label="Limpar conversa"
              className="h-14 w-14 rounded-2xl border border-slate-800 text-slate-400 hover:text-rose-300 flex items-center justify-center"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !input.trim()}
            data-testid="copiloto-send"
            aria-label="Enviar"
            className="h-14 w-14 rounded-2xl bg-violet-500 text-white flex items-center justify-center hover:bg-violet-400 disabled:opacity-50 transition-colors"
          >
            <SendHorizontal className="h-5 w-5" />
          </button>
        </form>
      </main>
    </div>
  );
}
