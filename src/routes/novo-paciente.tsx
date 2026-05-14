import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, BedDouble, X, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/novo-paciente")({
  component: NovoPacienteTriage,
  head: () => ({ meta: [{ title: "Novo Paciente — DOUTOR AJUDA" }] }),
});

function NovoPacienteTriage() {
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="max-w-5xl mx-auto px-6 h-20 w-full flex items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group"
        >
          <div className="h-8 w-8 rounded-full border border-border flex items-center justify-center group-hover:bg-secondary transition-colors">
            <X className="h-4 w-4" />
          </div>
          <span className="hidden sm:inline">CANCELAR</span>
        </Link>
        <span className="text-xs font-extrabold tracking-[0.2em] uppercase text-primary">
          NOVO PACIENTE
        </span>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 flex-1 w-full flex flex-col items-center justify-center">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4">
            QUAL É A SITUAÇÃO DESTE PACIENTE?
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Selecione o contexto para iniciarmos o cadastro e a organização dos dados clínicos.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
          {/* Admissão Nova */}
          <button
            onClick={() => nav({ to: "/admissao-nova" })}
            className="group relative bg-white border border-border rounded-[2.5rem] p-10 text-left transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/20 hover:border-primary/40 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-8 group-hover:scale-110 transition-transform duration-500">
              <Plus className="h-10 w-10" />
            </div>
            
            <h3 className="relative font-extrabold text-foreground tracking-tight text-2xl mb-4">
              ADMISSÃO NOVA
            </h3>
            <p className="relative text-sm text-muted-foreground leading-relaxed mb-8">
              Paciente acabou de ser admitido no hospital. Vou preencher os dados iniciais, anamnese e condutas de entrada.
            </p>
            
            <div className="relative flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-widest">
              Iniciar cadastro <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Já Internado */}
          <button
            onClick={() => nav({ to: "/paciente-internado" })}
            className="group relative bg-white border border-border rounded-[2.5rem] p-10 text-left transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-ai/20 hover:border-ai/40 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-ai/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative h-20 w-20 rounded-2xl bg-ai/10 flex items-center justify-center text-ai mb-8 group-hover:scale-110 transition-transform duration-500">
              <BedDouble className="h-10 w-10" />
            </div>
            
            <h3 className="relative font-extrabold text-foreground tracking-tight text-2xl mb-4">
              PACIENTE JÁ INTERNADO
            </h3>
            <p className="relative text-sm text-muted-foreground leading-relaxed mb-8">
              Paciente já está em acompanhamento. Tenho documentos anteriores (foto, PDF, Word) para extrair os dados.
            </p>
            
            <div className="relative flex items-center gap-2 text-ai text-xs font-bold uppercase tracking-widest">
              Importar ou preencher <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
