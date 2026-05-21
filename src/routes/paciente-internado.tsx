import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Camera, FileText, UserPlus, ChevronLeft, ArrowRight, Info } from "lucide-react";

export const Route = createFileRoute("/paciente-internado")({
  component: PacienteInternadoTriage,
  head: () => ({ meta: [{ title: "Paciente Internado — DOUTOR AJUDA" }] }),
});

function PacienteInternadoTriage() {
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="max-w-5xl mx-auto px-4 md:px-6 h-16 md:h-20 w-full flex items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <Link
          to="/novo-paciente"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ChevronLeft className="h-4 w-4" /> VOLTAR
        </Link>
        <span className="text-xs font-extrabold tracking-[0.2em] uppercase text-primary">
          PACIENTE JÁ INTERNADO
        </span>
        <div className="w-16" />
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-12 flex-1 w-full flex flex-col items-center justify-center">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4 uppercase">
            PACIENTE JÁ INTERNADO
          </h1>
          <p className="text-lg text-muted-foreground font-medium">
            O que você tem disponível?
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 w-full max-w-6xl mb-8 md:mb-12">
          {/* Foto de Prontuário */}
          <button
            onClick={() => nav({ to: "/upload-ia", search: { tipo: "internado", engine: "vision" } as any })}
            className="group relative bg-elevated border border-border rounded-2xl md:rounded-[2.5rem] p-5 md:p-8 text-left transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/20 hover:border-primary/40 overflow-hidden flex flex-col"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform duration-500 shadow-sm">
              <Camera className="h-8 w-8" />
            </div>
            <h3 className="relative font-extrabold text-foreground tracking-tight text-xl mb-3">
              📷 FOTO DE PRONTUÁRIO
            </h3>
            <p className="relative text-sm text-muted-foreground leading-relaxed mb-6 flex-1">
              Foto da evolução anterior, prescrição ou anotação (HEIC, JPG, PNG...).
            </p>
            <div className="relative flex items-center gap-2 text-primary text-[10px] font-bold uppercase tracking-widest mt-auto">
              Usar câmera <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* PDF / DOCX */}
          <button
            onClick={() => nav({ to: "/upload-ia", search: { tipo: "internado", engine: "docling" } as any })}
            className="group relative bg-elevated border border-border rounded-2xl md:rounded-[2.5rem] p-5 md:p-8 text-left transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-ai/20 hover:border-ai/40 overflow-hidden flex flex-col"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-ai/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative h-16 w-16 rounded-2xl bg-ai/10 flex items-center justify-center text-ai mb-6 group-hover:scale-110 transition-transform duration-500 shadow-sm">
              <FileText className="h-8 w-8" />
            </div>
            <h3 className="relative font-extrabold text-foreground tracking-tight text-xl mb-3">
              📄 PDF / DOCX
            </h3>
            <p className="relative text-sm text-muted-foreground leading-relaxed mb-6 flex-1">
              Documento digital da evolução ou prescrição.
            </p>
            <div className="relative flex items-center gap-2 text-ai text-[10px] font-bold uppercase tracking-widest mt-auto">
              Selecionar arquivo <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Preencher Manualmente */}
          <button
            onClick={() => nav({ to: "/cadastro-manual", search: { tipo: "internado" } as any })}
            className="group relative bg-elevated border border-border rounded-2xl md:rounded-[2.5rem] p-5 md:p-8 text-left transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-secondary/20 hover:border-foreground/20 overflow-hidden flex flex-col"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative h-16 w-16 rounded-2xl bg-secondary/50 flex items-center justify-center text-foreground/60 mb-6 group-hover:scale-110 transition-transform duration-500 shadow-sm">
              <UserPlus className="h-8 w-8" />
            </div>
            <h3 className="relative font-extrabold text-foreground tracking-tight text-xl mb-3">
              ✍️ PREENCHER MANUALMENTE
            </h3>
            <p className="relative text-sm text-muted-foreground leading-relaxed mb-6 flex-1">
              Digitar o que sei sobre este paciente.
            </p>
            <div className="relative flex items-center gap-2 text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-auto">
              Abrir formulário <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>

        <div className="max-w-3xl w-full bg-ai/5 border border-ai/20 rounded-3xl p-6 flex gap-4 items-start animate-pulse duration-[3000ms]">
          <div className="h-10 w-10 rounded-xl bg-ai/10 flex items-center justify-center text-ai shrink-0">
            <Info className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-ai/80 uppercase tracking-widest mb-1">Dica de IA</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A IA vai ler o documento e extrair automaticamente: 
              <span className="font-bold text-foreground"> nome, leito, diagnósticos, ATB, laboratórios e pendências.</span>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
