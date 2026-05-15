import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { 
  Stethoscope, Plus, LayoutGrid, ListFilter, Pill, 
  AlertTriangle, CheckCircle2, UserPlus, FileText, 
  ArrowRight, Activity, Calendar, Building2, User,
  ClipboardList, Search, LogOut
} from "lucide-react";
import { useShift } from "@/hooks/useShift";
import { getPatientsByShift, closeShift, createHandoff } from "@/lib/db";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { differenceInDays, parseISO, isValid, format } from "date-fns";
import { toast } from "sonner";
import { X, Copy, Archive } from "lucide-react";

import { storage } from "@/lib/storage";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — DOUTOR AJUDA" }] }),
});

interface Patient {
  id: string;
  leito: string;
  nome: string;
  idade: string;
  sexo: string;
  motivo_admissao?: string;
  hda?: string;
  lista_de_problemas: { id: string; text: string }[];
  antibioticos: { id: string; nome: string; dose: string; via: string; frequencia: string; dataInicio: string }[];
  medicacoes: { id: string; text: string }[];
  laboratorios: { id: string; data: string; valor: string }[];
  pendencias: { id: string; text: string }[];
  status?: "pendente" | "alta_provavel";
}

function DashboardPage() {
  const nav = useNavigate();
  const { userId } = useSupabaseUser();
  const { getShift, clearShift } = useShift();
  const [pacientes, setPacientes] = useState<Patient[]>([]);
  const [filter, setFilter] = useState<"todos" | "atb" | "pendencias" | "alta">("todos");

  const shift = getShift();

  useEffect(() => {
    if (!userId) return;
    if (!shift) {
      nav({ to: "/iniciar-plantao" });
      return;
    }
    
    async function loadPatients() {
      try {
        const shiftId = storage.getShiftId();
        if (shiftId && !shiftId.startsWith("temp_")) {
          const dbPatients = await getPatientsByShift(shiftId, userId!);
          
          // Map DB models to component state structure
          const mapped = dbPatients.map(p => ({
            id: p.id,
            leito: p.bed || "",
            nome: p.name || "",
            idade: p.age || "",
            sexo: p.sex || "F",
            motivo_admissao: p.reason_for_admission || "",
            hda: p.hda || "",
            lista_de_problemas: (p.problem_list || []).map((t: string) => ({ id: Math.random().toString(), text: t })),
            antibioticos: (p.antibiotics || []).map((a: any) => ({
              id: Math.random().toString(),
              nome: a.nome, dose: a.dose, via: a.via, frequencia: a.frequencia, dataInicio: a.data_inicio || a.dataInicio
            })),
            medicacoes: (p.medications || []).map((t: string) => ({ id: Math.random().toString(), text: t })),
            laboratorios: (p.labs || []).map((l: any) => ({
              id: Math.random().toString(), data: l.data, valor: l.texto_compacto || l.valor
            })),
            pendencias: (p.pending_issues || []).map((t: string) => ({ id: Math.random().toString(), text: t })),
            status: (p.status as any) || "internado"
          }));
          
          setPacientes(mapped);
          return;
        }
        throw new Error("Offline or temp ID");
      } catch (err) {
        console.warn("Failed to load from Supabase, using local", err);
        const localPacientes = storage.getLocalPacientes();
        setPacientes(localPacientes);
      }
    }
    
    loadPatients();
  }, [nav, shift, userId]);

  const stats = useMemo(() => {
    return {
      total: pacientes.length,
      comAtb: pacientes.filter(p => p.antibioticos.length > 0).length,
      pendencias: pacientes.filter(p => p.pendencias.length > 0).length,
      altas: pacientes.filter(p => p.status === "alta_provavel").length,
      exames: pacientes.filter(p => 
        p.pendencias.some(pend => 
          pend.text.toLowerCase().includes("exame") || 
          pend.text.toLowerCase().includes("resultado")
        )
      ).length
    };
  }, [pacientes]);

  const filteredPacientes = useMemo(() => {
    let list = [...pacientes];
    if (filter === "atb") list = list.filter(p => p.antibioticos.length > 0);
    if (filter === "pendencias") list = list.filter(p => p.pendencias.length > 0);
    if (filter === "alta") list = list.filter(p => p.status === "alta_provavel");
    
    // Sort by bed number (numeric)
    return list.sort((a, b) => {
      const numA = parseInt(a.leito.replace(/\D/g, "")) || 0;
      const numB = parseInt(b.leito.replace(/\D/g, "")) || 0;
      return numA - numB;
    });
  }, [pacientes, filter]);

  const calculateDValue = (startDateStr: string) => {
    const start = parseISO(startDateStr);
    if (!isValid(start)) return "D?";
    const diff = differenceInDays(new Date(), start);
    return `D${diff >= 0 ? diff : 0}`; // Regra: D0 no dia de início
  };

  const [showEndModal, setShowEndModal] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  const handleEndShift = async () => {
    if (!userId) return;
    const shiftId = storage.getShiftId();
    if (!shiftId || shiftId.startsWith("temp_")) {
      clearShift();
      nav({ to: "/" });
      return;
    }

    setIsEnding(true);
    try {
      // 1. Gerar texto da passagem
      let text = `PASSAGEM DE PLANTÃO - ${shift.setor}\n`;
      text += `DATA: ${shift.data_formatada}\n`;
      text += `PROFISSIONAL: ${storage.getNomeMedico()}\n\n`;
      
      pacientes.forEach(p => {
        text += `${p.leito} - ${p.nome} (${p.idade}A, ${p.sexo})\n`;
        text += `DX: ${p.motivo_admissao || "N/A"}\n`;
        if (p.antibioticos.length > 0) {
          text += `ATB: ${p.antibioticos.map(a => `${a.nome} (${calculateDValue(a.dataInicio)})`).join(", ")}\n`;
        }
        if (p.pendencias.length > 0) {
          text += `PENDÊNCIAS: ${p.pendencias.map(pend => pend.text).join(" · ")}\n`;
        }
        text += `-------------------\n`;
      });

      // 2. Salvar handoff
      await createHandoff({ shift_id: shiftId, content: text }, userId);

      // 3. Encerrar no Supabase
      await closeShift(shiftId, userId);

      // 4. Limpar e navegar
      storage.clearSession();
      
      toast.success("Plantão encerrado. Dados arquivados.");
      nav({ to: "/" });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao encerrar plantão.");
    } finally {
      setIsEnding(false);
      setShowEndModal(false);
    }
  };

  if (!shift) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header Premium */}
      <header className="bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20">
                <Stethoscope className="h-5 w-5" />
             </div>
             <div>
                <h1 className="text-sm font-extrabold tracking-tight">DASHBOARD DO PLANTÃO</h1>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                   <Building2 className="h-3 w-3" /> {shift.setor || "Sem Setor"} · <Calendar className="h-3 w-3" /> {shift.data_formatada}
                </p>
             </div>
          </div>

          <div className="flex items-center gap-3">
             <button 
               onClick={() => nav({ to: "/novo-paciente" })}
               className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-[10px] font-extrabold uppercase tracking-widest shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all"
             >
                <Plus className="h-4 w-4" /> ADICIONAR PACIENTE
             </button>
              <button onClick={() => setShowEndModal(true)} className="p-2.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-xl transition-all" title="Encerrar Plantão">
                 <Archive className="h-5 w-5" />
              </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        
        {/* Resumo Dinâmico */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { key: "todos", label: "TOTAL", value: stats.total, color: "text-foreground", bg: "bg-white", icon: ListFilter },
            { key: "atb", label: "COM ATB", value: stats.comAtb, color: "text-ai", bg: "bg-ai/5", icon: Pill },
            { key: "pendencias", label: "PENDÊNCIAS", value: stats.pendencias, color: "text-amber-500", bg: "bg-amber-500/5", icon: AlertTriangle },
            { key: "alta", label: "ALTAS", value: stats.altas, color: "text-emerald-500", bg: "bg-emerald-500/5", icon: CheckCircle2 },
            { key: "todos", label: "EXAMES", value: stats.exames, color: "text-primary", bg: "bg-primary/5", icon: Activity },
          ].map((s) => (
            <button 
              key={s.label}
              onClick={() => setFilter(s.key as any)}
              className={`p-6 rounded-[2rem] border border-border flex flex-col items-center gap-2 transition-all hover:scale-105 hover:shadow-xl ${filter === s.key ? "ring-2 ring-primary/40 bg-white" : s.bg}`}
            >
              <s.icon className={`h-5 w-5 ${s.color} mb-1`} />
              <span className={`text-[10px] font-extrabold uppercase tracking-widest ${s.color}`}>{s.label}</span>
              <span className="text-3xl font-black">{s.value.toString().padStart(2, '0')}</span>
            </button>
          ))}
        </div>

        {/* Filtros e Busca */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
           <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-2xl border border-border w-full sm:w-auto">
              {[
                { id: "todos", label: "TODOS" },
                { id: "atb", label: "COM ATB" },
                { id: "pendencias", label: "PENDÊNCIAS" },
                { id: "alta", label: "ALTA PROVÁVEL" },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as any)}
                  className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${filter === f.id ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {f.label}
                </button>
              ))}
           </div>
           
           <div className="flex gap-3 w-full sm:w-auto">
              <button onClick={() => nav({ to: "/novo-paciente" })} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-primary text-primary-foreground font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">
                 <UserPlus className="h-4 w-4" /> ADICIONAR
              </button>
              <button onClick={() => nav({ to: "/passagem" })} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 rounded-2xl border border-border text-foreground font-bold uppercase tracking-widest text-[10px] hover:bg-secondary">
                 <FileText className="h-4 w-4" /> GERAR PASSAGEM
              </button>
           </div>
        </div>

        {/* Lista de Pacientes */}
        <div className="space-y-4">
           {filteredPacientes.length > 0 ? (
             filteredPacientes.map((p) => (
               <div 
                 key={p.id}
                 className={`group relative bg-white border border-border rounded-[2.5rem] p-8 flex flex-col lg:flex-row items-center gap-8 transition-all hover:shadow-2xl hover:shadow-primary/5 hover:border-primary/20 overflow-hidden ${
                   p.status === "alta_provavel" ? "border-l-[6px] border-l-emerald-500" :
                   p.pendencias.length > 0 ? "border-l-[6px] border-l-amber-500" : ""
                 }`}
               >
                  <div className="flex items-center gap-6 flex-1 min-w-0">
                     <div className="h-16 w-16 rounded-2xl bg-secondary flex flex-col items-center justify-center shrink-0">
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">LEITO</span>
                        <span className="text-xl font-black text-foreground">{p.leito.replace("L", "")}</span>
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                           <h3 className="font-extrabold text-lg text-foreground truncate uppercase">{p.nome}</h3>
                           <span className="px-2 py-0.5 rounded-md bg-secondary text-[10px] font-bold text-muted-foreground">{p.idade}A · {p.sexo}</span>
                        </div>
                        <p className="text-xs font-bold text-muted-foreground truncate uppercase tracking-tight">
                           {p.motivo_admissao || p.lista_de_problemas.slice(0, 2).map(prob => prob.text).join(" · ") || "Sem diagnóstico principal"}
                        </p>
                     </div>
                  </div>

                  <div className="flex-1 w-full lg:w-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                           <Pill className="h-3 w-3 text-ai" /> ANTIBIÓTICOS
                        </div>
                        <div className="flex flex-wrap gap-2">
                           {p.antibioticos.length > 0 ? (
                             p.antibioticos.map(atb => (
                               <span key={atb.id} className="px-3 py-1.5 rounded-lg bg-ai/10 text-ai text-[10px] font-bold uppercase">
                                  {atb.nome} — {calculateDValue(atb.dataInicio)}
                               </span>
                             ))
                           ) : (
                             <span className="text-[10px] text-muted-foreground/60 italic font-medium">Nenhum ATB em uso</span>
                           )}
                        </div>
                     </div>
                     <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                           <AlertTriangle className="h-3 w-3 text-amber-500" /> PENDÊNCIAS
                        </div>
                        <div className="space-y-1">
                           {p.pendencias.length > 0 ? (
                             p.pendencias.slice(0, 1).map(pend => (
                               <div key={pend.id} className="text-[10px] font-bold text-amber-600 truncate flex items-center gap-2 uppercase">
                                  ⚠ {pend.text}
                               </div>
                             ))
                           ) : (
                             <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-tight flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Nenhuma pendência
                             </span>
                           )}
                           {p.pendencias.length > 1 && (
                             <div className="text-[9px] font-bold text-muted-foreground uppercase">
                                + {p.pendencias.length - 1} OUTRAS
                             </div>
                           )}
                        </div>
                     </div>
                  </div>

                  <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
                     <button onClick={() => nav({ to: "/evolucao/$id", params: { id: p.id } })} className="flex-1 lg:flex-none px-4 py-3 rounded-xl bg-navy text-white text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all">
                        EVOLUIR
                     </button>
                     <button onClick={() => nav({ to: "/prescricao", params: { id: p.id } as any })} className="flex-1 lg:flex-none px-4 py-3 rounded-xl border border-border text-[10px] font-bold uppercase tracking-widest hover:bg-secondary">
                        PRESCRIÇÃO
                     </button>
                      <button onClick={() => nav({ to: "/paciente/$id", params: { id: p.id } })} className="p-3 rounded-xl border border-border text-muted-foreground hover:bg-secondary transition-all">
                         <User className="h-4 w-4" />
                      </button>
                  </div>
               </div>
             ))
           ) : (
             <div className="flex flex-col items-center justify-center py-24 px-6 bg-white border-2 border-dashed border-border rounded-[3rem] text-center">
                <div className="h-20 w-20 rounded-[2rem] bg-secondary/50 flex items-center justify-center mb-6">
                   <User className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <h3 className="text-xl font-extrabold text-foreground mb-2">NENHUM PACIENTE NESTE PLANTÃO</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-8">
                   Seu dashboard está vazio. Comece adicionando o primeiro paciente do dia.
                </p>
                <button 
                  onClick={() => nav({ to: "/novo-paciente" })}
                  className="px-10 py-4 rounded-2xl bg-primary text-primary-foreground font-bold uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 hover:-translate-y-1 transition-all flex items-center gap-3"
                >
                   <Plus className="h-4 w-4" /> ADICIONAR PRIMEIRO PACIENTE
                </button>
             </div>
           )}
        </div>
      </main>

      {/* Modal de Encerramento */}
      {showEndModal && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
              <div className="p-8 pb-0 flex justify-between items-start">
                 <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
                    <Archive className="h-6 w-6" />
                 </div>
                 <button onClick={() => !isEnding && setShowEndModal(false)} className="p-2 hover:bg-secondary rounded-full transition-all">
                    <X className="h-5 w-5 text-muted-foreground" />
                 </button>
              </div>
              
              <div className="p-8 pt-6 space-y-6">
                 <div>
                    <h2 className="text-2xl font-black text-foreground uppercase tracking-tight mb-2">ENCERRAR PLANTÃO</h2>
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
                       {shift.setor} — {shift.data_formatada}
                    </p>
                    <div className="mt-4 px-4 py-3 rounded-2xl bg-secondary/50 border border-border flex items-center gap-3">
                       <Users className="h-4 w-4 text-primary" />
                       <span className="text-xs font-black text-foreground uppercase tracking-widest">{pacientes.length} PACIENTES ATIVOS</span>
                    </div>
                 </div>

                 <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                    Ao encerrar, todos os dados serão arquivados e uma passagem de plantão será gerada automaticamente. 
                    Esta ação <span className="text-destructive font-bold uppercase">não pode ser desfeita</span>.
                 </p>

                 <div className="flex flex-col gap-3 pt-2">
                    <button 
                       disabled={isEnding}
                       onClick={handleEndShift}
                       className="w-full py-4 rounded-2xl bg-destructive text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-destructive/20 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0"
                    >
                       {isEnding ? "ARQUIVANDO..." : "ENCERRAR E ARQUIVAR"}
                    </button>
                    <button 
                       disabled={isEnding}
                       onClick={() => setShowEndModal(false)}
                       className="w-full py-4 rounded-2xl bg-secondary text-foreground text-[10px] font-black uppercase tracking-widest hover:bg-border transition-all"
                    >
                       CANCELAR
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
