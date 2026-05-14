import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { 
  Stethoscope, Plus, LayoutGrid, ListFilter, Pill, 
  AlertTriangle, CheckCircle2, UserPlus, FileText, 
  ArrowRight, Activity, Calendar, Building2, User,
  ClipboardList, Search, LogOut
} from "lucide-react";
import { useShift } from "@/hooks/useShift";
import { differenceInDays, parseISO, isValid } from "date-fns";
import { toast } from "sonner";

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
  const { getShift, clearShift } = useShift();
  const [pacientes, setPacientes] = useState<Patient[]>([]);
  const [filter, setFilter] = useState<"todos" | "atb" | "pendencias" | "alta">("todos");

  const shift = getShift();

  useEffect(() => {
    if (!shift) {
      nav({ to: "/iniciar-plantao" });
      return;
    }
    const rawPacientes = localStorage.getItem("da_pacientes");
    if (rawPacientes) {
      try {
        setPacientes(JSON.parse(rawPacientes));
      } catch (e) {
        setPacientes([]);
      }
    }
  }, [nav, shift]);

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

  const handleLogout = () => {
    if (confirm("Encerrar plantão atual?")) {
      clearShift();
      nav({ to: "/" });
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
             <button onClick={handleLogout} className="p-2.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-xl transition-all" title="Encerrar Plantão">
                <LogOut className="h-5 w-5" />
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
                     <button onClick={() => nav({ to: "/paciente/temp", search: { id: p.id } as any })} className="p-3 rounded-xl border border-border text-muted-foreground hover:bg-secondary transition-all">
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
    </div>
  );
}
