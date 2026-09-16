import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Copy, LogIn, LogOut, RefreshCw, Settings2, WifiOff, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LocalPicker } from "@/components/hub/LocalPicker";
import { PlantaoPanel, type PlantaoAtivoCtx } from "@/components/hub/PlantaoPanel";
import { QuickActions } from "@/components/hub/QuickActions";
import { useAuth } from "@/hooks/useAuth";
import { useEnsureProfile } from "@/hooks/useEnsureProfile";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import {
  closeShift,
  getActiveShift,
  getClosedShifts,
  getHandoffsByShift,
  getProfile,
  updateShift,
  type Shift,
} from "@/lib/db";
import { nomeExibicao } from "@/lib/format";
import { storage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  component: HubPage,
  head: () => ({ meta: [{ title: "Medfluxo — Central de Atendimento" }] }),
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
  const auth = useAuth();
  const { signOut } = auth;
  useEnsureProfile();

  const [nomeMedico, setNomeMedico] = useState(() => storage.getNomeMedico());
  // Lê o cache local de forma síncrona: assim a tela já nasce preenchida e o
  // esqueleto não fica eterno quando a rede pendura (não rejeita, só não volta).
  const [plantaoAtivo, setPlantaoAtivo] = useState<PlantaoAtivoCtx | null>(() => {
    try {
      const raw = localStorage.getItem("da_plantao_ativo");
      return raw ? (JSON.parse(raw) as PlantaoAtivoCtx) : null;
    } catch {
      return null;
    }
  });
  const [closedShifts, setClosedShifts] = useState<Shift[]>([]);
  const [stats, setStats] = useState({ pacientes: 0, pendencias: 0 });
  const [selectedHandoff, setSelectedHandoff] = useState<string | null>(null);
  const [showReopenModal, setShowReopenModal] = useState<Shift | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [ultimoAmbiente] = useState(() => {
    try {
      return storage.getUltimoAmbiente();
    } catch {
      return null;
    }
  });

  useEffect(() => {
    // Sem conta não existe plantão a carregar.
    if (!userId || (auth.configured && !auth.session)) return;
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
          const ctx: PlantaoAtivoCtx = {
            id: shift.id,
            data: shift.date,
            data_formatada: formatDate(shift.date),
            hospital: shift.hospital,
            setor: shift.sector || null,
            tipo: shift.type || null,
          };
          setPlantaoAtivo(ctx);
          localStorage.setItem("da_plantao_ativo", JSON.stringify({ ...ctx, status: "active" }));
          storage.setShiftId(shift.id);
        } else {
          setPlantaoAtivo(null);
          storage.clearShiftId();
          localStorage.removeItem("da_plantao_ativo");
        }
      } catch {
        // Supabase fora do ar: o app continua, só avisa que está local.
        if (!cancelled) setOffline(true);
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
          const { data: pats } = await supabase
            .from("patients")
            .select("id, pending_issues")
            .eq("shift_id", activeId)
            .eq("user_id", userId!);
          if (pats && !cancelled) {
            setStats({
              pacientes: pats.length,
              pendencias: pats.reduce((acc, p) => acc + (p.pending_issues?.length || 0), 0),
            });
          }
        } catch {
          if (!cancelled) setOffline(true);
        }
      }
    }

    // Não há estado de carregamento: a tela nasce com o que está em cache e o
    // card só aparece quando há plantão de verdade. Um esqueleto aqui prometia
    // conteúdo que pode não existir — e ficava preso quando o cliente do
    // Supabase pendurava sem rejeitar.
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, auth.configured, auth.session]);

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
      localStorage.setItem(
        "da_plantao_ativo",
        JSON.stringify({
          id: shift.id,
          data: shift.date,
          data_formatada: formatDate(shift.date),
          hospital: shift.hospital,
          setor: shift.sector,
          tipo: shift.type,
          status: "active",
        }),
      );
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

  const primeiroNome =
    nomeExibicao(nomeMedico.replace(/^dr\(a\)\.?\s*/i, "").split(" ")[0]) || "Doutor(a)";
  // Sem conta o médico usa documentos, copiloto e exames; o plantão é que
  // exige login, porque é ali que entram dados de paciente.
  const precisaDeConta = auth.configured && !auth.session;

  return (
    <div className="bg-background min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/logo.png"
            alt=""
            aria-hidden="true"
            className="h-11 w-11 shrink-0 rounded-2xl object-cover"
          />
          <div className="min-w-0">
            <span className="t-title text-foreground block">Medfluxo</span>
            <span className="t-label text-muted-foreground block truncate font-normal">
              Assistente de plantão
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/configuracoes"
            aria-label="Configurações"
            className="touch-target border-border bg-card text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl border transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <Settings2 className="h-5 w-5" aria-hidden="true" />
          </Link>
          {precisaDeConta ? (
            <Link
              to="/login"
              search={{}}
              data-testid="hub-entrar"
              className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center gap-2 rounded-2xl px-4 text-base font-bold focus-visible:ring-2 focus-visible:outline-none"
            >
              <LogIn className="h-5 w-5" aria-hidden="true" /> Entrar
            </Link>
          ) : (
            <button
              onClick={handleLogout}
              aria-label="Sair da conta"
              className="touch-target border-border bg-card text-muted-foreground focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl border transition-colors hover:text-rose-600 dark:hover:text-rose-300 focus-visible:ring-2 focus-visible:outline-none"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <div>
          <p className="t-eyebrow text-primary">{saudacao()}</p>
          <h1 className="t-display text-foreground mt-1">
            {precisaDeConta ? "Bem-vindo ao Medfluxo" : `Dr(a). ${primeiroNome}`}
          </h1>
        </div>

        {offline && (
          <div
            role="status"
            data-testid="hub-offline"
            className="border-border bg-secondary text-muted-foreground flex items-center gap-3 rounded-2xl border px-4 py-3"
          >
            <WifiOff className="h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="t-body">Trabalhando offline — seus dados ficam neste aparelho.</p>
          </div>
        )}

        {/* 1. Retomar o que já estava acontecendo — o caminho mais usado. */}
        <PlantaoPanel
          plantaoAtivo={plantaoAtivo}
          stats={stats}
          closedShifts={closedShifts}
          ultimoAmbiente={ultimoAmbiente}
          onViewHandoff={handleViewHandoff}
          onReopen={setShowReopenModal}
          formatDate={formatDate}
        />

        {/* 2. As quatro ações. As três primeiras funcionam sem conta. */}
        <QuickActions precisaDeConta={precisaDeConta} />

        {/* 3. Abrir um plantão novo. */}
        <LocalPicker precisaDeConta={precisaDeConta} />
      </main>

      <footer className="py-8 text-center">
        <p className="t-label text-muted-foreground font-normal">Medfluxo</p>
      </footer>

      {selectedHandoff && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm sm:p-6">
          <div className="bg-card border-border w-full max-w-lg overflow-hidden rounded-3xl border shadow-2xl">
            <div className="border-border flex items-center justify-between border-b p-5">
              <h2 className="t-title text-foreground">Arquivo de passagem</h2>
              <button
                onClick={() => setSelectedHandoff(null)}
                aria-label="Fechar"
                className="touch-target hover:bg-secondary focus-visible:ring-ring inline-flex items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="p-5">
              <pre className="bg-background text-foreground max-h-[40vh] w-full overflow-y-auto rounded-2xl p-5 font-mono text-[0.8125rem] leading-relaxed whitespace-pre-wrap">
                {selectedHandoff}
              </pre>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedHandoff);
                    toast.success("Copiado!");
                  }}
                  className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex min-h-[3rem] flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Copy className="h-5 w-5" aria-hidden="true" /> Copiar texto
                </button>
                <button
                  onClick={() => setSelectedHandoff(null)}
                  className="bg-secondary text-foreground focus-visible:ring-ring min-h-[3rem] flex-1 rounded-2xl text-base font-bold focus-visible:ring-2 focus-visible:outline-none"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReopenModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm sm:p-6">
          <div className="bg-card border-border w-full max-w-sm space-y-6 rounded-3xl border p-8 text-center shadow-2xl">
            <div className="bg-primary/15 text-primary mx-auto flex h-16 w-16 items-center justify-center rounded-3xl">
              <RefreshCw
                className={`h-8 w-8 ${isProcessing ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
            </div>
            <div>
              <h2 className="t-display text-foreground">Reabrir plantão?</h2>
              <p className="t-body text-muted-foreground mt-2">
                {showReopenModal.sector} · {formatDate(showReopenModal.date)}
              </p>
              {plantaoAtivo && (
                <p className="t-body mt-4 rounded-xl bg-rose-500/10 p-3 text-rose-700 dark:text-rose-300">
                  O plantão atual será encerrado.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <button
                disabled={isProcessing}
                onClick={() => handleReopen(showReopenModal)}
                className="bg-primary text-primary-foreground focus-visible:ring-ring min-h-[3rem] w-full rounded-2xl text-base font-bold focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
              >
                {isProcessing ? "Processando..." : "Sim, reabrir"}
              </button>
              <button
                disabled={isProcessing}
                onClick={() => setShowReopenModal(null)}
                className="bg-secondary text-foreground focus-visible:ring-ring min-h-[3rem] w-full rounded-2xl text-base font-bold focus-visible:ring-2 focus-visible:outline-none"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
