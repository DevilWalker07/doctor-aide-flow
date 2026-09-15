import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Copy, LogOut, RefreshCw, Settings2, Stethoscope, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AmbienteMatrix } from "@/components/hub/AmbienteMatrix";
import { PlantaoPanel, type PlantaoAtivoCtx } from "@/components/hub/PlantaoPanel";
import { QuickActions } from "@/components/hub/QuickActions";
import { useAuth } from "@/hooks/useAuth";
import { useEnsureProfile } from "@/hooks/useEnsureProfile";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { closeShift, getActiveShift, getClosedShifts, getHandoffsByShift, getProfile, updateShift, type Shift } from "@/lib/db";
import { storage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  component: HubPage,
  head: () => ({ meta: [{ title: "Doutor Ajuda — Central de Atendimento" }] }),
});

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return d && m && y ? `${d}/${m}/${y}` : dateStr;
}

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function HubPage() {
  const { userId } = useSupabaseUser();
  const nav = useNavigate();
  const { signOut } = useAuth();
  useEnsureProfile();

  const [nomeMedico, setNomeMedico] = useState(() => storage.getNomeMedico());
  const [plantaoAtivo, setPlantaoAtivo] = useState<PlantaoAtivoCtx | null>(null);
  const [closedShifts, setClosedShifts] = useState<Shift[]>([]);
  const [stats, setStats] = useState({ pacientes: 0, pendencias: 0 });
  const [selectedHandoff, setSelectedHandoff] = useState<string | null>(null);
  const [showReopenModal, setShowReopenModal] = useState<Shift | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      try {
        const profile = await getProfile(userId!);
        if (profile?.name && !cancelled) {
          setNomeMedico(profile.name);
          storage.setNomeMedico(profile.name);
        }
      } catch {
        /* localStorage já é a fonte */
      }

      try {
        const shift = await getActiveShift(userId!);
        if (cancelled) return;
        if (shift) {
          const ctx: PlantaoAtivoCtx = { id: shift.id, data: shift.date, data_formatada: formatDate(shift.date), hospital: shift.hospital, setor: shift.sector || null, tipo: shift.type || null };
          setPlantaoAtivo(ctx);
          localStorage.setItem("da_plantao_ativo", JSON.stringify({ ...ctx, status: "active" }));
          storage.setShiftId(shift.id);
        } else {
          setPlantaoAtivo(null);
          storage.clearShiftId();
          localStorage.removeItem("da_plantao_ativo");
        }
      } catch {
        const raw = localStorage.getItem("da_plantao_ativo");
        if (raw && !cancelled) setPlantaoAtivo(JSON.parse(raw));
      }

      try {
        const closed = await getClosedShifts(userId!, 5);
        if (!cancelled) setClosedShifts(closed);
      } catch {
        /* offline */
      }

      const activeId = storage.getShiftId();
      if (activeId && !activeId.startsWith("temp_")) {
        try {
          const { data: pats } = await supabase.from("patients").select("id, pending_issues").eq("shift_id", activeId).eq("user_id", userId!);
          if (pats && !cancelled) {
            setStats({ pacientes: pats.length, pendencias: pats.reduce((acc, p) => acc + (p.pending_issues?.length || 0), 0) });
          }
        } catch {
          /* offline */
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleViewHandoff = async (shiftId: string) => {
    try {
      const handoffs = await getHandoffsByShift(shiftId, userId!);
      if (handoffs?.length) setSelectedHandoff(handoffs[0].content);
      else toast.error("Nenhuma passagem encontrada para este plantão.");
    } catch {
      toast.error("Erro ao carregar passagem.");
    }
  };

  const handleReopen = async (shift: Shift) => {
    if (!userId) return;
    setIsProcessing(true);
    try {
      if (plantaoAtivo) await closeShift(plantaoAtivo.id, userId);
      await updateShift(shift.id, { status: "active" }, userId);
      storage.setShiftId(shift.id);
      localStorage.setItem("da_plantao_ativo", JSON.stringify({ id: shift.id, data: shift.date, data_formatada: formatDate(shift.date), hospital: shift.hospital, setor: shift.sector, tipo: shift.type, status: "active" }));
      if (shift.type) storage.setTipo(shift.type);
      toast.success("Plantão reaberto!");
      nav({ to: "/dashboard" });
    } catch {
      toast.error("Erro ao reabrir plantão.");
    } finally {
      setIsProcessing(false);
      setShowReopenModal(null);
    }
  };

  const handleLogout = async () => {
    storage.clearSession();
    await signOut();
    toast.success("Sessão encerrada.");
    nav({ to: "/login", search: {} });
  };

  const primeiroNome = nomeMedico.replace(/^dr\(a\)\.?\s*/i, "").split(" ")[0] || "Doutor(a)";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-primary/15 blur-[140px]" />
        <div className="absolute -bottom-40 -left-40 h-[420px] w-[420px] rounded-full bg-violet-500/10 blur-[120px]" />
      </div>

      <header className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 shrink-0 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <span className="block font-black tracking-tight text-lg leading-none">DOUTOR AJUDA</span>
            <span className="block text-[9px] font-black tracking-[0.3em] uppercase text-slate-500 mt-1 truncate">Central de atendimento</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/configuracoes" aria-label="Configurações" className="h-11 w-11 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:border-slate-600 transition-colors">
            <Settings2 className="h-5 w-5" />
          </Link>
          <button onClick={handleLogout} aria-label="Sair" className="h-11 w-11 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center justify-center text-slate-400 hover:text-rose-300 hover:border-rose-500/50 transition-colors">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">{saudacao()}</p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-black tracking-tight">
            Dr(a). {primeiroNome}
            <span className="text-slate-500 font-medium">, o que vamos fazer?</span>
          </h1>
        </div>

        <QuickActions />

        <PlantaoPanel plantaoAtivo={plantaoAtivo} stats={stats} closedShifts={closedShifts} onViewHandoff={handleViewHandoff} onReopen={setShowReopenModal} formatDate={formatDate} />

        <AmbienteMatrix />
      </main>

      <footer className="relative z-10 py-8 text-center">
        <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em]">Doutor Ajuda · HNAS Assist</p>
      </footer>

      {selectedHandoff && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em]">Arquivo de passagem</h2>
              <button onClick={() => setSelectedHandoff(null)} aria-label="Fechar" className="p-2 hover:bg-slate-800 rounded-full">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <pre className="w-full bg-slate-950 p-5 rounded-2xl text-[10px] font-bold overflow-y-auto max-h-[40vh] whitespace-pre-wrap font-mono leading-relaxed text-slate-200">{selectedHandoff}</pre>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedHandoff);
                    toast.success("Copiado!");
                  }}
                  className="flex-1 py-3.5 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <Copy className="h-4 w-4" /> Copiar texto
                </button>
                <button onClick={() => setSelectedHandoff(null)} className="flex-1 py-3.5 rounded-2xl bg-slate-800 text-slate-100 text-[10px] font-black uppercase tracking-widest">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReopenModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] w-full max-w-sm p-8 text-center space-y-6 shadow-2xl">
            <div className="h-16 w-16 rounded-[1.5rem] bg-primary/15 text-primary flex items-center justify-center mx-auto">
              <RefreshCw className={`h-8 w-8 ${isProcessing ? "animate-spin" : ""}`} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight mb-2">Reabrir plantão?</h2>
              <p className="text-xs text-slate-400 font-bold uppercase">
                {showReopenModal.sector} · {formatDate(showReopenModal.date)}
              </p>
              {plantaoAtivo && <p className="mt-4 text-[10px] text-rose-300 font-black uppercase tracking-widest bg-rose-500/10 p-3 rounded-xl">O plantão atual será encerrado.</p>}
            </div>
            <div className="flex flex-col gap-3">
              <button disabled={isProcessing} onClick={() => handleReopen(showReopenModal)} className="w-full py-3.5 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                {isProcessing ? "Processando..." : "Sim, reabrir"}
              </button>
              <button disabled={isProcessing} onClick={() => setShowReopenModal(null)} className="w-full py-3.5 rounded-2xl bg-slate-800 text-slate-100 text-[10px] font-black uppercase tracking-widest">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
