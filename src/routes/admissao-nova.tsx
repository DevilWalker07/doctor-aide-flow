import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { UserPlus, FileUp, ChevronLeft, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/admissao-nova")({
  component: AdmissaoNovaTriage,
  head: () => ({ meta: [{ title: "Admissão Nova — DOUTOR AJUDA" }] }),
});

function AdmissaoNovaTriage() {
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="max-w-5xl mx-auto px-6 h-20 w-full flex items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <Link
          to="/novo-paciente"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ChevronLeft className="h-4 w-4" /> VOLTAR
        </Link>
        <span className="text-xs font-extrabold tracking-[0.2em] uppercase text-primary">
          ADMISSÃO NOVA
        </span>
        <div className="w-16" />
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 flex-1 w-full flex flex-col items-center justify-center">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4 uppercase">
            ADMISSÃO NOVA
          </h1>
          <p className="text-lg text-muted-foreground font-medium">
            Como deseja cadastrar?
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
          {/* Preencher Manualmente */}
          <button
            onClick={() => nav({ to: "/cadastro-manual", search: { tipo: "admissao" } as any })}
            className="group relative bg-elevated border border-border rounded-[2.5rem] p-10 text-left transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/20 hover:border-primary/40 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-8 group-hover:scale-110 transition-transform duration-500 shadow-sm">
              <UserPlus className="h-10 w-10" />
            </div>
            
            <h3 className="relative font-extrabold text-foreground tracking-tight text-2xl mb-4">
              ✍️ PREENCHER MANUALMENTE
            </h3>
            <p className="relative text-sm text-muted-foreground leading-relaxed mb-8">
              Digitar os dados iniciais do paciente recém-admitido.
            </p>
            
            <div className="relative flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-widest">
              Abrir formulário <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Enviar Documento Inicial */}
          <button
            onClick={() => nav({ to: "/upload-ia", search: { tipo: "admissao" } as any })}
            className="group relative bg-elevated border border-border rounded-[2.5rem] p-10 text-left transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-ai/20 hover:border-ai/40 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-ai/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative h-20 w-20 rounded-2xl bg-ai/10 flex items-center justify-center text-ai mb-8 group-hover:scale-110 transition-transform duration-500 shadow-sm">
              <FileUp className="h-10 w-10" />
            </div>
            
            <h3 className="relative font-extrabold text-foreground tracking-tight text-2xl mb-4">
              📎 ENVIAR DOCUMENTO INICIAL
            </h3>
            <p className="relative text-sm text-muted-foreground leading-relaxed mb-8">
              Ficha de admissão, boletim de UPA ou encaminhamento.
            </p>
            
            <div className="relative flex items-center gap-2 text-ai text-xs font-bold uppercase tracking-widest">
              Fazer upload <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
