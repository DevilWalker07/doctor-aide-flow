import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  ChevronLeft, Send, Copy, Save, FileText, 
  Loader2, CheckCircle2, User, Building2, 
  Stethoscope, ArrowRight, ClipboardList
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getPatientById, createReferral } from "@/lib/db";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { VITE_CLINICAL_AGENTS_URL } from "@/lib/clinicalAgentsConfig";

export const Route = createFileRoute("/encaminhamento/$id")({
  component: EncaminhamentoPage,
  head: () => ({ meta: [{ title: "Gerar Encaminhamento — DOUTOR AJUDA" }] }),
});

const DESTINATIONS = [
  { id: "ubs", label: "UBS — Unidade Básica de Saúde" },
  { id: "caps_ad", label: "CAPS AD — Centro de Atenção Psicossocial Álcool e Drogas" },
  { id: "ambulatorio", label: "Ambulatório especializado" },
  { id: "especialista", label: "Especialista (especificar especialidade)" },
  { id: "fisioterapia", label: "Fisioterapia" },
  { id: "nutricao", label: "Nutrição / Nutrólogo" },
  { id: "servico_social", label: "Serviço Social" },
  { id: "regulacao", label: "Regulação / Transferência" },
  { id: "outros", label: "Outros" },
];

const REGULACAO_OPTIONS = [
  "Hospital de referência",
  "UTI regional",
  "Hospital secundário",
  "Vaga zero (urgência)",
  "Avaliação em centro especializado"
];

function EncaminhamentoPage() {
  const { id } = useParams({ from: "/encaminhamento/$id" });
  const nav = useNavigate();
  const { userId } = useSupabaseUser();
  const [paciente, setPaciente] = useState<any>(null);
  const [step, setStep] = useState(1);
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);
  const [specialty, setSpecialty] = useState("");
  const [specialistName, setSpecialistName] = useState("");
  const [regulacaoDest, setRegulacaoDest] = useState("");
  const [reason, setReason] = useState("");
  const [referralText, setReferralText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      try {
        if (id.startsWith("temp_")) throw new Error("Local");
        const p = await getPatientById(id, userId!);
        setPaciente({ name: p.name, bed: p.bed, ...p });
      } catch (err) {
        const existing = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
        const p = existing.find((x: any) => x.id === id);
        if (p) setPaciente({ name: p.nome || p.name, bed: p.leito || p.bed, ...p });
      }
    }
    load();
  }, [id, userId]);

  const handleGenerate = async () => {
    if (!paciente || !reason) {
       toast.error("Por favor, informe o motivo do encaminhamento.");
       return;
    }
    setIsGenerating(true);
    try {
      const response = await fetch(`${VITE_CLINICAL_AGENTS_URL}/generate-referral`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: paciente,
          destinations: selectedDestinations.map(d => DESTINATIONS.find(opt => opt.id === d)?.label),
          specialty: selectedDestinations.includes("especialista") ? specialty : null,
          specialist_name: specialistName,
          regulacao_dest: selectedDestinations.includes("regulacao") ? regulacaoDest : null,
          reason: reason,
          data_plantao: format(new Date(), "dd/MM/yyyy")
        }),
      });

      if (!response.ok) throw new Error("Falha ao gerar encaminhamento");
      const result = await response.json();
      setReferralText(result.referral_text || "");
      setStep(2);
      toast.success("Texto gerado com sucesso!");
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(referralText);
    toast.success("Texto copiado!");
  };

  const handleSave = async () => {
    if (!userId) return;
    try {
      if (!id.startsWith("temp_")) {
        await createReferral({
          patient_id: id,
          destinations: selectedDestinations,
          specialty: specialty || undefined,
          reason: reason,
          content: referralText
        }, userId);
        toast.success("Encaminhamento salvo!");
      } else {
        throw new Error("Local fallback");
      }
    } catch (err) {
      console.warn("Salvando encaminhamento localmente", err);
      const enc = {
        patient_id: id,
        date: new Date().toISOString(),
        text: referralText
      };
      const existing = JSON.parse(localStorage.getItem("da_encaminhamentos") || "[]");
      localStorage.setItem("da_encaminhamentos", JSON.stringify([...existing, enc]));
      toast.success("Encaminhamento salvo localmente!");
    }
  };

  if (!paciente) return null;

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="bg-white border-b border-border sticky top-0 z-30 shadow-sm overflow-hidden">
        <div className="absolute top-0 left-0 w-1 bg-primary h-full" />
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <button onClick={() => nav({ to: "/paciente/$id", params: { id } })} className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary transition-all">
                 <ChevronLeft className="h-5 w-5" />
              </button>
              <div>
                 <h1 className="text-xl font-black text-foreground tracking-tight uppercase">ENCAMINHAMENTO</h1>
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{paciente.name} · LEITO {paciente.bed}</p>
              </div>
           </div>
           {step === 2 && (
             <div className="flex items-center gap-3">
                <button onClick={handleSave} className="px-6 py-2.5 rounded-xl border border-border text-[10px] font-black uppercase tracking-widest hover:bg-secondary transition-all flex items-center gap-2">
                   <Save className="h-3 w-3" /> SALVAR
                </button>
                <button onClick={handleCopy} className="px-6 py-2.5 rounded-xl bg-navy text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-navy/20 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                   <Copy className="h-3 w-3" /> COPIAR
                </button>
             </div>
           )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
         {step === 1 ? (
           <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <Section title="DESTINO DO ENCAMINHAMENTO" icon={<Building2 className="h-5 w-5" />}>
                 <div className="grid sm:grid-cols-2 gap-3">
                    {DESTINATIONS.map(dest => (
                       <label key={dest.id} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${selectedDestinations.includes(dest.id) ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'bg-white border-border hover:border-primary/40'}`}>
                          <input 
                            type="checkbox" 
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                            checked={selectedDestinations.includes(dest.id)}
                            onChange={(e) => {
                               if (e.target.checked) setSelectedDestinations([...selectedDestinations, dest.id]);
                               else setSelectedDestinations(selectedDestinations.filter(d => d !== dest.id));
                            }}
                          />
                          <span className="text-xs font-bold text-foreground uppercase tracking-tight">{dest.label}</span>
                       </label>
                    ))}
                 </div>

                 {selectedDestinations.includes("especialista") && (
                    <div className="grid md:grid-cols-2 gap-4 mt-6 animate-in zoom-in-95 duration-300">
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">ESPECIALIDADE *</label>
                          <input value={specialty} onChange={e => setSpecialty(e.target.value.toUpperCase())} className={inputCls} placeholder="EX: CARDIOLOGIA" />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">NOME DO ESPECIALISTA (OPCIONAL)</label>
                          <input value={specialistName} onChange={e => setSpecialistName(e.target.value.toUpperCase())} className={inputCls} />
                       </div>
                    </div>
                 )}

                 {selectedDestinations.includes("regulacao") && (
                    <div className="mt-6 animate-in zoom-in-95 duration-300 space-y-1">
                       <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">PARA ONDE? (REGULAÇÃO)</label>
                       <select value={regulacaoDest} onChange={e => setRegulacaoDest(e.target.value)} className={inputCls}>
                          <option value="">SELECIONE O DESTINO</option>
                          {REGULACAO_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                       </select>
                    </div>
                 )}
              </Section>

              <Section title="MOTIVO E CONTEXTO" icon={<ClipboardList className="h-5 w-5" />}>
                 <textarea 
                   value={reason} 
                   onChange={e => setReason(e.target.value.toUpperCase())}
                   className={textareaCls} 
                   placeholder="Descreva brevemente o motivo do encaminhamento, exames pendentes ou cuidados específicos..." 
                   rows={6}
                 />
                 <div className="pt-8 flex justify-center">
                    <button 
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="px-12 py-5 rounded-[2rem] bg-primary text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 transition-all flex items-center gap-4 disabled:opacity-50"
                    >
                       {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                       {isGenerating ? "GERANDO ENCAMINHAMENTO..." : "GERAR TEXTO"}
                    </button>
                 </div>
              </Section>
           </div>
         ) : (
           <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
              <Section title="TEXTO DO ENCAMINHAMENTO" icon={<FileText className="h-5 w-5" />}>
                 <textarea 
                   value={referralText} 
                   onChange={e => setReferralText(e.target.value)}
                   className={textareaCls + " h-[600px] font-mono leading-relaxed"} 
                   placeholder="Aguardando geração..." 
                 />
                 <div className="pt-8 flex justify-between gap-4">
                    <button onClick={() => setStep(1)} className="px-8 py-4 rounded-2xl border-2 border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-secondary transition-all">
                       EDITAR DESTINOS
                    </button>
                    <div className="flex gap-3">
                       <button onClick={handleSave} className="px-8 py-4 rounded-2xl border-2 border-primary/20 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 transition-all">
                          SALVAR EM HISTÓRICO
                       </button>
                       <button onClick={handleCopy} className="px-10 py-4 rounded-2xl bg-navy text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-navy/20 transition-all flex items-center gap-2">
                          <Copy className="h-4 w-4" /> COPIAR TEXTO
                       </button>
                    </div>
                 </div>
              </Section>
           </div>
         )}
      </main>
    </div>
  );
}

function Section({ title, icon, children }: { title: string, icon: any, children: any }) {
  return (
    <div className="bg-white border border-border rounded-[3rem] p-8 md:p-12 shadow-sm">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground border border-border/50">
          {icon}
        </div>
        <h2 className="text-[10px] font-black tracking-[0.25em] uppercase text-foreground">{title}</h2>
      </div>
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}

const inputCls = "w-full bg-secondary/30 border border-border rounded-xl px-5 py-4 text-xs font-bold placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white transition-all uppercase";
const textareaCls = "w-full bg-secondary/30 border border-border rounded-2xl px-5 py-5 text-sm font-bold placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white leading-relaxed transition-all uppercase";
