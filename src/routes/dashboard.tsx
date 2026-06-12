import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Plus, Pill, AlertTriangle, CheckCircle2, UserPlus, FileText,
  User, Users, Search, X, Archive, Stethoscope,
} from "lucide-react";
import { useShift } from "@/hooks/useShift";
import { getPatientsByShift, closeShift, createHandoff } from "@/lib/db";
import { hasSupabaseConfig } from "@/lib/supabase";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { differenceInDays, parseISO, isValid } from "date-fns";
import { toast } from "sonner";
import { computeGravidade, gravidadeOrder, maxDiasAtb, type Gravidade } from "@/lib/gravidade";
import { getATBsWithAlert, type AlertLevel } from "@/lib/atbAlerts";
import ShiftBadge from "@/components/ShiftBadge";
import ThemeToggle from "@/components/ThemeToggle";
import { storage } from "@/lib/storage";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — Plantonista" }] }),
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
  antibioticos: {
    id: string;
    nome: string;
    dose: string;
    via: string;
    frequencia: string;
    dataInicio: string;
    data_fim?: string;
    status?: string;
  }[];
  medicacoes: { id: string; text: string }[];
  laboratorios: { id: string; data: string; valor: string }[];
  pendencias: { id: string; text: string }[];
  status?: "pendente" | "alta_provavel";
}

/* ───────────── Estilos de gravidade (refeitos pro novo design system) ───────────── */
const GRAV_DOT: Record<Gravidade, string> = {
  critico: "bg-red-500",
  grave: "bg-amber-500",
  moderado: "bg-sky-500",
  leve: "bg-emerald-500",
};
const GRAV_LABEL: Record<Gravidade, string> = {
  critico: "Crítico",
  grave: "Grave",
  moderado: "Moderado",
  leve: "Leve",
};
const GRAV_BAR: Record<Gravidade, string> = {
  critico: "before:bg-red-500",
  grave: "before:bg-amber-500",
  moderado: "before:bg-sky-500",
  leve: "before:bg-emerald-500",
};

const ATB_PILL: Record<AlertLevel, string> = {
  ok: "bg-accent text-accent-foreground",
  yellow: "bg-amber-500/15 text-amber-700 dark:text-amber-300 dark:text-amber-300",
  red: "bg-destructive/15 text-destructive",
};

function DashboardPage() {
  const nav = useNavigate();
  const { userId } = useSupabaseUser();
  const { getShift, clearShift } = useShift();
  const [pacientes, setPacientes] = useState<Patient[]>([]);
  const [filter, setFilter] = useState<"todos" | "atb" | "pendencias" | "alta" | "critico" | "grave">("todos");
  const [searchQuery, setSearchQuery] = useState("");

  const shift = getShift();

  useEffect(() => {
    if (!userId) return;
    if (!shift) {
      nav({ to: "/plantoes" });
      return;
    }

    async function loadPatients() {
      try {
        const shiftId = storage.getShiftId();
        if (hasSupabaseConfig && shiftId && !shiftId.startsWith("temp_")) {
          const dbPatients = await getPatientsByShift(shiftId, userId!);
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
              nome: a.nome, dose: a.dose, via: a.via, frequencia: a.frequencia,
              dataInicio: a.data_inicio || a.dataInicio,
              data_fim: a.data_fim || a.dataFim || a.end_date,
              status: a.status,
            })),
            medicacoes: (p.medications || []).map((t: string) => ({ id: Math.random().toString(), text: t })),
            laboratorios: (p.labs || []).map((l: any) => ({
              id: Math.random().toString(), data: l.data, valor: l.texto_compacto || l.valor,
            })),
            pendencias: (p.pending_issues || []).map((t: string) => ({ id: Math.random().toString(), text: t })),
            status: (p.status as any) || "internado",
          }));
          if (mapped.length > 0) {
            setPacientes(mapped);
            return;
          }
        }
        throw new Error("Offline or temp ID");
      } catch (err) {
        console.warn("Failed to load from Supabase, using local", err);
        const currentShiftId = storage.getShiftId();
        const plantao = storage.getPlantaoAtivo();
        const currentSector = (shift?.setor || plantao?.setor || "").toLowerCase();
        const allLocal = storage.getLocalPacientes();
        const localPacientes = allLocal.filter((p: any) => {
          if (p.shift_id && currentShiftId) return p.shift_id === currentShiftId;
          if (!p.shift_id) {
            const pSetor = (p.setor || p.sector || "").toLowerCase();
            if (!pSetor || !currentSector) return false;
            return pSetor === currentSector;
          }
          return false;
        });
        const mappedLocal = localPacientes.map((p: any) => ({
          id: p.id || Math.random().toString(),
          leito: p.bed || p.leito || "",
          nome: p.name || p.nome || "",
          idade: p.age || p.idade || "",
          sexo: p.sex || p.sexo || "F",
          motivo_admissao: p.reason_for_admission || p.motivo_admissao || "",
          hda: p.hda || "",
          lista_de_problemas: (p.problem_list || p.lista_de_problemas || []).map((t: any) => ({ id: Math.random().toString(), text: typeof t === "string" ? t : (t.text || "") })),
          antibioticos: (p.antibiotics || p.antibioticos || []).map((a: any) => ({
            id: Math.random().toString(),
            nome: a.nome, dose: a.dose, via: a.via, frequencia: a.frequencia, dataInicio: a.data_inicio || a.dataInicio,
          })),
          medicacoes: (p.medications || p.medicacoes || []).map((t: any) => ({ id: Math.random().toString(), text: typeof t === "string" ? t : (t.text || "") })),
          laboratorios: (p.labs || p.laboratorios || []).map((l: any) => ({
            id: Math.random().toString(), data: l.data, valor: l.texto_compacto || l.valor,
          })),
          pendencias: (p.pending_issues || p.pendencias || []).map((t: any) => ({ id: Math.random().toString(), text: typeof t === "string" ? t : (t.text || "") })),
          status: (p.status as any) || "internado",
        }));
        setPacientes(mappedLocal);
      }
    }

    loadPatients();
  }, [nav, shift, userId]);

  const enriched = useMemo(() => {
    return pacientes.map((p) => {
      const gravidade: Gravidade = computeGravidade({
        antibioticos: p.antibioticos,
        pendencias: p.pendencias,
        lista_de_problemas: p.lista_de_problemas,
        motivo_admissao: p.motivo_admissao,
        setor: shift?.setor,
        status: p.status,
      });
      const diasAtb = maxDiasAtb(p.antibioticos);
      const atbAlerts = getATBsWithAlert({ id: p.id, antibioticos: p.antibioticos });
      const worstAtbAlert: AlertLevel = atbAlerts.some(a => a.level === "red")
        ? "red"
        : atbAlerts.some(a => a.level === "yellow") ? "yellow" : "ok";
      return { ...p, gravidade, diasAtb, atbAlerts, worstAtbAlert };
    });
  }, [pacientes, shift?.setor]);

  const pacientesComAlertaATB = useMemo(
    () => enriched.filter(p => p.worstAtbAlert !== "ok"),
    [enriched]
  );

  const stats = useMemo(() => {
    const byGrav = { critico: 0, grave: 0, moderado: 0, leve: 0 };
    for (const p of enriched) byGrav[p.gravidade] += 1;
    return {
      total: enriched.length,
      ...byGrav,
      comAtb: enriched.filter(p => p.antibioticos.length > 0).length,
      pendencias: enriched.filter(p => p.pendencias.length > 0).length,
      altas: enriched.filter(p => p.status === "alta_provavel" || p.gravidade === "leve").length,
    };
  }, [enriched]);

  const filteredPacientes = useMemo(() => {
    let list = [...enriched];
    if (filter === "atb") list = list.filter(p => p.antibioticos.length > 0);
    if (filter === "pendencias") list = list.filter(p => p.pendencias.length > 0);
    if (filter === "alta") list = list.filter(p => p.status === "alta_provavel" || p.gravidade === "leve");
    if (filter === "critico") list = list.filter(p => p.gravidade === "critico");
    if (filter === "grave") list = list.filter(p => p.gravidade === "grave" || p.gravidade === "critico");

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        p.nome.toLowerCase().includes(q) ||
        p.leito.toLowerCase().includes(q) ||
        (p.motivo_admissao || "").toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => {
      const og = gravidadeOrder(a.gravidade) - gravidadeOrder(b.gravidade);
      if (og !== 0) return og;
      const numA = parseInt(a.leito.replace(/\D/g, "")) || 0;
      const numB = parseInt(b.leito.replace(/\D/g, "")) || 0;
      return numA - numB;
    });
  }, [enriched, filter, searchQuery]);

  const calculateDValue = (startDateStr: string) => {
    const start = parseISO(startDateStr);
    if (!isValid(start)) return "D?";
    const diff = differenceInDays(new Date(), start);
    return `D${diff >= 0 ? diff : 0}`;
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
      if (!shift) {
        toast.error("Nenhum plantão ativo.");
        return;
      }
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
      // 2 steps independentes — antes se createHandoff falhasse, closeShift
      // não rodava e plantão ficava preso ativo. Agora salvamos passagem
      // localmente como backup, e seguimos pro closeShift mesmo se a
      // passagem no servidor falhar. Estado final = plantão encerrado.
      let handoffSaved = false;
      try {
        await createHandoff({ shift_id: shiftId, content: text }, userId);
        handoffSaved = true;
      } catch (err) {
        console.warn("createHandoff falhou, salvando passagem local", err);
        try {
          const archived = JSON.parse(localStorage.getItem("da_handoffs_pendentes") || "[]");
          archived.push({ shift_id: shiftId, content: text, created_at: new Date().toISOString() });
          localStorage.setItem("da_handoffs_pendentes", JSON.stringify(archived));
        } catch { /* sem espaço — ignora */ }
      }

      try {
        await closeShift(shiftId, userId);
      } catch (err) {
        // Mesmo o close falhando, limpamos sessão local pra desbloquear o
        // médico. Marca pra retry posterior.
        console.warn("closeShift falhou — limpando sessão local mesmo assim", err);
        try {
          const pending = JSON.parse(localStorage.getItem("da_close_pendentes") || "[]");
          pending.push({ shift_id: shiftId, at: new Date().toISOString() });
          localStorage.setItem("da_close_pendentes", JSON.stringify(pending));
        } catch { /* ignora */ }
      }

      storage.clearSession();

      if (handoffSaved) {
        toast.success("Plantão encerrado. Dados arquivados.");
      } else {
        toast.warning("Plantão encerrado (passagem salva local — sincroniza quando voltar a rede).", { duration: 6000 });
      }
      nav({ to: "/" });
    } catch (err) {
      console.error(err);
      toast.error("Erro inesperado ao encerrar plantão. Tente de novo.");
    } finally {
      setIsEnding(false);
      setShowEndModal(false);
    }
  };

  if (!shift) return null;

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* ──────────────── HEADER ──────────────── */}
      <header className="bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
              <Stethoscope className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-[15px] font-semibold tracking-tight truncate">Dashboard</h1>
              <span className="text-border">·</span>
              <ShiftBadge />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => nav({ to: "/novo-paciente" })}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" /> Adicionar paciente
            </button>
            <ThemeToggle />
            <button
              onClick={() => setShowEndModal(true)}
              className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
              title="Encerrar plantão"
              aria-label="Encerrar plantão"
            >
              <Archive className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ──────────────── ALERTA ATB ──────────────── */}
        {pacientesComAlertaATB.length > 0 && (
          <div className="card-elevated p-4 border-l-2 border-l-destructive">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {pacientesComAlertaATB.length} paciente{pacientesComAlertaATB.length > 1 ? "s" : ""} com ATB para reavaliar
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {pacientesComAlertaATB.slice(0, 5).map((p) => (
                    <li key={p.id} className="text-[13px] text-muted-foreground">
                      <button
                        onClick={() => nav({ to: "/paciente/$id", params: { id: p.id } })}
                        className="text-foreground hover:underline font-medium"
                      >
                        {p.nome || "—"}
                      </button>
                      {" — "}
                      {p.atbAlerts.filter((a) => a.level !== "ok").map((a) => `${a.nome} D${a.dia}`).join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ──────────────── STATS ──────────────── */}
        <section>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border">
            <StatCell label="Total" value={stats.total} active={filter === "todos"} onClick={() => setFilter("todos")} />
            <StatCell label="Críticos" value={stats.critico} dot="bg-red-500" active={filter === "critico"} onClick={() => setFilter("critico")} />
            <StatCell label="Graves" value={stats.grave} dot="bg-amber-500" active={filter === "grave"} onClick={() => setFilter("grave")} />
            <StatCell label="Moderados" value={stats.moderado} dot="bg-sky-500" />
            <StatCell label="Leves" value={stats.leve} dot="bg-emerald-500" />
            <StatCell label="Com ATB" value={stats.comAtb} active={filter === "atb"} onClick={() => setFilter("atb")} />
            <StatCell label="Pendências" value={stats.pendencias} active={filter === "pendencias"} onClick={() => setFilter("pendencias")} />
          </div>
        </section>

        {/* ──────────────── BUSCA + AÇÕES ──────────────── */}
        <section className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, leito ou diagnóstico…"
              aria-label="Buscar paciente"
              className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-elevated text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => nav({ to: "/novo-paciente" })}
              className="sm:hidden inline-flex items-center gap-1.5 h-10 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium"
            >
              <UserPlus className="h-4 w-4" /> Adicionar
            </button>
            <button
              onClick={() => nav({ to: "/passagem" })}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md border border-border bg-elevated text-sm font-medium hover:bg-subtle transition-colors"
            >
              <FileText className="h-4 w-4" /> Gerar passagem
            </button>
          </div>
        </section>

        {/* ──────────────── FILTROS (segmented) ──────────────── */}
        <div className="inline-flex items-center gap-0.5 bg-subtle p-0.5 rounded-md border border-border">
          {([
            { id: "todos", label: "Todos" },
            { id: "atb", label: "Com ATB" },
            { id: "pendencias", label: "Pendências" },
            { id: "alta", label: "Alta provável" },
          ] as const).map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 h-8 rounded-[5px] text-[13px] font-medium transition-colors ${
                filter === f.id
                  ? "bg-elevated text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ──────────────── LISTA DE PACIENTES ──────────────── */}
        <section className="space-y-2">
          {filteredPacientes.length > 0 ? (
            filteredPacientes.map((p) => (
              <PatientRow
                key={p.id}
                patient={p}
                calculateDValue={calculateDValue}
                onEvoluir={() => nav({ to: "/evolucao/$id", params: { id: p.id } })}
                onPrescricao={() => nav({ to: "/prescricao/$id", params: { id: p.id } })}
                onAbrir={() => nav({ to: "/paciente/$id", params: { id: p.id } })}
              />
            ))
          ) : (
            <EmptyState onAdd={() => nav({ to: "/novo-paciente" })} />
          )}
        </section>
      </main>

      {/* ──────────────── MODAL ENCERRAR ──────────────── */}
      {showEndModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm"
          onClick={() => !isEnding && setShowEndModal(false)}
        >
          <div
            className="bg-elevated rounded-xl w-full max-w-md shadow-xl border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-destructive/10 text-destructive flex items-center justify-center">
                  <Archive className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Encerrar plantão</h2>
                  <p className="text-[13px] text-muted-foreground">{shift.setor} · {shift.data_formatada}</p>
                </div>
              </div>
              <button
                onClick={() => !isEnding && setShowEndModal(false)}
                className="p-1 -mr-1 rounded-md hover:bg-subtle text-muted-foreground"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 pb-6 space-y-4">
              <div className="flex items-center gap-2 text-sm bg-subtle border border-border rounded-md px-3 py-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{pacientes.length} paciente{pacientes.length === 1 ? "" : "s"}</span>
                <span className="text-muted-foreground">no plantão</span>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">
                Os dados serão arquivados e uma passagem de plantão gerada automaticamente.
                Esta ação <span className="text-destructive font-medium">não pode ser desfeita</span>.
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  disabled={isEnding}
                  onClick={() => setShowEndModal(false)}
                  className="flex-1 h-10 rounded-md border border-border bg-elevated text-sm font-medium hover:bg-subtle transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  disabled={isEnding}
                  onClick={handleEndShift}
                  className="flex-1 h-10 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isEnding ? "Arquivando…" : "Encerrar e arquivar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── Subcomponentes ─────────────────── */

interface StatCellProps {
  label: string;
  value: number;
  dot?: string;
  active?: boolean;
  onClick?: () => void;
}
function StatCell({ label, value, dot, active, onClick }: StatCellProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`bg-elevated text-left p-3 transition-colors ${
        onClick ? "hover:bg-subtle cursor-pointer" : ""
      } ${active ? "bg-accent" : ""}`}
    >
      <div className="flex items-center gap-1.5">
        {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-0.5">{value}</div>
    </Tag>
  );
}

interface PatientRowProps {
  patient: Patient & {
    gravidade: Gravidade;
    diasAtb: number | null;
    atbAlerts: ReturnType<typeof getATBsWithAlert>;
    worstAtbAlert: AlertLevel;
  };
  calculateDValue: (s: string) => string;
  onEvoluir: () => void;
  onPrescricao: () => void;
  onAbrir: () => void;
}
function PatientRow({ patient: p, calculateDValue, onEvoluir, onPrescricao, onAbrir }: PatientRowProps) {
  const atbsAtivos = p.antibioticos.filter(a => {
    const s = (a.status || "").toLowerCase();
    if (s === "finalizado" || s === "suspenso") return false;
    if (a.data_fim) {
      const t = new Date(`${a.data_fim}T00:00:00`).getTime();
      if (!isNaN(t) && t <= Date.now()) return false;
    }
    return true;
  });
  const atbCount = atbsAtivos.length;
  const pendCount = p.pendencias.length;

  return (
    <article
      className={`
        relative card-elevated overflow-hidden
        before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px]
        ${GRAV_BAR[p.gravidade]}
        hover:border-foreground/10 transition-colors
      `}
    >
      <div className="pl-4 pr-3 py-3 flex flex-col lg:flex-row lg:items-center gap-3">

        {/* Leito + identidade */}
        <div className="flex items-center gap-3 min-w-0 lg:w-[280px]">
          <div className="h-10 w-10 rounded-md bg-subtle flex flex-col items-center justify-center shrink-0">
            <span className="text-[9px] text-muted-foreground leading-none">LEITO</span>
            <span className="text-sm font-semibold tabular-nums leading-tight mt-0.5">
              {p.leito.replace("L", "") || "—"}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${GRAV_DOT[p.gravidade]}`} title={GRAV_LABEL[p.gravidade]} />
              <h3 className="text-sm font-semibold truncate">{p.nome || "—"}</h3>
            </div>
            <p className="text-[12px] text-muted-foreground truncate">
              {p.idade}a · {p.sexo} {p.motivo_admissao ? `· ${p.motivo_admissao}` : ""}
            </p>
          </div>
        </div>

        {/* ATB + Pendências: stack no mobile, side-by-side no md+ */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
              <Pill className="h-3 w-3" /> Antibióticos
            </div>
            {atbCount > 0 ? (
              <div className="flex flex-wrap gap-1">
                {atbsAtivos.slice(0, 3).map(atb => (
                  <span
                    key={atb.id}
                    className={`inline-flex items-center gap-1 px-1.5 h-5 rounded text-[11px] font-medium tabular-nums ${ATB_PILL[p.worstAtbAlert === "ok" ? "ok" : p.worstAtbAlert]}`}
                  >
                    {atb.nome} {calculateDValue(atb.dataInicio)}
                  </span>
                ))}
                {atbCount > 3 && (
                  <span className="text-[11px] text-muted-foreground self-center">+{atbCount - 3}</span>
                )}
              </div>
            ) : (
              <span className="text-[12px] text-muted-foreground">—</span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
              <AlertTriangle className="h-3 w-3" /> Pendências
            </div>
            {pendCount > 0 ? (
              <div className="text-[12px] truncate">
                <span className="font-medium">{p.pendencias[0].text}</span>
                {pendCount > 1 && <span className="text-muted-foreground"> · +{pendCount - 1}</span>}
              </div>
            ) : (
              <span className="text-[12px] text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Sem pendências
              </span>
            )}
          </div>
        </div>

        {/* Ações: full-width no mobile, compacto no lg+ */}
        <div className="flex items-center gap-1.5 lg:shrink-0 -mx-1 lg:mx-0">
          <button
            onClick={onEvoluir}
            className="flex-1 lg:flex-none h-10 lg:h-8 px-3 rounded-md bg-foreground text-background text-[13px] lg:text-[12px] font-medium hover:opacity-90 transition-opacity"
          >
            Evoluir
          </button>
          <button
            onClick={onPrescricao}
            className="flex-1 lg:flex-none h-10 lg:h-8 px-3 rounded-md border border-border bg-elevated text-[13px] lg:text-[12px] font-medium hover:bg-subtle transition-colors"
          >
            Prescrição
          </button>
          <button
            onClick={onAbrir}
            className="h-10 w-10 lg:h-8 lg:w-8 rounded-md border border-border bg-elevated text-muted-foreground hover:bg-subtle hover:text-foreground transition-colors flex items-center justify-center shrink-0"
            aria-label="Ver paciente"
          >
            <User className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card-elevated py-16 px-6 flex flex-col items-center justify-center text-center">
      <div className="h-12 w-12 rounded-md bg-subtle flex items-center justify-center mb-4">
        <User className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">Nenhum paciente neste plantão</h3>
      <p className="text-[13px] text-muted-foreground max-w-xs mb-5">
        Comece adicionando o primeiro paciente do dia.
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Plus className="h-4 w-4" /> Adicionar paciente
      </button>
    </div>
  );
}
