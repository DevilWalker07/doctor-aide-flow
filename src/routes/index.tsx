import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { 
  Stethoscope, ArrowRight, Play, Settings2, 
  Activity, ShieldCheck, Clock, Users, AlertTriangle,
  History, LogOut
} from "lucide-react";
import { useState, useEffect } from "react";
import { getActiveShift, getClosedShifts, type Shift } from "@/lib/db";
import { getProfile } from "@/lib/db";
import { signOut } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({ meta: [{ title: "Doutor Ajuda — Seu Assistente Clínico" }] }),
});

function HomePage() {
  const [nomeMedico, setNomeMedico] = useState("Médico");
  const [plantaoAtivo, setPlantaoAtivo] = useState<any>(null);
  const [closedShifts, setClosedShifts] = useState<Shift[]>([]);
  const [stats, setStats] = useState({ pacientes: 0, pendencias: 0 });
  const nav = useNavigate();

  useEffect(() => {
    async function load() {
      // 1. Load doctor name
      try {
        const profile = await getProfile();
        if (profile?.name) {
          setNomeMedico(profile.name);
          localStorage.setItem("da_nome_medico", profile.name);
        } else {
          const local = localStorage.getItem("da_nome_medico");
          if (local) setNomeMedico(local);
        }
      } catch {
        const local = localStorage.getItem("da_nome_medico");
        if (local) setNomeMedico(local);
      }

      // 2. Load active shift from Supabase, fallback to localStorage
      try {
        const shift = await getActiveShift();
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
          localStorage.setItem("da_shift_id", shift.id);
        } else {
          loadLocalFallback();
        }
      } catch {
        loadLocalFallback();
      }

      // 3. Load closed shifts
      try {
        const closed = await getClosedShifts(5);
        setClosedShifts(closed);
      } catch { /* ignore */ }

      // 4. Stats from localStorage (patients not migrated yet)
      try {
        const pacientes = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
        let pendCount = 0;
        pacientes.forEach((p: any) => {
          pendCount += (p.pendingIssues?.length || 0) + (p.pendencias?.length || 0);
        });
        setStats({ pacientes: pacientes.length, pendencias: pendCount });
      } catch { /* ignore */ }
    }

    function loadLocalFallback() {
      const raw = localStorage.getItem("da_plantao_ativo");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.status === "active") setPlantaoAtivo(parsed);
      }
    }

    load();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Sessão encerrada.");
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
                <div className="space-y-2">
                   {closedShifts.map(s => (
                     <div key={s.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                           <p className="text-xs font-black text-foreground uppercase">{s.sector || "Setor"}</p>
                           <p className="text-[10px] text-muted-foreground font-bold">{formatDate(s.date)} · {s.hospital}</p>
                        </div>
                        <span className="text-[9px] font-black text-muted-foreground uppercase px-3 py-1 bg-secondary rounded-full">ENCERRADO</span>
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
