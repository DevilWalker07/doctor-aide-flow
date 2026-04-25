import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Stethoscope, Baby, HeartPulse, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/tipo")({
  component: TipoPage,
  head: () => ({ meta: [{ title: "Tipo de Evolução — DOUTOR AJUDA" }] }),
});

const types = [
  { id: "clinica", title: "ENFERMARIA CLÍNICA MÉDICA", icon: Stethoscope, color: "text-primary", bg: "bg-primary/5", borderHover: "hover:border-primary/50", shadowHover: "hover:shadow-primary/20", enabled: true },
  { id: "ped", title: "ENFERMARIA PEDIÁTRICA", icon: Baby, color: "text-ai", bg: "bg-ai/5", borderHover: "hover:border-ai/50", shadowHover: "hover:shadow-ai/20", enabled: false },
  { id: "uti", title: "TERAPIA INTENSIVA (UTI)", icon: HeartPulse, color: "text-destructive", bg: "bg-destructive/5", borderHover: "hover:border-destructive/50", shadowHover: "hover:shadow-destructive/20", enabled: false },
];

function TipoPage() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-background relative">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md bg-background/80">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> VOLTAR
        </Link>
        <span className="label-tech">SELEÇÃO DE PLANTÃO</span>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        <h1 className="text-4xl md:text-5xl font-extrabold text-center tracking-tight text-foreground mb-4">
          QUAL O TIPO DE EVOLUÇÃO VOCÊ QUER?
        </h1>
        <p className="text-center text-lg text-muted-foreground mb-16">
          Selecione o setor abaixo para abrir a gestão do plantão
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {types.map((t) => (
            <button
              key={t.id}
              disabled={!t.enabled}
              onClick={() => t.enabled && nav({ to: "/dashboard" })}
              className={`group relative bg-card border border-border rounded-[2rem] p-8 text-left transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none overflow-hidden ${t.enabled ? t.borderHover + ' ' + t.shadowHover : ''}`}
            >
              {/* Subtle background gradient on hover */}
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-transparent to-${t.color.replace('text-', '')}/5`} />

              <div className={`relative h-16 w-16 rounded-2xl ${t.bg} flex items-center justify-center ${t.color} mb-8 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                <t.icon className="h-8 w-8" />
              </div>
              
              <h3 className="relative font-extrabold text-foreground tracking-tight uppercase text-lg leading-snug mb-4">
                {t.title}
              </h3>
              
              <div className="relative mt-auto">
                {!t.enabled && <span className="inline-block label-tech text-warning bg-warning/10 px-3 py-1 rounded-md">EM BREVE</span>}
                {t.enabled && <span className="inline-block label-tech text-primary bg-primary/10 px-3 py-1 rounded-md group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">DISPONÍVEL →</span>}
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
