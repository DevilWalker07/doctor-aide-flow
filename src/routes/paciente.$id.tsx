import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { 
  ChevronLeft, User, Activity, Pill, AlertTriangle, 
  Calendar, Building2, ClipboardList, FileText, 
  Plus, CheckCircle2, FileUp, Edit3, ArrowRight,
  TrendingUp, Clock, Info, Check
} from "lucide-react";
import { differenceInDays, parseISO, isValid, format, addDays, startOfDay } from "date-fns";
import { toast } from "sonner";
import { getEvolutionsByPatient, savePatient, getPatient } from "@/lib/store";

export const Route = createFileRoute("/paciente/$id")({
  component: PacienteDetailPage,
  head: () => ({ meta: [{ title: "Prontuário do Paciente — DOUTOR AJUDA" }] }),
});

function PacienteDetailPage() {
  const { id } = useParams({ from: "/paciente/$id" });
  const nav = useNavigate();
  const [paciente, setPaciente] = useState<any>(null);
  const [evolutions, setEvolutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const p = getPatient(id);
      if (p) {
        setPaciente(p);
        const evols = await getEvolutionsByPatient(id);
        setEvolutions(evols);
      }
      setLoading(false);
    }
    loadData();
  }, [id]);

  const dihInfo = useMemo(() => {
    if (!paciente?.admissionDate && !paciente?.admission) return null;
    const admissionStr = paciente.admissionDate || paciente.admission;
    const admission = startOfDay(parseISO(admissionStr));
    if (!isValid(admission)) return null;
    const today = startOfDay(new Date());
    const days = differenceInDays(today, admission);
    
    return {
      d: days >= 0 ? `D${days}` : "D0",
      label: days === 0 ? "Admitido hoje" : `Admissão ${format(admission, "dd/MM/yyyy")}`
    };
  }, [paciente]);

  const handleStatusUpdate = async (status: string) => {
    if (!paciente) return;
    const updated = { ...paciente, status };
    await savePatient(updated);
    setPaciente(updated);
    toast.success(status === "alta_provavel" ? "Alta provável marcada!" : "Status atualizado");
  };

  const resolvePendencia = async (pendText: string) => {
    if (!paciente) return;
    const updatedPendencias = (paciente.pendingIssues || []).filter((p: string) => p !== pendText);
    const updated = { ...paciente, pendingIssues: updatedPendencias };
    await savePatient(updated);
    setPaciente(updated);
    toast.success("Pendência resolvida!");
  };

  if (loading) return null;
  if (!paciente) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold mb-4 uppercase tracking-tighter">Paciente não encontrado</h1>
        <Link to="/dashboard" className="text-primary font-black uppercase text-xs tracking-widest border-b-2 border-primary/20 hover:border-primary">Voltar ao Dashboard</Link>
      </div>
    );
  }

  const lastEvolution = evolutions[0];

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Premium Header */}
      <header className="bg-white border-b border-border sticky top-0 z-30 shadow-sm overflow-hidden">
        <div className="absolute top-0 left-0 w-1 bg-primary h-full" />
        <div className="max-w-5xl mx-auto px-6 py-8">
           <div className="flex items-center justify-between mb-6">
              <button onClick={() => nav({ to: "/dashboard" })} className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest">
                 <ChevronLeft className="h-4 w-4" /> VOLTAR AO DASHBOARD
              </button>
              <div className="flex items-center gap-2">
                 <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${paciente.status === 'alta_provavel' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                   {paciente.status === 'alta_provavel' ? 'ALTA PROVÁVEL' : 'INTERNADO'}
                 </span>
              </div>
           </div>

           <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                 <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight mb-2 uppercase">
                    {paciente.name}
                 </h1>
                 <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    <span className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-primary" /> LEITO {paciente.bed}</span>
                    <span className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-secondary" /> {paciente.age} ANOS · {paciente.sex === 'M' ? 'MASCULINO' : 'FEMININO'}</span>
                    <span className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-secondary" /> {paciente.sector}</span>
                 </div>
                 <div className="mt-3 text-[10px] font-black text-primary/60 uppercase tracking-widest flex items-center gap-2">
                    <Calendar className="h-3 w-3" /> {dihInfo?.d} · {dihInfo?.label}
                 </div>
              </div>
              <div className="bg-secondary/30 rounded-2xl px-6 py-4 border border-border">
                 <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">DATA DE ADMISSÃO</div>
                 <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-primary">{dihInfo?.d}</span>
                    <span className="text-xs font-bold text-muted-foreground tracking-tight">{format(parseISO(paciente.admissionDate || paciente.admission), "dd/MM/yyyy")}</span>
                 </div>
              </div>
           </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        
        {/* LISTA DE PROBLEMAS */}
        <Section title="LISTA DE PROBLEMAS" icon={<ClipboardList className="h-5 w-5" />} action={
          <button onClick={() => nav({ to: "/cadastro-manual", search: { id, tipo: 'internado' } as any })} className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest flex items-center gap-1">
             <Edit3 className="h-3 w-3" /> EDITAR
          </button>
        }>
           <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                 <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-4">
                    <div className="h-2 w-2 rounded-full bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]" /> PROBLEMAS ATIVOS
                 </h4>
                 {(paciente.diagnoses?.length > 0 || (paciente.data?.conducta?.dx)) ? (
                   <div className="space-y-2">
                      {paciente.diagnoses?.map((prob: string, i: number) => (
                        <div key={i} className="p-4 bg-white border border-border rounded-xl text-xs font-bold text-foreground shadow-sm uppercase flex items-center gap-2">
                           <div className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" /> {prob}
                        </div>
                      ))}
                      {paciente.data?.conducta?.dx && (
                        <div className="p-4 bg-white border border-border rounded-xl text-xs font-bold text-foreground shadow-sm uppercase flex items-center gap-2">
                           <div className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" /> {paciente.data.conducta.dx}
                        </div>
                      )}
                   </div>
                 ) : (
                   <p className="text-xs italic text-muted-foreground">Nenhum problema ativo listado.</p>
                 )}
              </div>
              <div className="space-y-3">
                 <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-4">
                    <div className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" /> COMORBIDADES CONTROLADAS
                 </h4>
                 <div className="flex flex-wrap gap-2">
                    {paciente.comorbidities?.length > 0 ? (
                      paciente.comorbidities.map((c: string) => (
                        <span key={c} className="px-3 py-2 bg-secondary/50 border border-border rounded-lg text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                           <div className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {c}
                        </span>
                      ))
                    ) : <p className="text-xs italic text-muted-foreground">Nenhuma comorbidade listada.</p>}
                 </div>
              </div>
           </div>
        </Section>

        {/* ANTIBIÓTICOS */}
        <Section title="ANTIBIÓTICOS" icon={<Pill className="h-5 w-5" />}>
           <div className="space-y-8">
              {paciente.data?.abx?.length > 0 ? (
                paciente.data.abx.map((atb: any, i: number) => {
                  const dValue = differenceInDays(startOfDay(new Date()), startOfDay(parseISO(atb.d0)));
                  const dSafe = dValue >= 0 ? dValue : 0;
                  const maxDays = 7;
                  const progressBlocks = 8;
                  const activeBlocks = Math.min(Math.round((dSafe / maxDays) * progressBlocks), progressBlocks);
                  
                  const blocks = "█".repeat(activeBlocks) + "░".repeat(progressBlocks - activeBlocks);
                  const colorClass = dSafe <= 3 ? "text-emerald-500" : dSafe <= 5 ? "text-amber-500" : "text-destructive";
                  
                  return (
                    <div key={i} className="space-y-4">
                       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                             <h3 className="font-black text-foreground uppercase tracking-tight text-lg">{atb.name}</h3>
                             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                {atb.dose} · {atb.via} · {atb.freq}
                             </p>
                          </div>
                          <div className="text-right">
                             <div className="text-2xl font-black text-foreground">D{dSafe}</div>
                             <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                INÍCIO: {format(parseISO(atb.d0), "dd/MM/yyyy")}
                             </p>
                          </div>
                       </div>
                       
                       <div className="space-y-2">
                          <div className={`font-mono text-xl tracking-tighter ${colorClass}`}>
                             {blocks} <span className="text-xs font-black text-muted-foreground ml-2">{dSafe}/7 DIAS</span>
                          </div>
                          <div className="flex justify-between text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                             <span>Início: {format(parseISO(atb.d0), "dd/MM/yyyy")}</span>
                             <span>Término previsto: {format(addDays(parseISO(atb.d0), 7), "dd/MM/yyyy")}</span>
                          </div>
                       </div>

                       {dSafe > 7 && (
                         <div className="flex items-center gap-2 p-3 bg-destructive/5 border border-destructive/10 rounded-xl text-destructive text-[10px] font-bold uppercase tracking-widest">
                            <AlertTriangle className="h-4 w-4" /> ⚠ ATB HÁ MAIS DE 7 DIAS
                         </div>
                       )}
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center bg-secondary/20 rounded-[2rem] border-2 border-dashed border-border">
                   <Pill className="h-8 w-8 text-muted-foreground/30 mb-3" />
                   <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Nenhum antibiótico em uso</p>
                </div>
              )}
           </div>
        </Section>

        {/* LABORATÓRIOS RECENTES */}
        <Section title="LABORATÓRIOS RECENTES" icon={<Activity className="h-5 w-5" />} action={
          <button className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest">Ver todos</button>
        }>
           {paciente.data?.lab ? (
             <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-2xl border border-border">
                <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-primary border border-border shadow-sm shrink-0">
                   <Clock className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                   <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">ÚLTIMO RESULTADO EM {paciente.data.lab.date}</p>
                   <p className="font-bold text-foreground text-sm truncate uppercase tracking-tight">
                      {paciente.data.lab.formatted || "Resultado estruturado disponível."}
                   </p>
                </div>
             </div>
           ) : (
             <p className="text-xs italic text-muted-foreground">Nenhum exame laboratorial registrado.</p>
           )}
        </Section>

        {/* PENDÊNCIAS */}
        <Section title="PENDÊNCIAS" icon={<AlertTriangle className="h-5 w-5" />} action={
           <button onClick={() => nav({ to: "/cadastro-manual", search: { id, tipo: 'internado' } as any })} className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest flex items-center gap-1">
              <Plus className="h-3 w-3" /> Adicionar
           </button>
        }>
           <div className="space-y-3">
              {paciente.pendingIssues?.length > 0 ? (
                paciente.pendingIssues.map((pend: string, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-2xl group transition-all hover:border-amber-400">
                     <div className="flex items-center gap-3 min-w-0">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                        <span className="text-xs font-bold text-amber-900 uppercase tracking-tight truncate">{pend}</span>
                     </div>
                     <button 
                       onClick={() => resolvePendencia(pend)}
                       className="px-3 py-2 rounded-lg bg-white border border-amber-200 text-[10px] font-black text-amber-600 uppercase tracking-widest hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all flex items-center gap-1"
                     >
                        <CheckCircle2 className="h-3.5 w-3.5" /> RESOLVER
                     </button>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600">
                   <CheckCircle2 className="h-4 w-4" />
                   <span className="text-xs font-bold uppercase tracking-widest">Tudo resolvido! Nenhuma pendência ativa.</span>
                </div>
              )}
           </div>
        </Section>

        <div className="grid md:grid-cols-2 gap-8">
           {/* ÚLTIMA EVOLUÇÃO */}
           <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                 <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground border border-border/50">
                    <FileText className="h-5 w-5" />
                 </div>
                 <h2 className="text-[10px] font-black tracking-[0.25em] uppercase text-foreground">ÚLTIMA EVOLUÇÃO</h2>
              </div>
              <div className="bg-white border border-border rounded-[2.5rem] p-8 shadow-sm">
                 {lastEvolution ? (
                   <>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">DATA: {format(parseISO(lastEvolution.createdAt), "dd/MM/yyyy HH:mm")}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed italic mb-6 line-clamp-3">
                         {lastEvolution.text}
                      </p>
                      <button onClick={() => nav({ to: "/evolucao/$id", params: { id } })} className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">
                         VER EVOLUÇÃO COMPLETA
                      </button>
                   </>
                 ) : (
                   <p className="text-xs text-muted-foreground leading-relaxed italic">Nenhuma evolução registrada.</p>
                 )}
              </div>
           </div>

           {/* DOCUMENTOS IMPORTADOS */}
           <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                 <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground border border-border/50">
                    <FileUp className="h-5 w-5" />
                 </div>
                 <h2 className="text-[10px] font-black tracking-[0.25em] uppercase text-foreground">DOCUMENTOS IMPORTADOS</h2>
              </div>
              <div className="bg-white border border-border rounded-[2.5rem] p-8 shadow-sm space-y-4">
                 {paciente.documents?.length > 0 ? (
                   <div className="space-y-2">
                      {paciente.documents.map((doc: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-secondary/20 rounded-xl border border-border">
                           <div className="flex items-center gap-3 min-w-0">
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                 <p className="text-[10px] font-bold text-foreground truncate">{doc.name}</p>
                                 <p className="text-[8px] text-muted-foreground font-black uppercase">{doc.date}</p>
                              </div>
                           </div>
                           <ArrowRight className="h-3 w-3 text-muted-foreground/30" />
                        </div>
                      ))}
                   </div>
                 ) : (
                   <p className="text-xs text-muted-foreground italic mb-4">Nenhum documento anexado.</p>
                 )}
                 <button 
                   onClick={() => nav({ to: "/upload-ia", search: { patient_id: id } as any })}
                   className="w-full py-4 border-2 border-dashed border-border rounded-2xl text-[10px] font-black text-muted-foreground hover:border-primary/40 hover:text-primary transition-all flex flex-col items-center gap-2"
                 >
                    <Plus className="h-5 w-5" /> ADICIONAR DOCUMENTO
                 </button>
              </div>
           </div>
        </div>

        {/* AÇÕES EM DESTAQUE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-12">
           {[
             { label: 'GERAR EVOLUÇÃO', icon: TrendingUp, to: `/evolucao/${id}`, primary: true },
             { label: 'GERAR PRESCRIÇÃO', icon: Pill, to: `/prescricao/${id}` },
             { label: 'GERAR ENCAMINHAMENTO', icon: ArrowRight, to: `/encaminhamento/${id}` },
             { label: 'ADICIONAR DOCUMENTO', icon: FileUp, to: `/upload-ia`, search: { patient_id: id } },
             { label: 'EDITAR PACIENTE', icon: Edit3, to: `/cadastro-manual`, search: { id, tipo: 'internado' } },
             { label: 'MARCAR ALTA PROVÁVEL', icon: Check, onClick: () => handleStatusUpdate('alta_provavel') },
           ].map((action: any) => (
             <button 
               key={action.label}
               onClick={action.onClick || (() => nav({ to: action.to, search: action.search }))}
               className={`flex items-center justify-between p-6 rounded-[2rem] border transition-all hover:-translate-y-1 hover:shadow-xl ${action.primary ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white border-border text-foreground hover:border-primary/40'}`}
             >
                <div className="flex items-center gap-4">
                   <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${action.primary ? 'bg-white/20' : 'bg-secondary'}`}>
                      <action.icon className="h-5 w-5" />
                   </div>
                   <span className="text-[10px] font-black uppercase tracking-widest">{action.label}</span>
                </div>
                <ArrowRight className={`h-4 w-4 ${action.primary ? 'text-white/40' : 'text-muted-foreground/40'}`} />
             </button>
           ))}
        </div>
      </main>

      {/* Footer Nav */}
      <div className="max-w-5xl mx-auto px-6 pb-20 text-center">
         <button onClick={() => nav({ to: "/dashboard" })} className="text-[10px] font-black text-muted-foreground hover:text-foreground uppercase tracking-[0.2em] transition-all flex items-center gap-2 mx-auto border-b border-transparent hover:border-muted-foreground">
            <ChevronLeft className="h-4 w-4" /> VOLTAR AO DASHBOARD
         </button>
      </div>

      {/* Floating Action for Mobile */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
         <button 
           onClick={() => nav({ to: "/evolucao/$id", params: { id } })}
           className="px-10 py-5 rounded-[2rem] bg-navy text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl flex items-center gap-4 hover:scale-105 transition-all"
         >
            <TrendingUp className="h-5 w-5" /> EVOLUIR AGORA
         </button>
      </div>
    </div>
  );
}

function Section({ title, icon, children, action }: { title: string, icon: any, children: any, action?: any }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-6 ml-1">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground border border-border/50">
            {icon}
          </div>
          <h2 className="text-[10px] font-black tracking-[0.25em] uppercase text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      <div className="bg-white border border-border rounded-[3rem] p-8 md:p-12 shadow-sm">
        {children}
      </div>
    </div>
  );
}
