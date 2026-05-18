import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  Building2, Calendar, Plus, ArrowRight, ArchiveRestore, FileText,
  ChevronLeft, X, AlertTriangle, Activity,
} from "lucide-react";
import { toast } from "sonner";
import { storage, type ArchivedShift } from "@/lib/storage";

type Tab = "ativos" | "arquivados" | "novo";

export const Route = createFileRoute("/plantoes")({
  component: PlantoesPage,
  head: () => ({ meta: [{ title: "Plantões — DOUTOR AJUDA" }] }),
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const raw = search.tab;
    if (raw === "ativos" || raw === "arquivados" || raw === "novo") return { tab: raw };
    return {};
  },
});

function PlantoesPage() {
  const nav = useNavigate();
  const { tab } = Route.useSearch();
  const [activeTab, setActiveTab] = useState<Tab>(tab || "ativos");
  const [arquivados, setArquivados] = useState<ArchivedShift[]>([]);
  const [verPassagem, setVerPassagem] = useState<ArchivedShift | null>(null);

  useEffect(() => {
    setArquivados(storage.listArchivedShifts());
  }, []);

  useEffect(() => {
    if (tab) setActiveTab(tab);
  }, [tab]);

  const plantaoAtivo = useMemo(() => {
    const p = storage.getPlantaoAtivo();
    if (!p) return null;
    return p;
  }, []);

  const pacientesAtivo = useMemo(() => storage.getLocalPacientes(), []);

  const continuar = () => nav({ to: "/dashboard" });

  const reabrir = (sh: ArchivedShift) => {
    if (plantaoAtivo) {
      const ok = window.confirm(
        `Você já tem o plantão "${plantaoAtivo.setor || plantaoAtivo.tipo}" ativo. ` +
        `Reabrir vai ARQUIVÁ-LO e restaurar este. Continuar?`
      );
      if (!ok) return;
      // Arquiva o ativo antes
      storage.archiveCurrentShift();
    }
    const success = storage.reopenArchivedShift(sh.shift_id);
    if (success) {
      toast.success(`Plantão de ${sh.setor} reaberto.`);
      nav({ to: "/dashboard" });
    } else {
      toast.error("Falha ao reabrir o plantão.");
    }
  };

  const novoPlantao = () => nav({ to: "/iniciar-plantao" });

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-elevated border-b border-border sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <button
            onClick={() => nav({ to: "/" })}
            className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-widest"
          >
            <ChevronLeft className="h-4 w-4" /> INÍCIO
          </button>
          <h1 className="text-sm font-extrabold uppercase tracking-[0.2em]">PLANTÕES</h1>
          <div className="w-16" />
        </div>
        <nav className="max-w-5xl mx-auto px-6 pb-2 flex gap-1" role="tablist">
          {(["ativos", "arquivados", "novo"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={activeTab === t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-t-xl text-[10px] font-black uppercase tracking-widest transition-colors ${
                activeTab === t
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {t === "ativos" && "ATIVO"}
              {t === "arquivados" && `ARQUIVADOS (${arquivados.length})`}
              {t === "novo" && "+ NOVO PLANTÃO"}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {activeTab === "ativos" && (
          <section>
            {plantaoAtivo ? (
              <div className="bg-elevated border border-border rounded-[2.5rem] p-8 shadow-lg">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary mb-2">
                      <Activity className="h-3 w-3" /> PLANTÃO ATIVO
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">{plantaoAtivo.setor || plantaoAtivo.tipo || "—"}</h2>
                    <p className="text-xs font-bold text-muted-foreground mt-1">
                      <Building2 className="inline h-3 w-3 mr-1" />
                      {plantaoAtivo.hospital || "—"}
                      <span className="mx-2 opacity-40">·</span>
                      <Calendar className="inline h-3 w-3 mr-1" />
                      {plantaoAtivo.data_formatada || plantaoAtivo.data}
                    </p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                    ATIVO
                  </div>
                </div>

                <div className="bg-secondary/30 border border-border rounded-2xl p-4 mb-6">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">PACIENTES NESTE PLANTÃO</p>
                  <p className="text-3xl font-black">{pacientesAtivo.length}</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={continuar}
                    className="flex-1 py-4 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                  >
                    CONTINUAR <ArrowRight className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => {
                      const ok = window.confirm("Encerrar este plantão? Os dados serão arquivados.");
                      if (ok) nav({ to: "/dashboard", search: { encerrar: "1" } as any });
                    }}
                    className="px-6 py-4 rounded-xl border border-destructive/30 bg-elevated text-destructive text-[10px] font-black uppercase tracking-widest hover:bg-destructive/10 transition-all"
                  >
                    ENCERRAR
                  </button>
                </div>
              </div>
            ) : (
              <EmptyCard
                icon={<AlertTriangle className="h-10 w-10" />}
                title="NENHUM PLANTÃO ATIVO"
                description="Você ainda não iniciou um plantão. Comece um novo para usar o sistema."
                action={{ label: "+ INICIAR PLANTÃO", onClick: novoPlantao }}
              />
            )}
          </section>
        )}

        {activeTab === "arquivados" && (
          <section>
            {arquivados.length === 0 ? (
              <EmptyCard
                icon={<ArchiveRestore className="h-10 w-10" />}
                title="NENHUM PLANTÃO ARQUIVADO"
                description="Plantões encerrados aparecem aqui automaticamente. Você pode reabrir qualquer um."
              />
            ) : (
              <div className="space-y-3">
                {arquivados.map((sh) => (
                  <ArquivadoCard
                    key={sh.shift_id}
                    shift={sh}
                    onReabrir={() => reabrir(sh)}
                    onVerPassagem={() => setVerPassagem(sh)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "novo" && (
          <section>
            <div className="bg-elevated border-2 border-dashed border-border rounded-[2.5rem] p-12 text-center">
              <div className="h-20 w-20 rounded-[2rem] bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6">
                <Plus className="h-10 w-10" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight mb-2">INICIAR NOVO PLANTÃO</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-8">
                {plantaoAtivo
                  ? "Você já tem um plantão ativo. Iniciar um novo o arquivará automaticamente."
                  : "Configure data, hospital e setor para começar."}
              </p>
              <button
                onClick={novoPlantao}
                className="px-10 py-4 rounded-2xl bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 hover:-translate-y-1 transition-all inline-flex items-center gap-3"
              >
                <Plus className="h-4 w-4" /> INICIAR NOVO PLANTÃO
              </button>
            </div>
          </section>
        )}
      </main>

      {verPassagem && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setVerPassagem(null)}>
          <div className="bg-elevated w-full max-w-2xl rounded-[2.5rem] border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <header className="px-8 py-6 border-b border-border bg-secondary/30 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest">PASSAGENS DO PLANTÃO</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{verPassagem.setor} · {verPassagem.data_formatada}</p>
              </div>
              <button onClick={() => setVerPassagem(null)} className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              {verPassagem.snapshot.passagens.length === 0 ? (
                <p className="text-xs italic text-muted-foreground text-center py-8">Nenhuma passagem registrada neste plantão.</p>
              ) : (
                verPassagem.snapshot.passagens.map((p: any, i: number) => (
                  <div key={i} className="mb-4 p-4 bg-secondary/30 rounded-2xl border border-border">
                    <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground">{p.content || JSON.stringify(p)}</pre>
                  </div>
                ))
              )}
              <div className="mt-6 border-t border-border pt-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">RESUMO DO PLANTÃO ARQUIVADO</p>
                <ul className="text-[11px] text-muted-foreground space-y-1">
                  <li>· {verPassagem.snapshot.pacientes.length} pacientes</li>
                  <li>· {verPassagem.snapshot.evolucoes.length} evoluções</li>
                  <li>· {verPassagem.snapshot.prescricoes.length} prescrições</li>
                  <li>· Encerrado em {new Date(verPassagem.encerrado_em).toLocaleString("pt-BR")}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyCard({ icon, title, description, action }: {
  icon: any; title: string; description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="bg-elevated border-2 border-dashed border-border rounded-[2.5rem] p-12 text-center">
      <div className="h-20 w-20 rounded-[2rem] bg-secondary/50 text-muted-foreground/60 flex items-center justify-center mx-auto mb-6">
        {icon}
      </div>
      <h2 className="text-lg font-black uppercase tracking-tight mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-8 py-3 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest shadow-lg hover:-translate-y-0.5 transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function ArquivadoCard({ shift, onReabrir, onVerPassagem }: {
  shift: ArchivedShift; onReabrir: () => void; onVerPassagem: () => void;
}) {
  const total = shift.snapshot.pacientes.length;
  return (
    <div className="bg-elevated border border-border rounded-3xl p-6 shadow-sm hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">
            <Calendar className="h-3 w-3" />
            {shift.data_formatada || shift.data}
            <span className="opacity-40">·</span>
            <Building2 className="h-3 w-3" />
            {shift.hospital || "—"}
          </div>
          <h3 className="text-lg font-black uppercase tracking-tight truncate">{shift.setor || shift.tipo || "—"}</h3>
          <p className="text-[10px] font-bold text-muted-foreground mt-1">
            {total} paciente(s) · {shift.snapshot.evolucoes.length} evolução(ões) · encerrado em {new Date(shift.encerrado_em).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onVerPassagem}
            className="px-4 py-2.5 rounded-xl border border-border text-[10px] font-black uppercase tracking-widest hover:bg-secondary transition-all flex items-center gap-2"
          >
            <FileText className="h-3 w-3" /> VER PASSAGEM
          </button>
          <button
            onClick={onReabrir}
            className="px-4 py-2.5 rounded-xl bg-navy text-white text-[10px] font-black uppercase tracking-widest hover:-translate-y-0.5 transition-all flex items-center gap-2"
          >
            <ArchiveRestore className="h-3 w-3" /> REABRIR
          </button>
        </div>
      </div>
    </div>
  );
}
