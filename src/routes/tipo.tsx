import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Stethoscope, Baby, HeartPulse, AlertTriangle, Building2, ChevronLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useShift } from "@/hooks/useShift";
import { updateShift as dbUpdateShift } from "@/lib/db";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";

export const Route = createFileRoute("/tipo")({
  component: TipoPage,
  head: () => ({ meta: [{ title: "Onde você está hoje? — PLANTONISTA" }] }),
});

const sectors = [
  { id: "enfermaria_clinica", title: "Enfermaria Clínica Médica", icon: Stethoscope, color: "text-primary", bg: "bg-primary/5" },
  { id: "enfermaria_pediatrica", title: "Enfermaria Pediátrica", icon: Baby, color: "text-ai", bg: "bg-ai/5" },
  { id: "uti", title: "UTI", icon: HeartPulse, color: "text-destructive", bg: "bg-destructive/5" },
  { id: "upa", title: "UPA / Emergência", icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/5" },
  { id: "ubs", title: "UBS / Ambulatório", icon: Building2, color: "text-emerald-500", bg: "bg-emerald-500/5" },
];

function TipoPage() {
  const nav = useNavigate();
  const { updateShift } = useShift();
  const { userId } = useSupabaseUser();

  const handleSelect = async (sector: typeof sectors[0]) => {
    // Always update localStorage
    localStorage.setItem("da_tipo_evolucao", sector.id);
    updateShift({ tipo: sector.id, setor: sector.title });

    // Try to update Supabase if we have a real shift ID
    const shiftId = localStorage.getItem("da_shift_id");
    if (shiftId && !shiftId.startsWith("temp_") && userId) {
      try {
        await dbUpdateShift(shiftId, { type: sector.id, sector: sector.title }, userId);
      } catch (err) {
        console.warn("Falha ao atualizar tipo no Supabase", err);
      }
    }

    toast.success(`Setor selecionado: ${sector.title}`);
    nav({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <header className="max-w-6xl mx-auto px-4 md:px-6 py-3 md:py-8 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md bg-background/80">
        <Link to="/iniciar-plantao" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group">
          <ChevronLeft className="h-4 w-4" /> VOLTAR
        </Link>
        <span className="text-[10px] font-extrabold tracking-[0.3em] uppercase text-primary">SELEÇÃO DE SETOR</span>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-12 flex flex-col items-center">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4 uppercase">
            ONDE VOCÊ ESTÁ HOJE?
          </h1>
          <p className="text-lg text-muted-foreground">
            Selecione o setor abaixo para carregar as ferramentas ideais.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
          {sectors.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSelect(s)}
              className="group relative bg-elevated border border-border rounded-2xl md:rounded-[2.5rem] p-5 md:p-10 text-left transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/5 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className={`relative h-16 w-16 rounded-2xl ${s.bg} flex items-center justify-center ${s.color} mb-8 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-sm`}>
                <s.icon className="h-8 w-8" />
              </div>
              
              <h3 className="relative font-extrabold text-foreground tracking-tight uppercase text-xl leading-snug">
                {s.title}
              </h3>

              <div className="relative mt-8 flex items-center gap-2 text-xs font-bold text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-500 uppercase tracking-widest">
                Selecionar <ArrowRight className="h-4 w-4" />
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
