import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Database, Save, Server, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/configuracoes")({
  component: Settings,
  head: () => ({ meta: [{ title: "Configurações - DOUTOR AJUDA" }] }),
});

const AI_ENGINES = [
  { id: "backend", label: "BACKEND", color: "bg-ai text-ai-foreground" },
  { id: "mock", label: "MOCK", color: "bg-secondary text-muted-foreground" },
];

function Settings() {
  const [engine, setEngine] = useState<string>(() => localStorage.getItem("ai_engine") || "backend");

  const handleSave = () => {
    localStorage.setItem("ai_engine", engine);
    toast.success("Configurações salvas com sucesso!");
  };

  const handleClearData = () => {
    if (confirm("Deseja apagar TODOS os pacientes salvos localmente?")) {
      localStorage.removeItem("doutor_ajuda_patients_v1");
      localStorage.removeItem("doutor_ajuda_patients_v2");
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

        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-lg bg-ai/10 text-ai grid place-items-center">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold uppercase tracking-tight">MOTOR DE IA</h3>
              <p className="text-xs text-muted-foreground">O frontend chama um backend seguro ou usa mocks locais.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {AI_ENGINES.map((e) => (
              <button
                key={e.id}
                onClick={() => setEngine(e.id)}
                className={`relative px-3 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-200 ${
                  engine === e.id ? `${e.color} shadow-lg scale-[1.02]` : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                }`}
              >
                {engine === e.id && <CheckCircle2 className="absolute top-1.5 right-1.5 h-3.5 w-3.5 opacity-80" />}
                {e.label}
              </button>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-border bg-secondary/40 p-4 flex gap-3">
            <Server className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Configure a chave real apenas em <code>server/.env</code>. O navegador nunca armazena nem envia <code>OPENAI_API_KEY</code> diretamente para a OpenAI.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-navy text-navy-foreground text-xs font-bold uppercase tracking-widest shadow-xl hover:-translate-y-0.5 transition-all"
        >
          <Save className="h-4 w-4" /> SALVAR CONFIGURAÇÕES
        </button>

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
