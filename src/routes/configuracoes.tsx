import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles, KeyRound, Database, CheckCircle2, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/configuracoes")({
  component: Settings,
  head: () => ({ meta: [{ title: "Configurações — DOUTOR AJUDA" }] }),
});

const AI_ENGINES = [
  { id: "openai", label: "OPENAI", color: "bg-ai text-ai-foreground" },
  { id: "groq", label: "GROQ", color: "bg-primary text-primary-foreground" },
  { id: "mock", label: "MOCK", color: "bg-secondary text-muted-foreground" },
];

function Settings() {
  const [engine, setEngine] = useState<string>(
    () => localStorage.getItem("ai_engine") || "openai"
  );
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem("ai_api_key") || ""
  );
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    localStorage.setItem("ai_engine", engine);
    localStorage.setItem("ai_api_key", apiKey);
    toast.success("Configurações salvas com sucesso!");
  };

  const handleClearData = () => {
    if (confirm("Deseja apagar TODOS os pacientes salvos localmente?")) {
      localStorage.removeItem("doutor_ajuda_patients_v1");
      toast.success("Dados locais apagados.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> VOLTAR
        </Link>
        <span className="label-tech">CONFIGURAÇÕES</span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-4 space-y-6">
        <h1 className="text-3xl font-extrabold tracking-tight">CONFIGURAÇÕES</h1>

        {/* Motor de IA */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-lg bg-ai/10 text-ai grid place-items-center">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold uppercase tracking-tight">MOTOR DE IA</h3>
              <p className="text-xs text-muted-foreground">Escolha o provedor de inteligência artificial</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {AI_ENGINES.map((e) => (
              <button
                key={e.id}
                onClick={() => setEngine(e.id)}
                className={`relative px-3 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-200 ${
                  engine === e.id
                    ? `${e.color} shadow-lg scale-[1.02]`
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                }`}
              >
                {engine === e.id && (
                  <CheckCircle2 className="absolute top-1.5 right-1.5 h-3.5 w-3.5 opacity-80" />
                )}
                {e.label}
              </button>
            ))}
          </div>
          {engine === "mock" && (
            <p className="mt-3 text-xs text-warning font-medium">
              ⚠️ Modo MOCK: A IA não é real. Os pacientes importados serão dados fictícios.
            </p>
          )}
        </div>

        {/* Chave de API */}
        {engine !== "mock" && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold uppercase tracking-tight">CHAVE DE API</h3>
                <p className="text-xs text-muted-foreground">
                  {engine === "openai" ? "Chave da OpenAI (sk-...)" : "Chave do Groq (gsk_...)"}
                </p>
              </div>
            </div>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={engine === "openai" ? "sk-..." : "gsk_..."}
                className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm font-mono pr-24 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-widest transition-colors px-2 py-1 rounded-lg hover:bg-secondary"
              >
                {showKey ? "OCULTAR" : "MOSTRAR"}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              A chave fica salva apenas no seu navegador (localStorage). Nunca é enviada a terceiros.
            </p>
          </div>
        )}

        {/* Salvar */}
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-navy text-navy-foreground text-xs font-bold uppercase tracking-widest shadow-xl hover:-translate-y-0.5 transition-all"
        >
          <Save className="h-4 w-4" /> SALVAR CONFIGURAÇÕES
        </button>

        {/* Persistência Local */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 text-success grid place-items-center">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold uppercase tracking-tight">DADOS LOCAIS</h3>
                <p className="text-xs text-muted-foreground">Dados salvos no localStorage do navegador</p>
              </div>
            </div>
            <button
              onClick={handleClearData}
              className="px-4 py-2 rounded-xl border border-destructive/30 text-destructive text-[11px] font-bold uppercase tracking-widest hover:bg-destructive/10 transition-all"
            >
              LIMPAR TUDO
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
