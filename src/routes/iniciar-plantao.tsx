import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ChevronLeft, ArrowRight, Calendar, Building2, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/iniciar-plantao")({
  component: IniciarPlantaoPage,
  head: () => ({ meta: [{ title: "Iniciar Plantão — DOUTOR AJUDA" }] }),
});

function IniciarPlantaoPage() {
  const nav = useNavigate();
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [hospital, setHospital] = useState("");

  useEffect(() => {
    const padrao = localStorage.getItem("da_hospital_padrao");
    if (padrao) setHospital(padrao);
  }, []);

  const handleContinue = () => {
    if (!hospital.trim()) {
      toast.error("Por favor, informe o Hospital / Unidade.");
      return;
    }

    const dateObj = parseISO(data);
    const plantao = {
      id: "plantao_" + Date.now(),
      data: data,
      data_formatada: format(dateObj, "dd/MM/yyyy"),
      hospital: hospital.trim(),
      setor: null,
      tipo: null,
      status: "active",
      criado_em: Date.now()
    };

    localStorage.setItem("da_plantao_ativo", JSON.stringify(plantao));
    toast.success("Plantão iniciado!");
    nav({ to: "/tipo" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-ai/5 rounded-full blur-[120px]" />

      <div className="max-w-xl w-full bg-white border border-border rounded-[3rem] p-10 md:p-14 shadow-2xl relative z-10">
        <div className="text-center mb-10">
           <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-6">
              <Stethoscope className="h-8 w-8" />
           </div>
           <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-2">INICIAR PLANTÃO</h1>
           <p className="text-muted-foreground text-sm">Configure os dados básicos para começar seu dia.</p>
        </div>

        <div className="space-y-8">
           <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-2">
                 <Calendar className="h-3 w-3" /> DATA DO PLANTÃO
              </label>
              <input 
                type="date" 
                value={data} 
                onChange={(e) => setData(e.target.value)}
                className="w-full bg-secondary/40 border border-border rounded-xl px-5 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
           </div>

           <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-2">
                 <Building2 className="h-3 w-3" /> HOSPITAL / UNIDADE
              </label>
              <input 
                type="text" 
                value={hospital} 
                onChange={(e) => setHospital(e.target.value)}
                placeholder="Ex: Hospital Nair Alves de Souza"
                className="w-full bg-secondary/40 border border-border rounded-xl px-5 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
           </div>

           <div className="pt-4">
              <button 
                onClick={handleContinue}
                className="w-full py-5 rounded-2xl bg-primary text-primary-foreground font-extrabold uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 transition-all flex items-center justify-center gap-3"
              >
                CONTINUAR <ArrowRight className="h-5 w-5" />
              </button>
           </div>
        </div>

        <div className="mt-10 text-center">
           <Link to="/" className="text-[10px] font-extrabold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest flex items-center justify-center gap-2">
              <ChevronLeft className="h-3 w-3" /> CANCELAR E VOLTAR
           </Link>
        </div>
      </div>
    </div>
  );
}
