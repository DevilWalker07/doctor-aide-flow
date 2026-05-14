import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ChevronLeft, FileText } from "lucide-react";

export const Route = createFileRoute("/cadastro-manual")({
  component: CadastroManualPage,
  head: () => ({ meta: [{ title: "Cadastro Manual — DOUTOR AJUDA" }] }),
});

function CadastroManualPage() {
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="max-w-5xl mx-auto px-6 h-20 w-full flex items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <button onClick={() => window.history.back()} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group">
          <ChevronLeft className="h-4 w-4" /> VOLTAR
        </button>
        <span className="text-xs font-extrabold tracking-[0.2em] uppercase text-primary">CADASTRO MANUAL</span>
        <div className="w-16" />
      </header>
      <main className="max-w-4xl mx-auto px-6 py-12 flex-1 w-full flex flex-col items-center justify-center">
        <div className="text-center p-20 bg-white border border-border rounded-[3rem] shadow-xl max-w-2xl">
           <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
              <FileText className="h-10 w-10 text-muted-foreground" />
           </div>
           <h2 className="text-3xl font-extrabold mb-4 tracking-tight text-foreground">Formulário Manual</h2>
           <p className="text-muted-foreground leading-relaxed">
             Esta funcionalidade está sendo estruturada para permitir a inserção manual completa de dados clínicos.
           </p>
           <div className="mt-8 p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <p className="text-xs font-bold text-primary uppercase tracking-widest">Disponível na Fase 2</p>
           </div>
           <button 
             onClick={() => nav({ to: "/dashboard" })} 
             className="mt-12 w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-widest shadow-lg shadow-primary/20 hover:-translate-y-1 transition-all"
           >
             VOLTAR PARA DASHBOARD
           </button>
        </div>
      </main>
    </div>
  );
}
