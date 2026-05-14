import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ChevronLeft, User, Activity, Pill, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/paciente/$id")({
  component: PacienteDetailPage,
  head: () => ({ meta: [{ title: "Detalhes do Paciente — DOUTOR AJUDA" }] }),
});

function PacienteDetailPage() {
  const { id } = useParams({ from: "/paciente/$id" });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="max-w-5xl mx-auto px-6 h-20 w-full flex items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ChevronLeft className="h-4 w-4" /> VOLTAR
        </Link>
        <span className="text-xs font-extrabold tracking-[0.2em] uppercase text-primary">
          DETALHES DO PACIENTE
        </span>
        <div className="w-16" />
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 flex-1 w-full">
         <div className="bg-white border border-border rounded-[3rem] p-10 text-center shadow-xl">
            <div className="h-20 w-20 rounded-[2rem] bg-secondary/50 flex items-center justify-center mx-auto mb-6">
               <User className="h-10 w-10 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-black mb-2 uppercase tracking-tight">Paciente ID: {id}</h1>
            <p className="text-muted-foreground mb-8">Esta página de detalhes está sendo implementada. Use o dashboard para gerenciar.</p>
            <Link 
              to="/dashboard"
              className="inline-block px-10 py-4 rounded-2xl bg-primary text-primary-foreground font-bold uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 hover:-translate-y-1 transition-all"
            >
              VOLTAR AO DASHBOARD
            </Link>
         </div>
      </main>
    </div>
  );
}
