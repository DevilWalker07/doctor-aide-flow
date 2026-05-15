import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { 
  ChevronLeft, Sparkles, Copy, Save, FileText, 
  Loader2, Pill, Activity, AlertTriangle, 
  Calendar, ArrowRight, Check
} from "lucide-react";
import { differenceInDays, parseISO, isValid, format, startOfDay } from "date-fns";
import { toast } from "sonner";
import { getPatientById, createEvolution } from "@/lib/db";
import { VITE_CLINICAL_AGENTS_URL } from "@/lib/clinicalAgentsConfig";
import { storage } from "@/lib/storage";

export const Route = createFileRoute("/evolucao/$id")({
  component: EvolucaoPage,
  head: () => ({ meta: [{ title: "Gerar Evolução Clínica — DOUTOR AJUDA" }] }),
});

const TEMPLATES: Record<string, string> = {
  enfermaria_clinica: `EVOLUÇÃO MÉDICA — [DATA]

# LISTA DE PROBLEMAS:
1. [problema]

# ADMISSÃO:
[motivo e contexto]

# EVOLUÇÃO:
[evolução clínica atual]

# AVALIAÇÃO ESPECIALISTA:
[interconsultas se houver]

# HISTÓRICO DE ANTIBIOTICOTERAPIA:
[ATB: nome dose via freq — D[N] DE [TOTAL] — INÍCIO [DATA]]

# AO EXAME FÍSICO:
ESTADO GERAL: [geral]
ACV: [acv]
AR: [ar]
ABDOME: [abdome]
EXTREMIDADES: [extremidades]

# EXAMES COMPLEMENTARES:
>> LABORATÓRIO ([DATA]):
[Hb X | Ht X | Leuco X | PCR X | Creat X | ...]

>> IMAGEM/OUTRO:
[laudos se houver]

# CONDUTAS:
[condutas]

# PENDÊNCIAS:
[pendencias]`,

  enfermaria_pediatrica: `EVOLUÇÃO PEDIÁTRICA — [DATA]

# LISTA DE PROBLEMAS:
1. [problema]

# DADOS DO PACIENTE:
PESO: [X] KG | IDADE: [X MESES / X ANOS]

# ADMISSÃO:
[motivo]

# EVOLUÇÃO:
[evolução]

# AO EXAME FÍSICO:
ESTADO GERAL: [geral]
ACV: [acv]
AR: [ar]
ABDOME: [abdome]
HIDRATAÇÃO: [hidratação]
NEUROLÓGICO: [neuro]

# EXAMES COMPLEMENTARES:
>> LABORATÓRIO ([DATA]):
[resultados]

# CONDUTAS:
[condutas]

# PENDÊNCIAS:
[pendencias]`,

  uti: `EVOLUÇÃO UTI — [DATA]

# LISTA DE PROBLEMAS:
1. [problema]

# ADMISSÃO:
[motivo e data]

# EVOLUÇÃO / ESTADO ATUAL:
[estado clínico]

# VENTILAÇÃO MECÂNICA:
MODO: [modo] | FiO2: [X]% | PEEP: [X] | VC: [X] | FR: [X]
SpO2: [X]% | PaO2/FiO2: [X]

# HEMODINÂMICA:
PA: [X]x[X] | FC: [X] | MAP: [X]
DVA: [drogas vasoativas e doses]

# SEDAÇÃO / ANALGESIA:
[medicamentos e doses]

# BALANÇO HÍDRICO 24H:
ENTRADAS: [X] ML | SAÍDAS: [X] ML | BALANÇO: [+/-X] ML

# HISTÓRICO DE ANTIBIOTICOTERAPIA:
[ATB com D]

# AO EXAME FÍSICO:
[sistemas]

# EXAMES COMPLEMENTARES:
>> LABORATÓRIO ([DATA]):
[resultados]

# CONDUTAS:
[condutas]

# PENDÊNCIAS:
[pendencias]`,

  upa: `EVOLUÇÃO UPA — [DATA] — [HORA]

QUEIXA PRINCIPAL: [queixa]

# HISTÓRIA CLÍNICA:
[HDA resumida]

# AO EXAME FÍSICO:
[sistemas principais]

# EXAMES REALIZADOS:
[resultados]

# HIPÓTESES DIAGNÓSTICAS:
1. [hipótese]

# CONDUTA:
[conduta imediata]

# DESFECHO:
[ ] ALTA  [ ] INTERNAÇÃO  [ ] TRANSFERÊNCIA  [ ] ÓBITO`,

  ubs: `CONSULTA AMBULATORIAL — [DATA]

# MOTIVO DA CONSULTA:
[queixa]

# HISTÓRIA / EVOLUÇÃO:
[anamnese]

# AO EXAME FÍSICO:
[exame]

# HIPÓTESES DIAGNÓSTICAS:
1. [hipótese]

# CONDUTAS:
[receitas, exames solicitados, encaminhamentos]

# RETORNO:
[prazo]`
};

function EvolucaoPage() {
  const { id } = useParams({ from: "/evolucao/$id" });
  const nav = useNavigate();
  const { userId } = useSupabaseUser();
  const [paciente, setPaciente] = useState<any>(null);
  const [tipoUnidade, setTipoUnidade] = useState<string>("enfermaria_clinica");
  const [evolutionText, setEvolutionText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      try {
        if (id.startsWith("temp_")) throw new Error("Local");
        const p = await getPatientById(id, userId!);
        const mapped = {
          name: p.name,
          bed: p.bed,
          admissionDate: p.admission_date,
          pendingIssues: p.pending_issues || [],
          data: {
            abx: (p.antibiotics || []).map(a => ({
              name: a.nome, d0: a.data_inicio
            })),
            lab: (p.labs?.length > 0) ? { 
              formatted: p.labs[0].texto_compacto 
            } : null,
            resp: p.physical_exam || {} // Fallback simple mapping for UI
          }
        };
        setPaciente(mapped);
      } catch (err) {
        const existing = storage.getLocalPacientes();
        const p = existing.find((x: any) => x.id === id);
        if (p) {
          setPaciente({
            name: p.nome || p.name,
            bed: p.leito || p.bed,
            admissionDate: p.data_admissao || p.admissionDate,
            pendingIssues: (p.pendencias || []).map((t: any) => t.text || t),
            data: {
              abx: (p.antibioticos || []).map((a: any) => ({
                name: a.nome, d0: a.dataInicio || a.data_inicio
              })),
              lab: (p.laboratorios?.length > 0) ? {
                formatted: p.laboratorios[0].valor || p.laboratorios[0].texto_compacto
              } : null
            }
          });
        }
      }
    }
    load();
    
    const savedTipo = storage.getTipo();
    if (savedTipo) setTipoUnidade(savedTipo);
  }, [id, userId]);

  const dih = useMemo(() => {
    if (!paciente?.admissionDate && !paciente?.admission) return 0;
    const admission = startOfDay(parseISO(paciente.admissionDate || paciente.admission));
    if (!isValid(admission)) return 0;
    return differenceInDays(startOfDay(new Date()), admission);
  }, [paciente]);

  const handleGenerate = async () => {
    if (!paciente) return;
    setIsGenerating(true);
    try {
      const plantaoAtivo = storage.getPlantaoAtivo();
      const dataPlantao = plantaoAtivo?.date || format(new Date(), "yyyy-MM-dd");

      const response = await fetch(`${VITE_CLINICAL_AGENTS_URL}/generate-evolution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: paciente,
          tipo_unidade: tipoUnidade,
          template: TEMPLATES[tipoUnidade] || TEMPLATES.enfermaria_clinica,
          data_plantao: dataPlantao,
          preferences: {
            uppercase: true,
            lab_format: "compact_inline",
            atb_day_rule: storage.getAtbDayRule()
          }
        }),
      });

      if (!response.ok) throw new Error("Falha na resposta do servidor");
      const result = await response.json();
      setEvolutionText(result.evolution_text || "");
      toast.success("Evolução gerada com sucesso!");
    } catch (error: any) {
      console.error("Erro ao gerar evolução", error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!evolutionText) return;
    navigator.clipboard.writeText(evolutionText);
    toast.success("Copiado para a área de transferência!");
  };

  const handleSave = async () => {
    if (!evolutionText || !userId) return;
    setIsSaving(true);
    try {
      const shiftId = storage.getShiftId();
      if (shiftId && !shiftId.startsWith("temp_") && !id.startsWith("temp_")) {
        await createEvolution({
          patient_id: id,
          shift_id: shiftId,
          content: evolutionText
        }, userId);
        toast.success("Evolução salva!");
      } else {
        throw new Error("Local fallback");
      }
    } catch (error) {
      console.warn("Salvando evolução localmente", error);
      const shiftId = storage.getShiftId() || "unknown";
      const existing = JSON.parse(localStorage.getItem("da_evolucoes") || "[]");
      existing.push({
        patient_id: id,
        shift_id: shiftId,
        content: evolutionText,
        created_at: new Date().toISOString()
      });
      localStorage.setItem("da_evolucoes", JSON.stringify(existing));
      toast.success("Evolução salva localmente!");
    } finally {
      setIsSaving(false);
      nav({ to: "/paciente/$id", params: { id } });
    }
  };

  if (!paciente) return null;

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="bg-white border-b border-border sticky top-0 z-30 shadow-sm overflow-hidden">
        <div className="absolute top-0 left-0 w-1 bg-navy h-full" />
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <button onClick={() => nav({ to: "/paciente/$id", params: { id } })} className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary transition-all">
                 <ChevronLeft className="h-5 w-5" />
              </button>
              <div>
                 <h1 className="text-xl font-black text-foreground tracking-tight uppercase">{paciente.name}</h1>
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">LEITO {paciente.bed} · D{dih} · {tipoUnidade.replace('_', ' ').toUpperCase()}</p>
              </div>
           </div>
           <div className="flex items-center gap-3">
              <button onClick={handleSave} disabled={!evolutionText || isSaving} className="px-6 py-2.5 rounded-xl border border-border text-[10px] font-black uppercase tracking-widest hover:bg-secondary transition-all flex items-center gap-2 disabled:opacity-50">
                 {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} SALVAR
              </button>
              <button onClick={handleCopy} disabled={!evolutionText} className="px-6 py-2.5 rounded-xl bg-navy text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-navy/20 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50">
                 <Copy className="h-3 w-3" /> COPIAR
              </button>
           </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
         <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8">
            
            {/* PAINEL LATERAL */}
            <aside className="space-y-6 order-2 lg:order-1">
               <SectionCard title="DADOS CLÍNICOS" icon={<Activity className="h-4 w-4" />}>
                  <div className="space-y-6">
                     <div>
                        <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">LABS RECENTES</h4>
                        {paciente.data?.lab ? (
                           <div className="p-4 bg-secondary/30 rounded-2xl border border-border text-[11px] font-bold text-foreground leading-relaxed uppercase">
                              {paciente.data.lab.formatted || "Aguardando resultados."}
                           </div>
                        ) : <p className="text-[10px] italic text-muted-foreground">Nenhum laboratório.</p>}
                     </div>

                     <div>
                        <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">ANTIBIÓTICOS</h4>
                        {paciente.data?.abx?.length > 0 ? (
                           <div className="space-y-2">
                              {paciente.data.abx.map((atb: any, i: number) => (
                                 <div key={i} className="flex justify-between items-center p-3 bg-white border border-border rounded-xl">
                                    <span className="text-[10px] font-black text-foreground uppercase">{atb.name}</span>
                                    <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded">D{differenceInDays(startOfDay(new Date()), startOfDay(parseISO(atb.d0)))}</span>
                                 </div>
                              ))}
                           </div>
                        ) : <p className="text-[10px] italic text-muted-foreground">Sem ATB.</p>}
                     </div>

                     <div>
                        <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">PENDÊNCIAS</h4>
                        <div className="space-y-2">
                           {paciente.pendingIssues?.length > 0 ? (
                              paciente.pendingIssues.map((p: string, i: number) => (
                                 <div key={i} className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[10px] font-bold text-amber-900 uppercase">
                                    <AlertTriangle className="h-3 w-3 text-amber-500" /> {p}
                                 </div>
                              ))
                           ) : <p className="text-[10px] italic text-muted-foreground text-emerald-600 font-bold uppercase tracking-widest flex items-center gap-2"><Check className="h-3 w-3" /> Nenhuma pendência.</p>}
                        </div>
                     </div>
                  </div>
               </SectionCard>

               <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => nav({ to: `/prescricao/${id}` })} className="flex flex-col items-center justify-center p-6 bg-white border border-border rounded-3xl hover:border-primary hover:bg-primary/5 transition-all group">
                     <Pill className="h-6 w-6 text-muted-foreground group-hover:text-primary mb-2" />
                     <span className="text-[9px] font-black uppercase tracking-widest">PRESCRIÇÃO</span>
                  </button>
                  <button onClick={() => nav({ to: "/dashboard" })} className="flex flex-col items-center justify-center p-6 bg-white border border-border rounded-3xl hover:border-primary hover:bg-primary/5 transition-all group">
                     <ArrowRight className="h-6 w-6 text-muted-foreground group-hover:text-primary mb-2" />
                     <span className="text-[9px] font-black uppercase tracking-widest">PASSAGEM</span>
                  </button>
               </div>
            </aside>

            {/* ÁREA PRINCIPAL */}
            <div className="space-y-6 order-1 lg:order-2">
               <div className="bg-white border border-border rounded-[2.5rem] p-8 shadow-sm flex flex-col min-h-[600px]">
                  <div className="flex items-center justify-between mb-8">
                     <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-ai/10 flex items-center justify-center text-ai border border-ai/20">
                           <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                           <h2 className="text-xs font-black uppercase tracking-[0.2em]">GERADOR DE EVOLUÇÃO IA</h2>
                           <p className="text-[10px] font-bold text-muted-foreground uppercase">{tipoUnidade.replace('_', ' ')}</p>
                        </div>
                     </div>
                     <button 
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="px-8 py-4 rounded-2xl bg-ai text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-ai/20 hover:shadow-ai/40 hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center gap-3"
                     >
                        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {isGenerating ? "GERANDO..." : "GERAR EVOLUÇÃO"}
                     </button>
                  </div>

                  <div className="flex-1 relative">
                     {isGenerating && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-3xl border border-dashed border-ai/40">
                           <Loader2 className="h-12 w-12 text-ai animate-spin mb-6" />
                           <p className="text-xs font-black uppercase tracking-[0.2em] text-ai animate-pulse">ESTRUTURANDO PRONTUÁRIO...</p>
                        </div>
                     )}
                     <textarea
                        value={evolutionText}
                        onChange={(e) => setEvolutionText(e.target.value)}
                        placeholder="Clique em 'GERAR EVOLUÇÃO' para iniciar o rascunho com IA ou digite aqui..."
                        className="w-full h-full min-h-[500px] bg-secondary/20 border border-border rounded-3xl p-8 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-navy/20 custom-scrollbar uppercase"
                     />
                  </div>
               </div>

               {tipoUnidade === 'uti' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <MiniStat label="MODO VM" value={paciente.data?.resp?.modo || '-'} />
                     <MiniStat label="FiO2" value={paciente.data?.resp?.fio2 ? `${paciente.data.resp.fio2}%` : '-'} />
                     <MiniStat label="PEEP" value={paciente.data?.resp?.peep || '-'} />
                     <MiniStat label="FR" value={paciente.data?.resp?.vmFr || '-'} />
                  </div>
               )}
            </div>

         </div>
      </main>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string, icon: any, children: any }) {
  return (
    <div className="bg-white border border-border rounded-[2rem] overflow-hidden shadow-sm">
      <header className="px-6 py-4 border-b border-border bg-secondary/20 flex items-center gap-3">
        <div className="text-muted-foreground">{icon}</div>
        <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground">{title}</h3>
      </header>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-white border border-border rounded-2xl p-4 text-center shadow-sm">
       <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
       <p className="text-lg font-black text-foreground">{value}</p>
    </div>
  );
}
