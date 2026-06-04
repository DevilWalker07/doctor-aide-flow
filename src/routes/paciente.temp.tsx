import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ChevronLeft, User, Activity, ClipboardList, Clock } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/paciente/temp")({
  component: PacienteTempPage,
  head: () => ({ meta: [{ title: "Visualização Temporária — DOUTOR AJUDA" }] }),
});

function PacienteTempPage() {
  const nav = useNavigate();
  const [paciente, setPaciente] = useState<any>(null);

  useEffect(() => {
    const raw = localStorage.getItem("doutor_ajuda_paciente_atual");
    if (raw) setPaciente(JSON.parse(raw));
  }, []);

  if (!paciente) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="max-w-5xl mx-auto px-6 h-20 w-full flex items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <button onClick={() => window.history.back()} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group">
          <ChevronLeft className="h-4 w-4" /> VOLTAR
        </button>
        <span className="text-xs font-extrabold tracking-[0.2em] uppercase text-primary">PACIENTE TEMPORÁRIO</span>
        <div className="w-16" />
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <div className="bg-elevated border border-border rounded-[3rem] p-10 shadow-xl">
          <div className="flex items-center gap-6 mb-10 border-b border-border pb-8">
            <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary">
              <User className="h-10 w-10" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{paciente.nome}</h1>
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1">
                Leito {paciente.leito} · {paciente.idade} anos · {paciente.sexo === 'F' ? 'Feminino' : 'Masculino'}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
             <div className="space-y-4">
                <h3 className="text-xs font-extrabold text-primary uppercase tracking-widest flex items-center gap-2">
                   <Activity className="h-4 w-4" /> Resumo Clínico
                </h3>
                <div className="bg-secondary/30 rounded-2xl p-6 text-sm leading-relaxed text-muted-foreground">
                   {paciente.hda || "Sem história clínica registrada."}
                </div>
             </div>
             
             <div className="space-y-4">
                <h3 className="text-xs font-extrabold text-primary uppercase tracking-widest flex items-center gap-2">
                   <ClipboardList className="h-4 w-4" /> Pendências
                </h3>
                <div className="space-y-3">
                   {paciente.pendencias && paciente.pendencias.length > 0 ? (
                      paciente.pendencias.map((p: any) => (
                        <div key={p.id} className="flex gap-3 items-center bg-amber-500/5 p-4 rounded-xl border border-amber-500/10 text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-tight">
                           <Clock className="h-3.5 w-3.5" /> {p.text}
                        </div>
                      ))
                   ) : (
                      <p className="text-xs text-muted-foreground ml-2">Nenhuma pendência.</p>
                   )}
                </div>
             </div>
          </div>

          <div className="mt-12 p-8 bg-primary/5 rounded-[2.5rem] border border-primary/10 text-center">
             <p className="text-sm font-bold text-primary uppercase tracking-[0.2em] mb-4">Módulo de Persistência (Fase 3)</p>
             <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                Na Fase 3, este paciente será persistido no Supabase e estará disponível em todo o hospital.
             </p>
             <button 
               onClick={() => nav({ to: "/dashboard" })}
               className="mt-8 px-10 py-4 bg-primary text-primary-foreground rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-primary/20 hover:-translate-y-1 transition-all"
             >
                VOLTAR AO DASHBOARD
             </button>
          </div>
        </div>
      </main>
    </div>
  );
}
