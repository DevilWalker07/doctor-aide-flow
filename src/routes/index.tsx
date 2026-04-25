import { createFileRoute, Link } from "@tanstack/react-router";
import { Stethoscope, ArrowRight, Activity, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({ meta: [{ title: "DOUTOR AJUDA — Iniciar Plantão" }] }),
});

function HomePage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Premium ambient backgrounds */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] h-[600px] w-[600px] rounded-full bg-primary/5 blur-[100px] animate-pulse duration-10000" />
        <div className="absolute top-[30%] -right-[15%] h-[600px] w-[600px] rounded-full bg-brand/5 blur-[100px]" />
      </div>

      <header className="relative px-8 py-6 flex items-center justify-between max-w-7xl mx-auto w-full z-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-navy text-navy-foreground flex items-center justify-center shadow-lg shadow-navy/20">
            <Stethoscope className="h-5 w-5" />
          </div>
          <span className="font-extrabold tracking-tight text-foreground text-lg">DOUTOR AJUDA</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </span>
          <span className="label-tech text-success">SISTEMA ONLINE</span>
        </div>
      </header>

      <main className="relative flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto px-6 py-12 text-center z-10">
        <div className="group relative mb-8">
          <div className="absolute inset-0 bg-primary blur-2xl opacity-20 group-hover:opacity-30 transition-opacity duration-700 rounded-full" />
          <div className="relative h-24 w-24 rounded-[2rem] bg-gradient-to-br from-primary to-brand flex items-center justify-center shadow-2xl shadow-primary/30 transition-transform duration-500 hover:scale-105">
            <Stethoscope className="h-12 w-12 text-white" />
          </div>
        </div>

        <p className="label-tech mb-4 text-primary font-bold tracking-widest">SISTEMA DE EVOLUÇÕES MÉDICAS</p>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter text-foreground mb-4">
          EVOLUÇÕES
        </h1>
        <p className="text-xl md:text-2xl font-medium text-navy/80 mb-8 tracking-tight">
          Dr. Luan Carvalho · Plantonista
        </p>

        <p className="max-w-2xl mx-auto text-base md:text-lg text-muted-foreground leading-relaxed mb-12">
          Organize seu plantão, importe laboratórios via IA simulada e gere evoluções padrão-ouro
          estruturadas, em caixa alta, com rapidez e extrema segurança clínica.
        </p>

        <Link
          to="/tipo"
          className="group relative inline-flex items-center justify-center gap-3 px-10 py-5 rounded-2xl bg-navy text-navy-foreground font-bold uppercase tracking-widest shadow-xl shadow-navy/20 hover:shadow-navy/40 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
          <span className="relative z-10 flex items-center gap-3 text-sm md:text-base">
            INICIAR PLANTÃO
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
          </span>
        </Link>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
          {[
            { icon: Activity, label: "CHECKLIST DINÂMICO", desc: "Organização visual do plantão" },
            { icon: ShieldCheck, label: "CÁLCULOS CLÍNICOS", desc: "D4/7, TFGe e curva HGT automáticos" },
            { icon: Stethoscope, label: "PADRÃO-OURO", desc: "Texto gerado no padrão ouro médico" },
          ].map((f) => (
            <div key={f.label} className="group rounded-2xl bg-white/60 hover:bg-white backdrop-blur-md border border-border hover:border-primary/20 p-6 flex flex-col items-center gap-3 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-primary/5">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1 group-hover:scale-110 transition-transform duration-300">
                <f.icon className="h-6 w-6" />
              </div>
              <span className="font-bold text-[11px] uppercase tracking-widest text-navy">{f.label}</span>
              <span className="text-[11px] text-muted-foreground">{f.desc}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
