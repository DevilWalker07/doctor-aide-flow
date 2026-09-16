import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo, type ReactNode } from "react";
import {
  ChevronLeft,
  User,
  Activity,
  Pill,
  AlertTriangle,
  Calendar,
  Building2,
  ClipboardList,
  FileText,
  Plus,
  CheckCircle2,
  FileUp,
  Edit3,
  ArrowRight,
  TrendingUp,
  Clock,
  Info,
  Check,
  X,
} from "lucide-react";
import { differenceInDays, parseISO, isValid, format, addDays, startOfDay } from "date-fns";
import { toast } from "sonner";
import { getPatientById, updatePatient, getLastEvolution } from "@/lib/db";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { leitoCurto, nomeExibicao } from "@/lib/format";
import { storage } from "@/lib/storage";

export const Route = createFileRoute("/paciente/$id")({
  component: PacienteDetailPage,
  head: () => ({ meta: [{ title: "Prontuário do Paciente — MEDFLUXO" }] }),
});

type NavFn = ReturnType<typeof useNavigate>;

interface AcaoCtx {
  nav: NavFn;
  id: string;
  handleStatusUpdate: (status: string) => void;
}

/** Ações secundárias da ficha. "Evoluir" não entra: é o botão fixo do rodapé. */
const ACOES: Array<{
  label: string;
  icon: typeof Pill;
  testid?: string;
  acao: (ctx: AcaoCtx) => void;
}> = [
  {
    label: "Gerar prescrição",
    icon: Pill,
    acao: ({ nav, id }) => nav({ to: "/prescricao/$id", params: { id } }),
  },
  {
    label: "Receita de alta",
    icon: FileText,
    testid: "paciente-receita-alta",
    acao: ({ nav, id }) => nav({ to: "/prescricao-alta", search: { paciente: id } }),
  },
  {
    label: "Encaminhamento",
    icon: ArrowRight,
    testid: "paciente-encaminhamento",
    acao: ({ nav, id }) => nav({ to: "/encaminhamento", search: { paciente: id } }),
  },
  {
    label: "Orientações ao paciente",
    icon: ClipboardList,
    testid: "paciente-orientacoes",
    acao: ({ nav, id }) => nav({ to: "/orientacoes-paciente", search: { paciente: id } }),
  },
  {
    label: "Editar dados",
    icon: Edit3,
    acao: ({ nav, id }) =>
      nav({ to: "/cadastro-manual", search: { id, tipo: "internado" } as never }),
  },
  {
    label: "Marcar alta provável",
    icon: Check,
    acao: ({ handleStatusUpdate }) => handleStatusUpdate("alta_provavel"),
  },
  {
    label: "Histórico de evoluções",
    icon: Clock,
    acao: ({ nav, id }) => nav({ to: "/evolucao/$id/historico", params: { id } }),
  },
];

function PacienteDetailPage() {
  const { id } = useParams({ from: "/paciente/$id" });
  const nav = useNavigate();
  const { userId } = useSupabaseUser();
  const [paciente, setPaciente] = useState<any>(null);
  const [evolutions, setEvolutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalEvolucao, setModalEvolucao] = useState<any>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    async function loadData() {
      try {
        if (id.startsWith("temp_")) throw new Error("Local");
        const p = await getPatientById(id, userId!);

        // Map to component expected format
        const mapped = {
          id: p.id,
          name: p.name,
          bed: p.bed,
          age: p.age,
          sex: p.sex,
          sector: p.sector,
          admissionDate: p.admission_date,
          status: p.status,
          diagnoses: p.problem_list || [],
          comorbidities: p.comorbidities || [],
          pendingIssues: p.pending_issues || [],
          data: {
            abx: (p.antibiotics || []).map((a) => ({
              name: a.nome,
              dose: a.dose,
              via: a.via,
              freq: a.frequencia,
              d0: a.data_inicio,
            })),
            lab:
              p.labs?.length > 0
                ? {
                    date: p.labs[0].data,
                    formatted: p.labs[0].texto_compacto,
                  }
                : null,
          },
        };
        setPaciente(mapped);

        const lastEv = await getLastEvolution(id, userId!);
        setEvolutions(lastEv ? [lastEv] : []);
      } catch (err) {
        // Local fallback
        const existing = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
        const p = existing.find((x: any) => x.id === id);
        if (p) {
          const mapped = {
            id: p.id,
            name: p.nome || p.name,
            bed: p.leito || p.bed,
            age: p.idade || p.age,
            sex: p.sexo || p.sex,
            sector: p.setor || p.sector,
            admissionDate: p.data_admissao || p.admissionDate,
            status: p.status,
            diagnoses: (p.lista_de_problemas || []).map((t: any) => t.text || t),
            comorbidities: p.comorbidades || p.comorbidities || [],
            pendingIssues: (p.pendencias || []).map((t: any) => t.text || t),
            data: {
              abx: (p.antibioticos || []).map((a: any) => ({
                name: a.nome,
                dose: a.dose,
                via: a.via,
                freq: a.frequencia,
                d0: a.dataInicio || a.data_inicio,
              })),
              lab:
                p.laboratorios?.length > 0
                  ? {
                      date: p.laboratorios[0].data,
                      formatted: p.laboratorios[0].valor || p.laboratorios[0].texto_compacto,
                    }
                  : null,
            },
          };
          setPaciente(mapped);
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, userId]);

  const dihInfo = useMemo(() => {
    if (!paciente?.admissionDate && !paciente?.admission) return null;
    const admissionStr = paciente.admissionDate || paciente.admission;
    const admission = startOfDay(parseISO(admissionStr));
    if (!isValid(admission)) return null;
    const today = startOfDay(new Date());
    const days = differenceInDays(today, admission);

    return {
      d: days >= 0 ? `D${days}` : "D0",
      label: days === 0 ? "Admitido hoje" : `Admissão ${format(admission, "dd/MM/yyyy")}`,
    };
  }, [paciente]);

  const handleStatusUpdate = async (status: string) => {
    if (!paciente || !userId) return;
    if (!id.startsWith("temp_")) {
      const p = await getPatientById(id, userId!);
      const newStatus = p.status === "alta_provavel" ? "internado" : "alta_provavel";
      await updatePatient(id, { status: newStatus }, userId!);
      setPaciente({ ...p, status: newStatus });
      toast.success(newStatus === "alta_provavel" ? "Marcado para alta!" : "Internação mantida.");
    } else {
      const existing = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
      const idx = existing.findIndex((x: any) => x.id === id);
      if (idx >= 0) {
        existing[idx].status = status;
        localStorage.setItem("da_pacientes", JSON.stringify(existing));
        setPaciente({ ...paciente, status });
        toast.success(status === "alta_provavel" ? "Alta provável marcada!" : "Status atualizado");
      }
    }
  };

  const resolvePendencia = async (pendText: string) => {
    if (!paciente || !userId) return;
    const updatedPendencias = (paciente.pendingIssues || []).filter((p: string) => p !== pendText);
    const updated = { ...paciente, pendingIssues: updatedPendencias };
    setPaciente(updated);
    toast.success("Pendência resolvida!");

    if (!id.startsWith("temp_")) {
      await updatePatient(id, { pending_issues: updatedPendencias }, userId);
    } else {
      const existing = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
      const idx = existing.findIndex((x: any) => x.id === id);
      if (idx >= 0) {
        existing[idx].pendencias = existing[idx].pendencias.filter(
          (p: any) => (p.text || p) !== pendText,
        );
        localStorage.setItem("da_pacientes", JSON.stringify(existing));
      }
    }
  };

  // O ajuste de "dias para alerta de ATB" existia em Configurações, mas esta
  // tela ignorava e fixava 7 dias para qualquer esquema.
  const diasAlertaAtb = useMemo(() => {
    const dias = storage.getAtbAlertDays();
    return Number.isFinite(dias) && dias > 0 ? dias : 7;
  }, []);

  const problemasAtivos: string[] = useMemo(() => {
    const lista: string[] = [...(paciente?.diagnoses ?? [])];
    const dx = paciente?.data?.conducta?.dx;
    if (dx && !lista.includes(dx)) lista.push(dx);
    return lista;
  }, [paciente]);

  const dataAdmissao = useMemo(() => {
    const bruta = paciente?.admissionDate || paciente?.admission;
    if (!bruta) return "data não informada";
    const d = parseISO(bruta);
    return isValid(d) ? format(d, "dd/MM/yyyy") : String(bruta);
  }, [paciente]);

  if (loading) return null;
  if (!paciente) {
    return (
      <div className="bg-background flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <h1 className="t-display text-foreground">Paciente não encontrado</h1>
        <p className="t-body text-muted-foreground mt-2">
          Ele pode ter sido removido ou pertencer a outro plantão.
        </p>
        <Link
          to="/dashboard"
          className="bg-primary text-primary-foreground focus-visible:ring-ring mt-6 inline-flex min-h-[3rem] items-center rounded-2xl px-6 text-base font-bold focus-visible:ring-2 focus-visible:outline-none"
        >
          Voltar ao plantão
        </Link>
      </div>
    );
  }

  const lastEvolution = evolutions[0];
  const nome = nomeExibicao(paciente.name);

  return (
    <div className="bg-background min-h-screen pb-28">
      <header className="bg-card border-border sticky top-0 z-30 border-b">
        <div className="mx-auto max-w-4xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => nav({ to: "/dashboard" })}
              className="t-label text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-2 inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-xl px-2 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" /> Plantão
            </button>
            <span
              className={`t-label rounded-full px-3 py-1.5 ${
                paciente.status === "alta_provavel"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {paciente.status === "alta_provavel" ? "Alta provável" : "Internado"}
            </span>
          </div>

          <h1 className="t-display text-foreground mt-2">{nome}</h1>
          <p className="t-body text-muted-foreground">
            Leito {leitoCurto(paciente.bed)} ·{" "}
            {paciente.age ? `${paciente.age} anos` : "idade não informada"} ·{" "}
            {paciente.sex === "M" ? "Masculino" : "Feminino"}
            {paciente.sector ? ` · ${paciente.sector}` : ""}
          </p>
          <p className="t-label text-primary mt-1 flex items-center gap-1.5">
            <Calendar className="h-4 w-4" aria-hidden="true" />
            {dihInfo?.d} de internação · admitido em {dataAdmissao}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        <Section
          title="Lista de problemas"
          icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
          action={
            <button
              onClick={() =>
                nav({ to: "/cadastro-manual", search: { id, tipo: "internado" } as any })
              }
              className="t-label text-primary focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-xl px-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              <Edit3 className="h-4 w-4" aria-hidden="true" /> Editar
            </button>
          }
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="t-eyebrow text-muted-foreground flex items-center gap-2">
                <span className="bg-destructive h-2 w-2 rounded-full" aria-hidden="true" /> Ativos
              </h4>
              {problemasAtivos.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {problemasAtivos.map((prob: string, i: number) => (
                    <li
                      key={i}
                      className="bg-background border-border t-body text-foreground flex items-center gap-2 rounded-xl border p-3"
                    >
                      <span
                        className="bg-destructive h-1.5 w-1.5 shrink-0 rounded-full"
                        aria-hidden="true"
                      />
                      {prob}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="t-body text-muted-foreground mt-3">Nenhum problema ativo listado.</p>
              )}
            </div>
            <div>
              <h4 className="t-eyebrow text-muted-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />{" "}
                Comorbidades
              </h4>
              <div className="mt-3 flex flex-wrap gap-2">
                {paciente.comorbidities?.length > 0 ? (
                  paciente.comorbidities.map((c: string) => (
                    <span
                      key={c}
                      className="bg-secondary border-border t-label text-foreground flex items-center gap-1.5 rounded-lg border px-3 py-2"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />{" "}
                      {c}
                    </span>
                  ))
                ) : (
                  <p className="t-body text-muted-foreground">Nenhuma comorbidade listada.</p>
                )}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Antibióticos" icon={<Pill className="h-5 w-5" aria-hidden="true" />}>
          {paciente.data?.abx?.length > 0 ? (
            <ul className="space-y-5">
              {paciente.data.abx.map((atb: any, i: number) => {
                const inicio = parseISO(atb.d0);
                const dias = isValid(inicio)
                  ? Math.max(differenceInDays(startOfDay(new Date()), startOfDay(inicio)), 0)
                  : null;
                const passouDoAlerta = dias !== null && dias > diasAlertaAtb;
                const proporcao = dias === null ? 0 : Math.min(dias / diasAlertaAtb, 1);

                return (
                  <li key={i} className="space-y-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="t-title text-foreground">{atb.name}</h3>
                        <p className="t-body text-muted-foreground">
                          {[atb.dose, atb.via, atb.freq].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="t-display text-foreground leading-none">
                          {dias === null ? "D?" : `D${dias}`}
                        </span>
                        <p className="t-label text-muted-foreground font-normal">
                          {isValid(inicio)
                            ? `Início ${format(inicio, "dd/MM/yyyy")}`
                            : "Início não informado"}
                        </p>
                      </div>
                    </div>

                    {/* Era uma barra feita de caracteres █ e ░, que o leitor de
                        tela lê como ruído. Agora é uma barra de verdade, e o
                        limite vem de Configurações em vez de 7 dias fixos. */}
                    <div>
                      <div
                        className="bg-secondary h-2 w-full overflow-hidden rounded-full"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={diasAlertaAtb}
                        aria-valuenow={dias ?? 0}
                        aria-label={`${atb.name}: dia ${dias ?? "desconhecido"} de uso`}
                      >
                        <div
                          className={`h-full rounded-full transition-all ${
                            passouDoAlerta
                              ? "bg-destructive"
                              : proporcao > 0.7
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.max(proporcao * 100, 4)}%` }}
                        />
                      </div>
                      {/* Não afirmamos data de término: o esquema é do prescritor. */}
                      <p className="t-label text-muted-foreground mt-1.5 font-normal">
                        Reavaliar em {diasAlertaAtb} dias (ajustável em Configurações)
                      </p>
                    </div>

                    {passouDoAlerta && (
                      <p className="bg-destructive/10 text-destructive t-body flex items-center gap-2 rounded-xl p-3">
                        <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
                        Em uso há mais de {diasAlertaAtb} dias — revisar indicação e culturas.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="border-border flex flex-col items-center rounded-2xl border-2 border-dashed py-8 text-center">
              <Pill className="text-muted-foreground mb-2 h-8 w-8" aria-hidden="true" />
              <p className="t-body text-muted-foreground">Nenhum antibiótico em uso</p>
            </div>
          )}
        </Section>

        <Section title="Laboratório" icon={<Activity className="h-5 w-5" aria-hidden="true" />}>
          {paciente.data?.lab ? (
            <div className="bg-secondary border-border flex items-center gap-4 rounded-2xl border p-4">
              <div className="bg-card text-primary border-border flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="t-label text-muted-foreground font-normal">
                  Último resultado em {paciente.data.lab.date}
                </p>
                <p className="t-body text-foreground">
                  {paciente.data.lab.formatted || "Resultado estruturado disponível."}
                </p>
              </div>
            </div>
          ) : (
            <p className="t-body text-muted-foreground">Nenhum exame laboratorial registrado.</p>
          )}
        </Section>

        <Section
          title="Pendências"
          icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
          action={
            <button
              onClick={() =>
                nav({ to: "/cadastro-manual", search: { id, tipo: "internado" } as any })
              }
              className="t-label text-primary focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-xl px-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar
            </button>
          }
        >
          {paciente.pendingIssues?.length > 0 ? (
            <ul className="space-y-2">
              {paciente.pendingIssues.map((pend: string, i: number) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <AlertTriangle
                      className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
                      aria-hidden="true"
                    />
                    <span className="t-body text-foreground">{pend}</span>
                  </div>
                  <button
                    onClick={() => resolvePendencia(pend)}
                    aria-label={`Resolver pendência: ${pend}`}
                    className="t-label bg-card border-border text-foreground focus-visible:ring-ring inline-flex min-h-[2.75rem] shrink-0 items-center gap-1.5 rounded-xl border px-3 transition-colors hover:border-emerald-500 hover:bg-emerald-500 hover:text-white focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Resolver
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="t-body flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" /> Nenhuma pendência
              ativa.
            </p>
          )}
        </Section>

        <div className="grid gap-6 md:grid-cols-2">
          <Section
            title="Última evolução"
            icon={<FileText className="h-5 w-5" aria-hidden="true" />}
            action={
              lastEvolution ? (
                <button
                  onClick={() => nav({ to: "/evolucao/$id/historico", params: { id } })}
                  className="t-label text-primary focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-xl px-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  Histórico <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : undefined
            }
          >
            {lastEvolution ? (
              <>
                <p className="t-label text-muted-foreground font-normal">
                  {format(parseISO(lastEvolution.created_at), "dd/MM/yyyy 'às' HH:mm")}
                </p>
                <p className="t-body text-muted-foreground mt-2 line-clamp-3">
                  {lastEvolution.content}
                </p>
                <button
                  onClick={() => setModalEvolucao(lastEvolution)}
                  className="t-label text-primary focus-visible:ring-ring mt-3 inline-flex min-h-[2.75rem] items-center rounded-xl hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  Ver completa
                </button>
              </>
            ) : (
              <p className="t-body text-muted-foreground">Nenhuma evolução registrada.</p>
            )}
          </Section>

          <Section title="Documentos" icon={<FileUp className="h-5 w-5" aria-hidden="true" />}>
            {paciente.documents?.length > 0 && (
              <ul className="mb-3 space-y-2">
                {paciente.documents.map((doc: any, i: number) => (
                  <li
                    key={i}
                    className="bg-secondary border-border flex items-center gap-3 rounded-xl border p-3"
                  >
                    <FileText
                      className="text-muted-foreground h-5 w-5 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="t-body text-foreground truncate">{doc.name}</p>
                      <p className="t-label text-muted-foreground font-normal">{doc.date}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => nav({ to: "/upload-ia", search: { patient_id: id } as any })}
              className="border-border text-muted-foreground hover:border-primary hover:text-primary focus-visible:ring-ring t-body flex min-h-[3rem] w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed py-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <Plus className="h-5 w-5" aria-hidden="true" /> Adicionar documento
            </button>
          </Section>
        </div>

        {/* Eram nove cartões de mesmo peso visual, um deles repetindo o botão
            flutuante. Agora: uma ação principal e o resto agrupado. */}
        <section aria-labelledby="paciente-acoes" className="space-y-3">
          <h2 id="paciente-acoes" className="t-eyebrow text-muted-foreground">
            Ações
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ACOES.map((a) => (
              <li key={a.label}>
                <button
                  onClick={() => a.acao({ nav, id, handleStatusUpdate })}
                  data-testid={a.testid}
                  className="border-border bg-card hover:bg-secondary focus-visible:ring-ring flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <div className="bg-secondary text-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                    <a.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="t-body text-foreground flex-1">{a.label}</span>
                  <ArrowRight
                    className="text-muted-foreground h-5 w-5 shrink-0"
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>

      {/* Ação principal fixa: é o que o médico veio fazer. */}
      <div className="bg-background/90 border-border fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-4 py-3 sm:px-6">
          <button
            onClick={() => nav({ to: "/evolucao/$id", params: { id } })}
            className="bg-navy text-navy-foreground focus-visible:ring-ring inline-flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-2xl text-base font-bold transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
          >
            <TrendingUp className="h-5 w-5" aria-hidden="true" /> Evoluir paciente
          </button>
        </div>
      </div>

      {modalEvolucao && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-card border-border flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border shadow-2xl">
            <header className="border-border flex items-center justify-between border-b p-5">
              <div>
                <h2 className="t-title text-foreground">Evolução médica</h2>
                <p className="t-label text-muted-foreground font-normal">
                  {format(parseISO(modalEvolucao.created_at), "dd/MM/yyyy 'às' HH:mm")}
                </p>
              </div>
              <button
                onClick={() => setModalEvolucao(null)}
                aria-label="Fechar"
                className="touch-target border-border text-muted-foreground hover:bg-secondary focus-visible:ring-ring inline-flex items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>
            {/* O texto clínico permanece em caixa alta: é convenção do
                prontuário, não decisão de interface. */}
            <div className="custom-scrollbar flex-1 overflow-y-auto p-5">
              <pre className="text-foreground font-mono text-[0.8125rem] leading-relaxed whitespace-pre-wrap">
                {modalEvolucao.content}
              </pre>
            </div>
            <footer className="border-border flex justify-end border-t p-5">
              <button
                onClick={() => setModalEvolucao(null)}
                className="bg-navy text-navy-foreground focus-visible:ring-ring min-h-[3rem] rounded-2xl px-8 text-base font-bold focus-visible:ring-2 focus-visible:outline-none"
              >
                Fechar
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="bg-card border-border rounded-3xl border p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-secondary text-muted-foreground flex h-10 w-10 items-center justify-center rounded-2xl">
            {icon}
          </div>
          <h2 className="t-title text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
