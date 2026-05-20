import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { ChevronLeft, Send, Loader2, Copy, Trash2 } from "lucide-react";
import { SPECIALISTS, type SpecialistId } from "@/lib/specialists/types";
import { SpecialistAvatar } from "@/components/specialists/SpecialistAvatar";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";

export const Route = createFileRoute("/especialistas/$id")({
  component: ChatEspecialistaPage,
  head: () => ({ meta: [{ title: "Chat com especialista — Doutor Ajuda" }] }),
});

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

function storageKey(specialistId: string) {
  return `da_chat_${specialistId}`;
}

function loadChat(specialistId: string): ChatMsg[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(specialistId)) || "[]");
  } catch {
    return [];
  }
}

function saveChat(specialistId: string, msgs: ChatMsg[]) {
  try {
    localStorage.setItem(storageKey(specialistId), JSON.stringify(msgs.slice(-50)));
  } catch { /* quota */ }
}

function ChatEspecialistaPage() {
  const nav = useNavigate();
  const { id } = useParams({ from: "/especialistas/$id" });
  const specialistId = id as SpecialistId;
  const specialist = SPECIALISTS[specialistId];

  const [messages, setMessages] = useState<ChatMsg[]>(() => loadChat(specialistId));
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!specialist) {
      nav({ to: "/especialistas" });
    }
  }, [specialist, nav]);

  useEffect(() => {
    saveChat(specialistId, messages);
    // scroll to bottom
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, specialistId]);

  if (!specialist) return null;

  const send = async () => {
    const txt = input.trim();
    if (!txt || sending) return;

    const userMsg: ChatMsg = {
      id: `u-${Date.now()}`,
      role: "user",
      content: txt,
      created_at: new Date().toISOString(),
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setSending(true);

    try {
      const data = await invokeEdgeFunction<{ reply: string; generated_at: string }>(
        "specialist-chat",
        {
          specialist_id: specialistId,
          messages: next.map(m => ({ role: m.role, content: m.content })),
        },
        { timeoutMs: 180_000 },
      );

      const reply: ChatMsg = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.reply || "(resposta vazia)",
        created_at: data.generated_at || new Date().toISOString(),
      };
      setMessages((prev) => [...prev, reply]);
    } catch (e: any) {
      toast.error(e.message || "Falha ao consultar");
      // remove a mensagem do user pra ele tentar de novo
      setMessages((prev) => prev.filter(m => m.id !== userMsg.id));
      setInput(txt);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const clear = () => {
    if (!confirm("Limpar toda a conversa com " + specialist.nome + "?")) return;
    setMessages([]);
    localStorage.removeItem(storageKey(specialistId));
  };

  const copyMsg = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copiado");
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      <header className="bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <button
            onClick={() => nav({ to: "/especialistas" })}
            className="inline-flex items-center gap-1.5 h-9 px-2 -ml-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-subtle transition-colors text-sm"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={`h-8 w-8 rounded-full ${specialist.cor.bg} flex items-center justify-center shrink-0`}>
              <SpecialistAvatar specialistId={specialist.id} size={28} className="rounded-full" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate leading-tight">{specialist.nome}</p>
              <p className="text-[11px] text-muted-foreground truncate leading-tight">{specialist.titulo}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clear}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-subtle transition-colors"
                aria-label="Limpar conversa"
                title="Limpar conversa"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className={`h-16 w-16 rounded-full ${specialist.cor.bg} mx-auto mb-3 flex items-center justify-center`}>
                <SpecialistAvatar specialistId={specialist.id} size={56} className="rounded-full" />
              </div>
              <h2 className="text-base font-semibold">{specialist.nome}</h2>
              <p className="text-[13px] text-muted-foreground italic mt-1">"{specialist.saudacao}"</p>
              <p className="text-[12px] text-muted-foreground mt-4 max-w-sm mx-auto">
                Pergunte sobre dose, diagnóstico diferencial, conduta, interpretação de exame, ou cole um caso clínico inteiro.
              </p>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap break-words ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-subtle text-foreground rounded-bl-md"
                }`}
              >
                {m.content}
                {m.role === "assistant" && (
                  <button
                    onClick={() => copyMsg(m.content)}
                    className="block mt-2 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="inline h-3 w-3 mr-1" /> Copiar
                  </button>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5 bg-subtle text-muted-foreground text-[14px] inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {specialist.nome} está digitando…
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={`Fale com ${specialist.nome}…`}
              disabled={sending}
              className="flex-1 max-h-32 px-3 py-2.5 rounded-2xl border border-input bg-elevated text-[14px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              style={{ minHeight: "44px" }}
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="h-11 w-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 hover:opacity-90 transition-opacity shrink-0"
              aria-label="Enviar"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            Histórico salvo neste dispositivo. Sugestões são consultivas — decisão final é sua.
          </p>
        </div>
      </footer>
    </div>
  );
}
