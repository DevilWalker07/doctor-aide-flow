import { createFileRoute, Link } from "@tanstack/react-router";
import { Stethoscope, ArrowRight, Activity, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({ meta: [{ title: "DOUTOR AJUDA — Iniciar Plantão" }] }),
});

function HomePage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[520px] w-[520px] rounded-full bg-ai/10 blur-3xl" />
      </div>

      <header className="relative px-8 py-6 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-navy text-navy-foreground grid place-items-center">
            <Stethoscope className="h-5 w-5" />
          </div>
          <span className="font-bold tracking-tight text-foreground">DOUTOR AJUDA</span>
        </div>
        <span className="label-tech">v1.0 · UI PREVIEW</span>
      </header>

      <main className="relative max-w-3xl mx-auto px-6 pt-20 pb-32 text-center">
        <div className="mx-auto h-20 w-20 rounded-3xl bg-gradient-to-br from-primary to-brand grid place-items-center shadow-xl shadow-primary/30 mb-10">
          <Stethoscope className="h-10 w-10 text-white" />
        </div>

        <p className="label-tech mb-3">SISTEMA DE EVOLUÇÕES MÉDICAS</p>
        <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight text-foreground">
          EVOLUÇÕES
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">Dr. Luan Carvalho · Plantonista</p>

        <p className="mt-8 max-w-xl mx-auto text-base text-muted-foreground">
          Organize seu plantão, importe laboratórios e gere evoluções padrão-ouro
          em caixa alta com rapidez e segurança clínica.
        </p>

        <div className="mt-10 flex justify-center">
          <Link
            to="/tipo"
            className="group inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-navy text-navy-foreground font-bold uppercase tracking-wide shadow-lg shadow-navy/20 hover:shadow-navy/40 transition-all hover:-translate-y-0.5"
          >
            INICIAR PLANTÃO
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
          {[
            { icon: Activity, label: "CHECKLIST DINÂMICO" },
            { icon: ShieldCheck, label: "CÁLCULOS CLÍNICOS" },
            { icon: Stethoscope, label: "PADRÃO-OURO" },
          ].map((f) => (
            <div key={f.label} className="rounded-xl bg-card border border-border p-4 flex flex-col items-center gap-2">
              <f.icon className="h-5 w-5 text-primary" />
              <span className="label-tech">{f.label}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
