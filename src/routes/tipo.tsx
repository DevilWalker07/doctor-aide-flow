import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Stethoscope, Baby, HeartPulse, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/tipo")({
  component: TipoPage,
  head: () => ({ meta: [{ title: "Tipo de Evolução — DOUTOR AJUDA" }] }),
});

const types = [
  { id: "clinica", title: "ENFERMARIA CLÍNICA MÉDICA", icon: Stethoscope, color: "text-primary", enabled: true },
  { id: "ped", title: "ENFERMARIA PEDIÁTRICA", icon: Baby, color: "text-ai", enabled: false },
  { id: "uti", title: "TERAPIA INTENSIVA (UTI)", icon: HeartPulse, color: "text-destructive", enabled: false },
];

function TipoPage() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> VOLTAR
        </Link>
        <span className="label-tech">SELEÇÃO DE PLANTÃO</span>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-3xl md:text-4xl font-extrabold text-center tracking-tight text-foreground">
          QUAL O TIPO DE EVOLUÇÃO VOCÊ QUER?
        </h1>
        <p className="text-center text-muted-foreground mt-3">Selecione abaixo para abrir o painel do plantão</p>

        <div className="grid md:grid-cols-3 gap-6 mt-14">
          {types.map((t) => (
            <button
              key={t.id}
              disabled={!t.enabled}
              onClick={() => t.enabled && nav({ to: "/dashboard" })}
              className="group relative bg-card border border-border rounded-2xl p-8 text-left transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              <div className={`h-14 w-14 rounded-xl bg-secondary grid place-items-center ${t.color}`}>
                <t.icon className="h-7 w-7" />
              </div>
              <h3 className="mt-6 font-bold text-foreground tracking-tight uppercase text-base">{t.title}</h3>
              {!t.enabled && <span className="mt-2 inline-block label-tech text-warning">EM BREVE</span>}
              {t.enabled && <span className="mt-2 inline-block label-tech text-primary">DISPONÍVEL →</span>}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
