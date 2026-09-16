import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Stethoscope,
  Plus,
  ListFilter,
  Pill,
  AlertTriangle,
  CheckCircle2,
  UserPlus,
  FileText,
  Activity,
  FlaskConical,
  Calendar,
  Building2,
  User,
  Users,
  ClipboardList,
  LogOut,
} from "lucide-react";
import { useShift } from "@/hooks/useShift";
import { getPatientsByShift, closeShift, createHandoff } from "@/lib/db";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { differenceInDays, parseISO, isValid, format } from "date-fns";
import { toast } from "sonner";
import { X, Copy, Archive } from "lucide-react";

import { leitoCurto, nomeExibicao, plural } from "@/lib/format";
import { storage } from "@/lib/storage";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — MEDFLUXO" }] }),
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
  }[];
  medicacoes: { id: string; text: string }[];
  laboratorios: { id: string; data: string; valor: string }[];
  pendencias: { id: string; text: string }[];
  status?: "pendente" | "alta_provavel";
}

type FiltroId = "todos" | "atb" | "pendencias" | "alta" | "exames";

/** Um único catálogo para o cartão e para o recorte da lista. */
const FILTROS: Array<{
  key: FiltroId;
  label: string;
  stat: "total" | "comAtb" | "pendencias" | "altas" | "exames";
  icon: typeof ListFilter;
  tom: string;
}> = [
  { key: "todos", label: "Total", stat: "total", icon: ListFilter, tom: "text-muted-foreground" },
  { key: "atb", label: "Com ATB", stat: "comAtb", icon: Pill, tom: "text-ai" },
  {
    key: "pendencias",
    label: "Pendências",
    stat: "pendencias",
    icon: AlertTriangle,
    tom: "text-amber-500",
  },
  { key: "alta", label: "Altas", stat: "altas", icon: CheckCircle2, tom: "text-emerald-500" },
  { key: "exames", label: "Exames", stat: "exames", icon: FlaskConical, tom: "text-primary" },
];

/** Pendência que fala de exame ou resultado — usada pelo contador e pelo filtro. */
function aguardaExame(p: Patient): boolean {
  return p.pendencias.some((pend) => {
    const t = pend.text.toLowerCase();
    return t.includes("exame") || t.includes("resultado");
  });
}

function DashboardPage() {
  const nav = useNavigate();
  const { userId } = useSupabaseUser();
  const { getShift, clearShift } = useShift();
  const [pacientes, setPacientes] = useState<Patient[]>([]);
  const [filter, setFilter] = useState<FiltroId>("todos");

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
          const mapped = dbPatients.map((p) => ({
            id: p.id,
            leito: p.bed || "",
            nome: p.name || "",
            idade: p.age || "",
            sexo: p.sex || "F",
            motivo_admissao: p.reason_for_admission || "",
            hda: p.hda || "",
            lista_de_problemas: (p.problem_list || []).map((t: string) => ({
              id: Math.random().toString(),
              text: t,
            })),
            antibioticos: (p.antibiotics || []).map((a: any) => ({
              id: Math.random().toString(),
              nome: a.nome,
              dose: a.dose,
              via: a.via,
              frequencia: a.frequencia,
              dataInicio: a.data_inicio || a.dataInicio,
            })),
            medicacoes: (p.medications || []).map((t: string) => ({
              id: Math.random().toString(),
              text: t,
            })),
            laboratorios: (p.labs || []).map((l: any) => ({
              id: Math.random().toString(),
              data: l.data,
              valor: l.texto_compacto || l.valor,
            })),
            pendencias: (p.pending_issues || []).map((t: string) => ({
              id: Math.random().toString(),
              text: t,
            })),
            status: (p.status as any) || "internado",
          }));

          setPacientes(mapped);
          return;
        }
        throw new Error("Offline or temp ID");
      } catch (err) {
        console.warn("Failed to load from Supabase, using local", err);
        const localPacientes = storage.getLocalPacientes();
        const mappedLocal = localPacientes.map((p: any) => ({
          id: p.id || Math.random().toString(),
          leito: p.bed || p.leito || "",
          nome: p.name || p.nome || "",
          idade: p.age || p.idade || "",
          sexo: p.sex || p.sexo || "F",
          motivo_admissao: p.reason_for_admission || p.motivo_admissao || "",
          hda: p.hda || "",
          lista_de_problemas: (p.problem_list || p.lista_de_problemas || []).map((t: any) => ({
            id: Math.random().toString(),
            text: typeof t === "string" ? t : t.text || "",
          })),
          antibioticos: (p.antibiotics || p.antibioticos || []).map((a: any) => ({
            id: Math.random().toString(),
            nome: a.nome,
            dose: a.dose,
            via: a.via,
            frequencia: a.frequencia,
            dataInicio: a.data_inicio || a.dataInicio,
          })),
          medicacoes: (p.medications || p.medicacoes || []).map((t: any) => ({
            id: Math.random().toString(),
            text: typeof t === "string" ? t : t.text || "",
          })),
          laboratorios: (p.labs || p.laboratorios || []).map((l: any) => ({
            id: Math.random().toString(),
            data: l.data,
            valor: l.texto_compacto || l.valor,
          })),
          pendencias: (p.pending_issues || p.pendencias || []).map((t: any) => ({
            id: Math.random().toString(),
            text: typeof t === "string" ? t : t.text || "",
          })),
          status: (p.status as any) || "internado",
        }));
        setPacientes(mappedLocal);
      }
    }

    loadPatients();
  }, [nav, shift, userId]);

  const stats = useMemo(() => {
    return {
      total: pacientes.length,
      comAtb: pacientes.filter((p) => p.antibioticos.length > 0).length,
      pendencias: pacientes.filter((p) => p.pendencias.length > 0).length,
      altas: pacientes.filter((p) => p.status === "alta_provavel").length,
      exames: pacientes.filter(aguardaExame).length,
    };
  }, [pacientes]);

  const filteredPacientes = useMemo(() => {
    let list = [...pacientes];
    if (filter === "atb") list = list.filter((p) => p.antibioticos.length > 0);
    if (filter === "pendencias") list = list.filter((p) => p.pendencias.length > 0);
    if (filter === "alta") list = list.filter((p) => p.status === "alta_provavel");
    if (filter === "exames") list = list.filter(aguardaExame);

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
      let text = `PASSAGEM DE PLANTÃO - ${shift?.setor ?? ""}\n`;
      text += `DATA: ${shift?.data_formatada ?? ""}\n`;
      text += `PROFISSIONAL: ${storage.getNomeMedico()}\n\n`;

      pacientes.forEach((p) => {
        text += `${p.leito} - ${p.nome} (${p.idade}A, ${p.sexo})\n`;
        text += `DX: ${p.motivo_admissao || "N/A"}\n`;
        if (p.antibioticos.length > 0) {
          text += `ATB: ${p.antibioticos.map((a) => `${a.nome} (${calculateDValue(a.dataInicio)})`).join(", ")}\n`;
        }
        if (p.pendencias.length > 0) {
          text += `PENDÊNCIAS: ${p.pendencias.map((pend) => pend.text).join(" · ")}\n`;
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
    <div className="bg-background min-h-screen pb-20">
      <header className="bg-background/90 border-border sticky top-0 z-30 border-b backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-primary text-primary-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
              <Stethoscope className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="t-title text-foreground truncate">{shift.setor || "Plantão"}</h1>
              <p className="t-label text-muted-foreground flex items-center gap-1.5 truncate font-normal">
                <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                {/* Sem data, o separador ficava pendurado no fim da linha. */}
                {[shift.hospital || "Unidade não informada", shift.data_formatada]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => nav({ to: "/novo-paciente" })}
              className="bg-primary text-primary-foreground focus-visible:ring-ring hidden min-h-[2.75rem] items-center gap-2 rounded-2xl px-5 text-base font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none sm:inline-flex"
            >
              <Plus className="h-5 w-5" aria-hidden="true" /> Paciente
            </button>
            <button
              onClick={() => setShowEndModal(true)}
              aria-label="Encerrar plantão"
              className="touch-target text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <Archive className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {/* No celular, cinco cartões grandes empurravam o primeiro paciente
            para baixo da dobra — e o médico abre o plantão para ver pacientes.
            Viraram uma faixa compacta que rola na horizontal. */}
        <section aria-labelledby="dash-filtros">
          <h2 id="dash-filtros" className="sr-only">
            Filtrar pacientes
          </h2>
          <div
            role="radiogroup"
            aria-labelledby="dash-filtros"
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
          >
            {FILTROS.map((f) => {
              const ativo = filter === f.key;
              return (
                <button
                  key={f.key}
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => setFilter(f.key)}
                  data-testid={`dash-filtro-${f.key}`}
                  className={`focus-visible:ring-ring inline-flex min-h-[2.75rem] shrink-0 items-center gap-2 rounded-2xl border px-3.5 transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                    ativo
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <f.icon className={`h-4 w-4 ${ativo ? "" : f.tom}`} aria-hidden="true" />
                  <span className="t-label">{f.label}</span>
                  <span
                    className={`t-label rounded-full px-1.5 ${ativo ? "bg-primary/20" : "bg-secondary"}`}
                  >
                    {stats[f.stat]}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => nav({ to: "/novo-paciente" })}
            data-testid="dashboard-add-patient"
            className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none sm:w-auto"
          >
            <UserPlus className="h-5 w-5" aria-hidden="true" /> Adicionar paciente
          </button>
          <button
            onClick={() => nav({ to: "/passagem-plantao" })}
            className="border-border text-foreground hover:bg-secondary focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-2xl border px-4 text-base font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <FileText className="h-5 w-5" aria-hidden="true" /> Passagem
          </button>
          <button
            onClick={() => nav({ to: "/prescricao-alta", search: {} })}
            data-testid="dashboard-documentos"
            className="border-border text-foreground hover:bg-secondary focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-2xl border px-4 text-base font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <Pill className="h-5 w-5" aria-hidden="true" /> Documentos
          </button>
          <button
            onClick={() => nav({ to: "/passagem" })}
            aria-label="Passagem rápida em texto"
            className="touch-target border-border text-muted-foreground hover:bg-secondary focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl border transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <ul className="space-y-3">
          {filteredPacientes.length > 0 ? (
            filteredPacientes.map((p) => (
              <li
                key={p.id}
                data-testid={`dash-paciente-${p.id}`}
                className={`bg-card border-border flex flex-col gap-4 rounded-3xl border p-4 sm:p-5 lg:flex-row lg:items-center ${
                  p.status === "alta_provavel"
                    ? "border-l-4 border-l-emerald-500"
                    : p.pendencias.length > 0
                      ? "border-l-4 border-l-amber-500"
                      : ""
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="bg-secondary flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl">
                    <span className="t-eyebrow text-muted-foreground">Leito</span>
                    <span className="t-title text-foreground leading-none">
                      {leitoCurto(p.leito)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* O nome é o que o olho procura primeiro. Guardamos em
                          caixa alta, mas exibimos com a forma da palavra. */}
                      <h3 className="t-title text-foreground">{nomeExibicao(p.nome)}</h3>
                      <span className="t-label text-muted-foreground bg-secondary rounded-md px-2 py-0.5 font-normal">
                        {p.idade ? `${p.idade} anos` : "Idade não informada"} · {p.sexo}
                      </span>
                    </div>
                    <p className="t-body text-muted-foreground line-clamp-2">
                      {p.motivo_admissao ||
                        p.lista_de_problemas
                          .slice(0, 2)
                          .map((prob) => prob.text)
                          .join(" · ") ||
                        "Sem diagnóstico principal"}
                    </p>
                  </div>
                </div>

                <div className="grid w-full flex-1 grid-cols-1 gap-3 md:grid-cols-2 lg:w-auto">
                  <div>
                    <p className="t-eyebrow text-muted-foreground flex items-center gap-1.5">
                      <Pill className="text-ai h-4 w-4" aria-hidden="true" /> Antibióticos
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {p.antibioticos.length > 0 ? (
                        p.antibioticos.map((atb) => (
                          <span
                            key={atb.id}
                            className="t-label bg-ai/10 text-ai rounded-lg px-2.5 py-1"
                          >
                            {atb.nome} — {calculateDValue(atb.dataInicio)}
                          </span>
                        ))
                      ) : (
                        <span className="t-body text-muted-foreground">Nenhum em uso</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="t-eyebrow text-muted-foreground flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />{" "}
                      Pendências
                    </p>
                    <div className="mt-1.5">
                      {p.pendencias.length > 0 ? (
                        <>
                          <p className="t-body truncate text-amber-700 dark:text-amber-300">
                            {p.pendencias[0].text}
                          </p>
                          {p.pendencias.length > 1 && (
                            <p className="t-label text-muted-foreground font-normal">
                              + {p.pendencias.length - 1}{" "}
                              {p.pendencias.length - 1 === 1 ? "outra" : "outras"}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="t-body flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> Nenhuma
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex w-full shrink-0 items-center gap-2 lg:w-auto">
                  <button
                    onClick={() => nav({ to: "/evolucao/$id", params: { id: p.id } })}
                    className="bg-navy text-navy-foreground focus-visible:ring-ring min-h-[2.75rem] flex-1 rounded-xl px-4 text-base font-bold transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none lg:flex-none"
                  >
                    Evoluir
                  </button>
                  <button
                    onClick={() => nav({ to: "/prescricao/$id", params: { id: p.id } })}
                    className="border-border text-foreground hover:bg-secondary focus-visible:ring-ring min-h-[2.75rem] flex-1 rounded-xl border px-4 text-base font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none lg:flex-none"
                  >
                    Prescrição
                  </button>
                  <button
                    onClick={() => nav({ to: "/paciente/$id", params: { id: p.id } })}
                    aria-label={`Abrir ficha de ${nomeExibicao(p.nome)}`}
                    className="touch-target border-border text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-ring inline-flex items-center justify-center rounded-xl border transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <User className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))
          ) : (
            <li className="border-border bg-card flex flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-16 text-center">
              <div className="bg-secondary mb-5 flex h-16 w-16 items-center justify-center rounded-3xl">
                <User className="text-muted-foreground h-8 w-8" aria-hidden="true" />
              </div>
              <h3 className="t-title text-foreground">
                {filter === "todos"
                  ? "Nenhum paciente neste plantão"
                  : "Nenhum paciente neste filtro"}
              </h3>
              <p className="t-body text-muted-foreground mx-auto mt-2 max-w-xs">
                {filter === "todos"
                  ? "Comece adicionando o primeiro paciente do dia."
                  : "Todos os pacientes estão fora deste recorte."}
              </p>
              {filter === "todos" ? (
                <button
                  onClick={() => nav({ to: "/novo-paciente" })}
                  className="bg-primary text-primary-foreground focus-visible:ring-ring mt-6 inline-flex min-h-[3rem] items-center gap-2 rounded-2xl px-6 text-base font-bold focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Plus className="h-5 w-5" aria-hidden="true" /> Adicionar primeiro paciente
                </button>
              ) : (
                <button
                  onClick={() => setFilter("todos")}
                  className="border-border text-foreground hover:bg-secondary focus-visible:ring-ring mt-6 inline-flex min-h-[3rem] items-center gap-2 rounded-2xl border px-6 text-base font-bold focus-visible:ring-2 focus-visible:outline-none"
                >
                  Ver todos os pacientes
                </button>
              )}
            </li>
          )}
        </ul>
      </main>

      {showEndModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm sm:p-6">
          <div className="bg-card border-border w-full max-w-md overflow-hidden rounded-3xl border shadow-2xl">
            <div className="flex items-start justify-between p-6 pb-0">
              <div className="bg-destructive/10 text-destructive flex h-12 w-12 items-center justify-center rounded-2xl">
                <Archive className="h-6 w-6" aria-hidden="true" />
              </div>
              <button
                onClick={() => !isEnding && setShowEndModal(false)}
                aria-label="Fechar"
                className="touch-target hover:bg-secondary focus-visible:ring-ring inline-flex items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <X className="text-muted-foreground h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-5 p-6 pt-4">
              <div>
                <h2 className="t-display text-foreground">Encerrar plantão</h2>
                <p className="t-body text-muted-foreground mt-1">
                  {shift.setor} — {shift.data_formatada}
                </p>
                <div className="bg-secondary border-border mt-4 flex items-center gap-3 rounded-2xl border px-4 py-3">
                  <Users className="text-primary h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="t-body text-foreground">
                    {plural(pacientes.length, "paciente ativo", "pacientes ativos")}
                  </span>
                </div>
              </div>

              <p className="t-body text-muted-foreground">
                Ao encerrar, os dados são arquivados e uma passagem de plantão é gerada
                automaticamente. Esta ação{" "}
                <span className="text-destructive font-bold">não pode ser desfeita</span>.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  disabled={isEnding}
                  onClick={handleEndShift}
                  className="bg-destructive focus-visible:ring-ring min-h-[3rem] w-full rounded-2xl text-base font-bold text-white focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                >
                  {isEnding ? "Arquivando..." : "Encerrar e arquivar"}
                </button>
                <button
                  disabled={isEnding}
                  onClick={() => setShowEndModal(false)}
                  className="bg-secondary text-foreground focus-visible:ring-ring min-h-[3rem] w-full rounded-2xl text-base font-bold focus-visible:ring-2 focus-visible:outline-none"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
