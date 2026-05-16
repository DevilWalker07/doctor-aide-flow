import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
// Local sign-out: clears local user data only.
const useLocalSignOut = () => ({
  signOut: async (_opts?: { redirectUrl?: string }) => {
    localStorage.clear();
    window.location.href = "/";
  },
});
import { 
  Stethoscope, ArrowRight, Play, Settings2, 
  Activity, ShieldCheck, Clock, Users, AlertTriangle,
  History, LogOut
} from "lucide-react";
import { useState, useEffect } from "react";
import { getActiveShift, getClosedShifts, type Shift, updateShift, getHandoffsByShift, closeShift } from "@/lib/db";
import { getProfile } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { X, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";

import { storage } from "@/lib/storage";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({ meta: [{ title: "Doutor Ajuda — Seu Assistente Clínico" }] }),
});

function HomePage() {
  const { userId } = useSupabaseUser();
  const [nomeMedico, setNomeMedico] = useState(() => storage.getNomeMedico());
  const [plantaoAtivo, setPlantaoAtivo] = useState<any>(null);
  const [closedShifts, setClosedShifts] = useState<Shift[]>([]);
  const [stats, setStats] = useState({ pacientes: 0, pendencias: 0 });
  const [selectedHandoff, setSelectedHandoff] = useState<string | null>(null);
  const [showReopenModal, setShowReopenModal] = useState<Shift | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const nav = useNavigate();
  const { signOut } = useLocalSignOut();

  useEffect(() => {
    if (!userId) return;

    async function load() {
      // 1. Load doctor name
      try {
        const profile = await getProfile(userId!);
        if (profile?.name) {
          setNomeMedico(profile.name);
          storage.setNomeMedico(profile.name);
        }
      } catch {
        // Fallback already handled by useState initial value
      }

      // 2. Load active shift
      await refreshActiveShift();

      // 3. Load closed shifts
      try {
        const closed = await getClosedShifts(userId!, 5);
        setClosedShifts(closed);
      } catch { /* ignore */ }

      // 4. Stats from Supabase if active
      const activeId = storage.getShiftId();
      if (activeId && !activeId.startsWith("temp_")) {
        try {
          const { data: pats } = await supabase
            .from('patients')
            .select('id, pending_issues')
            .eq('shift_id', activeId)
            .eq('user_id', userId!);
          if (pats) {
            let pends = 0;
            pats.forEach(p => pends += (p.pending_issues?.length || 0));
            setStats({ pacientes: pats.length, pendencias: pends });
          }
        } catch { /* ignore */ }
      }
    }

    async function refreshActiveShift() {
      try {
        const shift = await getActiveShift(userId!);
        if (shift) {
          const ctx = {
            id: shift.id,
            data: shift.date,
            data_formatada: formatDate(shift.date),
            hospital: shift.hospital,
            setor: shift.sector || null,
            tipo: shift.type || null,
            status: shift.status,
          };
          setPlantaoAtivo(ctx);
          localStorage.setItem("da_plantao_ativo", JSON.stringify(ctx));
          storage.setShiftId(shift.id);
        } else {
          setPlantaoAtivo(null);
          storage.clearShiftId();
          localStorage.removeItem("da_plantao_ativo");
        }
      } catch {
        const raw = localStorage.getItem("da_plantao_ativo");
        if (raw) setPlantaoAtivo(JSON.parse(raw));
      }
    }

    load();
  }, [userId]);

  const handleViewHandoff = async (shiftId: string) => {
    try {
      const handoffs = await getHandoffsByShift(shiftId, userId!);
      if (handoffs && handoffs.length > 0) {
        setSelectedHandoff(handoffs[0].content);
      } else {
        toast.error("Nenhuma passagem encontrada para este plantão.");
      }
    } catch {
      toast.error("Erro ao carregar passagem.");
    }
  };

  const handleReopen = async (shift: Shift) => {
    if (!userId) return;
    setIsProcessing(true);
    try {
      if (plantaoAtivo) {
        await closeShift(plantaoAtivo.id, userId);
      }
      await updateShift(shift.id, { status: 'active' }, userId);
      
      storage.setShiftId(shift.id);
      const ctx = {
        id: shift.id,
        data: shift.date,
        data_formatada: formatDate(shift.date),
        hospital: shift.hospital,
        setor: shift.sector,
        status: 'active'
      };
      localStorage.setItem("da_plantao_ativo", JSON.stringify(ctx));
      
      toast.success("Plantão reaberto!");
      nav({ to: "/dashboard" });
    } catch (err) {
      toast.error("Erro ao reabrir plantão.");
    } finally {
      setIsProcessing(false);
      setShowReopenModal(null);
    }
  };

  const handleCopy = () => {
    if (selectedHandoff) {
      navigator.clipboard.writeText(selectedHandoff);
      toast.success("Copiado!");
    }
  };

  const handleLogout = async () => {
    try {
      storage.clearSession();
      await signOut({ redirectUrl: "/login" });
      toast.success("Sessão encerrada.");
      nav({ to: "/login" });
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-ai/5 rounded-full blur-[100px] translate-y-1/4 -translate-x-1/4" />
      </div>

      <header className="relative px-8 py-10 flex items-center justify-between max-w-7xl mx-auto w-full z-10">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-navy text-white flex items-center justify-center shadow-2xl shadow-navy/20">
            <Stethoscope className="h-6 w-6" />
          </div>
          <div>
            <span className="block font-black tracking-tight text-foreground text-xl leading-none">DOUTOR AJUDA</span>
            <span className="text-[9px] font-black tracking-[0.3em] uppercase text-muted-foreground mt-1">SISTEMA MÉDICO INTELIGENTE</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/configuracoes" className="h-12 w-12 rounded-2xl bg-white border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all shadow-sm">
            <Settings2 className="h-5 w-5" />
          </Link>
          <button onClick={handleLogout} className="h-12 w-12 rounded-2xl bg-white border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive transition-all shadow-sm">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="relative flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto px-6 py-12 text-center z-10">
        <div className="mb-12 animate-in fade-in zoom-in duration-700">
           <div className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-6">
              BEM-VINDO À FASE 3
           </div>
           <h1 className="text-5xl md:text-8xl font-black tracking-tighter text-foreground mb-6 leading-none">
              EVOLUÇÕES <br /> <span className="text-primary italic">DR(A). {nomeMedico.split(' ')[1] || nomeMedico}</span>
           </h1>
           <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground font-medium leading-relaxed">
              Sua central inteligente para evolução médica, prescrição e passagem de plantão com tecnologia assistida por IA.
           </p>
        </div>

        <div className="flex flex-col gap-4 w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
           <button 
             onClick={() => nav({ to: "/iniciar-plantao" })}
             className="group relative flex items-center justify-center gap-4 py-6 px-10 rounded-[2.5rem] bg-navy text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl shadow-navy/30 hover:shadow-navy/50 hover:-translate-y-1 transition-all"
           >
              <Play className="h-5 w-5 fill-current" /> INICIAR NOVO PLANTÃO
           </button>

           {plantaoAtivo && (
             <div className="bg-white border-2 border-primary/20 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4">
                   <div className="flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                   </div>
                </div>
                <div className="text-left space-y-4">
                   <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary">PLANTÃO EM ANDAMENTO</span>
                   </div>
                   <div>
                      <h3 className="text-2xl font-black text-foreground uppercase leading-tight">{plantaoAtivo.setor || plantaoAtivo.sector || "Clínica Médica"}</h3>
                      <p className="text-xs font-bold text-muted-foreground uppercase">{plantaoAtivo.data_formatada || plantaoAtivo.data}</p>
                   </div>
                   <div className="flex items-center gap-6 pt-2">
                      <div className="flex items-center gap-2">
                         <Users className="h-4 w-4 text-muted-foreground" />
                         <span className="text-xs font-black">{stats.pacientes} PACIENTES</span>
                      </div>
                      <div className="flex items-center gap-2">
                         <AlertTriangle className="h-4 w-4 text-amber-500" />
                         <span className="text-xs font-black text-amber-600">{stats.pendencias} PENDÊNCIAS</span>
                      </div>
                   </div>
                   <button 
                     onClick={() => nav({ to: "/dashboard" })}
                     className="w-full mt-4 py-4 rounded-2xl bg-secondary text-foreground font-black uppercase tracking-widest text-[10px] hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2"
                   >
                      CONTINUAR PLANTÃO <ArrowRight className="h-4 w-4" />
                   </button>
                </div>
             </div>
           )}

           {closedShifts.length > 0 && (
             <div className="bg-white border border-border rounded-[2.5rem] p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                   <History className="h-4 w-4 text-muted-foreground" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">PLANTÕES ANTERIORES</span>
                </div>
                 <div className="space-y-3">
                    {closedShifts.map(s => (
                      <div key={s.id} className="p-4 rounded-2xl bg-secondary/30 border border-border flex flex-col gap-3 text-left">
                         <div>
                            <p className="text-xs font-black text-foreground uppercase tracking-tight">{s.sector || "Setor"}</p>
                            <p className="text-[9px] text-muted-foreground font-bold uppercase">{formatDate(s.date)} · {s.hospital}</p>
                         </div>
                         <div className="flex gap-2">
                            <button 
                              onClick={() => handleViewHandoff(s.id)}
                              className="flex-1 py-2 rounded-lg bg-white border border-border text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-secondary transition-all"
                            >
                               <ExternalLink className="h-3 w-3" /> VER PASSAGEM
                            </button>
                            <button 
                              onClick={() => setShowReopenModal(s)}
                              className="flex-1 py-2 rounded-lg bg-primary/5 border border-primary/20 text-primary text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-primary/10 transition-all"
                            >
                               <RefreshCw className="h-3 w-3" /> REABRIR
                            </button>
                         </div>
                      </div>
                    ))}
                 </div>
             </div>
           )}

           <button 
             onClick={() => nav({ to: "/configuracoes" })}
             className="py-5 rounded-[2.5rem] bg-white border border-border text-muted-foreground font-black uppercase tracking-[0.2em] text-[10px] hover:bg-secondary transition-all"
           >
              CONFIGURAÇÕES DO PERFIL
           </button>
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl opacity-60">
           {[
             { icon: Activity, label: "CHECKLIST DINÂMICO", desc: "Controle total do setor" },
             { icon: ShieldCheck, label: "CÁLCULOS CLÍNICOS", desc: "Segurança na prescrição" },
             { icon: Stethoscope, label: "PADRÃO-OURO", desc: "Evoluções em caixa alta" },
           ].map((f) => (
             <div key={f.label} className="flex flex-col items-center gap-2">
                <div className="h-10 w-10 rounded-xl bg-secondary/50 flex items-center justify-center text-muted-foreground mb-1">
                   <f.icon className="h-5 w-5" />
                </div>
                <span className="font-black text-[9px] uppercase tracking-widest text-navy">{f.label}</span>
                <span className="text-[9px] font-bold text-muted-foreground uppercase">{f.desc}</span>
             </div>
           ))}
        </div>
      </main>

      <footer className="py-12 text-center relative z-10">
         <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.4em]">SISTEMA DESENVOLVIDO PARA DOUTORES · FASE 3.0</p>
      </footer>

      {/* Modal Visualizar Passagem */}
      {selectedHandoff && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b border-border flex justify-between items-center bg-secondary/20">
                 <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">ARQUIVO DE PASSAGEM</h2>
                 <button onClick={() => setSelectedHandoff(null)} className="p-2 hover:bg-white rounded-full transition-all">
                    <X className="h-4 w-4" />
                 </button>
              </div>
              <div className="p-6">
                 <pre className="w-full bg-secondary/30 p-6 rounded-2xl text-[10px] font-bold text-foreground overflow-y-auto max-h-[40vh] whitespace-pre-wrap font-mono leading-relaxed">
                    {selectedHandoff}
                 </pre>
                 <div className="flex gap-3 mt-6">
                    <button onClick={handleCopy} className="flex-1 py-4 rounded-2xl bg-navy text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                       <Copy className="h-4 w-4" /> COPIAR TEXTO
                    </button>
                    <button onClick={() => setSelectedHandoff(null)} className="flex-1 py-4 rounded-2xl bg-secondary text-foreground text-[10px] font-black uppercase tracking-widest">
                       FECHAR
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Modal Reabrir */}
      {showReopenModal && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="p-8 text-center space-y-6">
                 <div className="h-16 w-16 rounded-[2rem] bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <RefreshCw className={`h-8 w-8 ${isProcessing ? 'animate-spin' : ''}`} />
                 </div>
                 <div>
                    <h2 className="text-xl font-black text-foreground uppercase tracking-tight mb-2">REABRIR PLANTÃO?</h2>
                    <p className="text-xs text-muted-foreground font-bold leading-relaxed uppercase">
                       {showReopenModal.sector} · {formatDate(showReopenModal.date)}
                    </p>
                    {plantaoAtivo && (
                      <p className="mt-4 text-[10px] text-destructive font-black uppercase tracking-widest bg-destructive/5 p-3 rounded-xl">
                        O plantão atual será encerrado.
                      </p>
                    )}
                 </div>
                 <div className="flex flex-col gap-3">
                    <button 
                       disabled={isProcessing}
                       onClick={() => handleReopen(showReopenModal)}
                       className="w-full py-4 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20"
                    >
                       {isProcessing ? "PROCESSANDO..." : "SIM, REABRIR"}
                    </button>
                    <button 
                       disabled={isProcessing}
                       onClick={() => setShowReopenModal(null)}
                       className="w-full py-4 rounded-2xl bg-secondary text-foreground text-[10px] font-black uppercase tracking-widest"
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

function formatDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
}
