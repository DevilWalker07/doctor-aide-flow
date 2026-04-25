import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles, KeyRound, Database } from "lucide-react";

export const Route = createFileRoute("/configuracoes")({
  component: Settings,
  head: () => ({ meta: [{ title: "Configurações — DOUTOR AJUDA" }] }),
});

function Settings() {
  return (
    <div className="min-h-screen bg-background">
      <header className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> VOLTAR
        </Link>
        <span className="label-tech">CONFIGURAÇÕES</span>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <h1 className="text-3xl font-extrabold tracking-tight">CONFIGURAÇÕES</h1>

        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-ai/10 text-ai grid place-items-center"><Sparkles className="h-5 w-5"/></div>
            <div>
              <h3 className="font-bold uppercase tracking-tight">MOTOR DE IA</h3>
              <p className="text-xs text-muted-foreground">SIMULADO NESTA VERSÃO</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["MOCK", "OPENAI", "GROQ"].map((p, i) => (
              <button key={p} className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide ${i === 0 ? "bg-ai text-ai-foreground" : "bg-secondary text-muted-foreground"}`} disabled={i !== 0}>{p}</button>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center"><KeyRound className="h-5 w-5"/></div>
            <div>
              <h3 className="font-bold uppercase tracking-tight">CHAVE DE API</h3>
              <p className="text-xs text-muted-foreground">SOMENTE NO BACKEND FUTURAMENTE</p>
            </div>
          </div>
          <input disabled placeholder="••••••••••••••••••••" className="w-full bg-input-bg border border-border rounded-lg px-4 py-2.5 text-sm" />
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 text-success grid place-items-center"><Database className="h-5 w-5"/></div>
            <div>
              <h3 className="font-bold uppercase tracking-tight">PERSISTÊNCIA LOCAL</h3>
              <p className="text-xs text-muted-foreground">DADOS SALVOS NO LOCALSTORAGE DO NAVEGADOR</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
