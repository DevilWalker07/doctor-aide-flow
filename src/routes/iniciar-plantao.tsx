import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ChevronLeft, ArrowRight, Calendar, Building2, Stethoscope, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, isValid } from "date-fns";
import { createShift } from "@/lib/db";

export const Route = createFileRoute("/iniciar-plantao")({
  component: IniciarPlantaoPage,
  head: () => ({ meta: [{ title: "Iniciar Plantão — DOUTOR AJUDA" }] }),
});

function IniciarPlantaoPage() {
  const nav = useNavigate();
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [hospital, setHospital] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const padrao = localStorage.getItem("da_hospital_padrao");
      if (padrao) setHospital(padrao);
    } catch (e) {
      console.error("Erro ao ler localStorage", e);
    }
  }, []);

  const handleContinue = async () => {
    if (saving) return;
    setSaving(true);

    const hospitalValue = hospital.trim() || "Unidade não informada";
    let displayDate = "Data não informada";
    try {
      if (data) {
        const dateObj = parseISO(data);
        if (isValid(dateObj)) {
          displayDate = format(dateObj, "dd/MM/yyyy");
        }
      }
    } catch (e) {
      console.error("Erro na formatação da data", e);
    }

    try {
      // Try Supabase first
      const shift = await createShift({
        date: data || new Date().toISOString().slice(0, 10),
        hospital: hospitalValue,
      });

      // Sync to localStorage
      const localShift = {
        id: shift.id,
        data: shift.date,
        data_formatada: displayDate,
        hospital: shift.hospital,
        setor: shift.sector || null,
        tipo: shift.type || null,
        status: "active",
        criado_em: new Date(shift.created_at).getTime(),
      };
      localStorage.setItem("da_shift_id", shift.id);
      localStorage.setItem("da_plantao_ativo", JSON.stringify(localShift));
      toast.success("Plantão iniciado com sucesso!");
      nav({ to: "/tipo" });
    } catch (err) {
      console.warn("Supabase indisponível, salvando offline.", err);
      toast.warning("Erro ao salvar plantão. Continuando offline.");

      // Fallback: save only to localStorage with temporary ID
      const tempId = "temp_" + Date.now();
      const localShift = {
        id: tempId,
        data: data || new Date().toISOString().slice(0, 10),
        data_formatada: displayDate,
        hospital: hospitalValue,
        setor: null,
        tipo: null,
        status: "active",
        criado_em: Date.now(),
      };
      localStorage.setItem("da_shift_id", tempId);
      localStorage.setItem("da_plantao_ativo", JSON.stringify(localShift));
      nav({ to: "/tipo" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background simplificado com pointer-events-none para evitar travar inputs */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-ai/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-xl w-full bg-white border border-border rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative z-10">
        <div className="text-center mb-10">
           <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-6">
              <Stethoscope className="h-7 w-7" />
           </div>
           <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground mb-2">INICIAR PLANTÃO</h1>
           <p className="text-muted-foreground text-xs md:text-sm">Configure os dados básicos para começar seu dia.</p>
        </div>

        <div className="space-y-6 md:space-y-8">
           <div className="space-y-2">
              <label htmlFor="shift-date" className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-2">
                 <Calendar className="h-3 w-3" /> DATA DO PLANTÃO
              </label>
              <input 
                id="shift-date"
                type="date" 
                value={data} 
                onChange={(e) => setData(e.target.value)}
                className="w-full bg-secondary/40 border border-border rounded-xl px-5 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white transition-all appearance-none"
              />
           </div>

           <div className="space-y-2">
              <label htmlFor="hospital-name" className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-2">
                 <Building2 className="h-3 w-3" /> HOSPITAL / UNIDADE
              </label>
              <input 
                id="hospital-name"
                type="text" 
                value={hospital} 
                onChange={(e) => setHospital(e.target.value)}
                placeholder="Ex: Hospital Nair Alves de Souza"
                className="w-full bg-secondary/40 border border-border rounded-xl px-5 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white transition-all"
              />
           </div>

           <div className="pt-4">
              <button 
                onClick={handleContinue}
                disabled={saving}
                className="w-full py-5 rounded-2xl bg-primary text-primary-foreground font-extrabold uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <>CONTINUAR <ArrowRight className="h-5 w-5" /></>}
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
