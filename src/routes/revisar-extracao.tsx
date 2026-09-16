import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo, useId, memo, useCallback } from "react";
import {
  User,
  Stethoscope,
  ClipboardList,
  FlaskConical,
  AlertCircle,
  Trash2,
  Plus,
  Save,
  RefreshCw,
  X,
  AlertTriangle,
  Pill,
  Calendar,
  Activity,
  ArrowRight,
  CheckCircle2,
  LayoutList,
  ChevronRight,
  Clock,
  Heart,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, parseISO, isValid } from "date-fns";
import { createPatient, mergePatientData, type Patient } from "@/lib/db";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { storage } from "@/lib/storage";

export const Route = createFileRoute("/revisar-extracao")({
  component: RevisarExtracao,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      patient_id: search.patient_id as string | undefined,
    };
  },
  head: () => ({ meta: [{ title: "Revisar Extração — MEDFLUXO" }] }),
});

// ─── Styles ──────────────────────────────────────────────────────────────────
const inputCls =
  "w-full min-h-[3rem] bg-card border border-border rounded-2xl px-4 py-3 text-base font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors placeholder:text-muted-foreground placeholder:font-normal";
const textareaCls =
  "w-full bg-card border border-border rounded-2xl px-4 py-4 text-base font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors leading-relaxed placeholder:text-muted-foreground placeholder:font-normal";

// ─── Components ──────────────────────────────────────────────────────────────

const EditableTextarea = memo(({ value, onChange, label, rows = 4, placeholder }: any) => {
  const [local, setLocal] = useState(value || "");
  // Os rótulos não estavam ligados aos campos: tocar no rótulo não focava
  // nada e o leitor de tela anunciava o campo sem nome.
  const id = useId();
  useEffect(() => {
    setLocal(value || "");
  }, [value]);
  const handleBlur = () => {
    if (local !== value) onChange(local);
  };
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="t-label text-muted-foreground">
        {label}
      </label>
      <textarea
        id={id}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={handleBlur}
        rows={rows}
        className={textareaCls}
        placeholder={placeholder}
      />
    </div>
  );
});

const EditableInput = memo(
  ({ value, onChange, label, type = "text", placeholder, uppercase = false }: any) => {
    const [local, setLocal] = useState(value || "");
    const id = useId();
    useEffect(() => {
      setLocal(value || "");
    }, [value]);
    const handleBlur = () => {
      let v = local;
      if (uppercase && typeof v === "string") v = v.toUpperCase();
      if (v !== value) onChange(v);
    };
    return (
      <div className="space-y-1.5">
        <label htmlFor={id} className="t-label text-muted-foreground">
          {label}
        </label>
        <input
          id={id}
          type={type}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={handleBlur}
          className={inputCls}
          placeholder={placeholder}
        />
      </div>
    );
  },
);

const Section = memo(
  ({ id, title, icon, children }: { id: string; title: string; icon: any; children: any }) => (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-28">
      <div className="mb-4 flex items-center gap-3">
        <div className="bg-secondary border-border text-muted-foreground flex h-10 w-10 items-center justify-center rounded-xl border">
          {icon}
        </div>
        <h2 id={`${id}-titulo`} className="t-title text-foreground">
          {title}
        </h2>
      </div>
      <div className="bg-card border-border space-y-6 rounded-3xl border p-5 sm:p-6">
        {children}
      </div>
    </section>
  ),
);

const SIDEBAR_ITEMS = [
  { id: "identificacao", label: "Identificação", icon: User },
  { id: "hda", label: "História e motivo", icon: Stethoscope },
  { id: "problemas", label: "Problemas", icon: ClipboardList },
  { id: "antibioticos", label: "Antibióticos", icon: Pill },
  { id: "medicacoes", label: "Medicações", icon: Activity },
  { id: "laboratorios", label: "Laboratório", icon: FlaskConical },
  { id: "exame-fisico", label: "Exame físico", icon: Activity },
  { id: "condutas", label: "Condutas", icon: ClipboardList },
  { id: "pendencias", label: "Pendências", icon: AlertTriangle },
  { id: "alertas", label: "Alertas", icon: AlertCircle },
];

const Sidebar = memo(({ onScrollTo }: { onScrollTo: (id: string) => void }) => {
  const [active, setActive] = useState("identificacao");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) setActive(visible.target.id);
      },
      { threshold: 0.2, rootMargin: "-100px 0px -60% 0px" },
    );
    const sections = document.querySelectorAll("section[id]");
    sections.forEach((s) => observer.observe(s));
    return () => sections.forEach((s) => observer.unobserve(s));
  }, []);
  return (
    <aside className="sticky top-24 hidden w-64 self-start md:block">
      <nav aria-label="Seções da revisão" className="border-border bg-card rounded-2xl border p-2">
        <ul className="space-y-1">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = active === item.id;
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onScrollTo(item.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={`t-label focus-visible:ring-ring flex min-h-[2.75rem] w-full items-center gap-3 rounded-xl px-3 transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {item.label}
                  {isActive && <ChevronRight className="ml-auto h-4 w-4" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
});

// List Components
const ProblemList = memo(({ items, onChange }: any) => (
  <div className="space-y-4">
    {items.map((p: any, i: number) => (
      <div key={p.id} className="flex gap-3 group">
        <input
          value={p.text}
          onChange={(e) => {
            const newList = [...items];
            newList[i] = { ...p, text: e.target.value.toUpperCase() };
            onChange(newList);
          }}
          className={inputCls}
        />
        <button
          onClick={() => onChange(items.filter((item: any) => item.id !== p.id))}
          className="touch-target text-muted-foreground hover:text-destructive focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
    ))}
    <button
      onClick={() =>
        onChange([...items, { id: Math.random().toString(36).substr(2, 9), text: "" }])
      }
      className="border-border text-muted-foreground hover:border-primary hover:text-primary focus-visible:ring-ring t-body flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <Plus className="h-4 w-4" /> ADICIONAR PROBLEMA
    </button>
  </div>
));

const AntibioticList = memo(({ items, onChange }: any) => (
  <div className="space-y-8">
    {items.map((a: any, i: number) => (
      <div key={a.id} className="bg-secondary border-border space-y-5 rounded-2xl border p-5">
        <div className="border-border flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-xs">
              D{differenceInDays(new Date(), parseISO(a.dataInicio)) + 1 || "?"}
            </span>
            <span className="t-title text-foreground">{a.nome || "Novo ATB"}</span>
          </div>
          <button
            onClick={() => onChange(items.filter((item: any) => item.id !== a.id))}
            className="touch-target text-muted-foreground hover:text-destructive focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-6">
          <EditableInput
            label="Nome do antibiótico"
            value={a.nome}
            onChange={(v: any) => {
              const list = [...items];
              list[i] = { ...a, nome: v.toUpperCase() };
              onChange(list);
            }}
          />
          <div className="grid grid-cols-2 gap-4">
            <EditableInput
              label="Dose"
              value={a.dose}
              onChange={(v: any) => {
                const list = [...items];
                list[i] = { ...a, dose: v.toUpperCase() };
                onChange(list);
              }}
            />
            <EditableInput
              label="Via"
              value={a.via}
              onChange={(v: any) => {
                const list = [...items];
                list[i] = { ...a, via: v.toUpperCase() };
                onChange(list);
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <EditableInput
              label="Frequência"
              value={a.frequencia}
              onChange={(v: any) => {
                const list = [...items];
                list[i] = { ...a, frequencia: v.toUpperCase() };
                onChange(list);
              }}
            />
            <EditableInput
              label="Data de início"
              type="date"
              value={a.dataInicio}
              onChange={(v: any) => {
                const list = [...items];
                list[i] = { ...a, dataInicio: v };
                onChange(list);
              }}
            />
          </div>
        </div>
      </div>
    ))}
    <button
      onClick={() =>
        onChange([
          ...items,
          {
            id: Math.random().toString(36).substr(2, 9),
            nome: "",
            dose: "",
            via: "EV",
            frequencia: "12/12h",
            dataInicio: new Date().toISOString().slice(0, 10),
          },
        ])
      }
      className="border-border text-muted-foreground hover:border-primary hover:text-primary focus-visible:ring-ring t-body flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <Plus className="h-4 w-4" /> ADICIONAR ANTIBIÓTICO
    </button>
  </div>
));

const MedicationList = memo(({ items, onChange }: any) => (
  <div className="space-y-4">
    {items.map((m: any, i: number) => (
      <div key={m.id} className="flex gap-3">
        <input
          value={m.text}
          onChange={(e) => {
            const list = [...items];
            list[i] = { ...m, text: e.target.value.toUpperCase() };
            onChange(list);
          }}
          className={inputCls}
        />
        <button
          onClick={() => onChange(items.filter((item: any) => item.id !== m.id))}
          className="touch-target text-muted-foreground hover:text-destructive focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
    ))}
    <button
      onClick={() =>
        onChange([...items, { id: Math.random().toString(36).substr(2, 9), text: "" }])
      }
      className="border-border text-muted-foreground hover:border-primary hover:text-primary focus-visible:ring-ring t-body flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <Plus className="h-4 w-4" /> ADICIONAR MEDICAÇÃO
    </button>
  </div>
));

const LabList = memo(({ items, onChange }: any) => (
  <div className="space-y-8">
    {items.map((l: any, i: number) => (
      <div key={l.id} className="bg-secondary border-border rounded-2xl border p-5">
        <div className="border-border flex items-center justify-between border-b pb-3">
          <EditableInput
            type="date"
            value={l.data}
            onChange={(v: any) => {
              const list = [...items];
              list[i] = { ...l, data: v };
              onChange(list);
            }}
          />
          <button
            onClick={() => onChange(items.filter((item: any) => item.id !== l.id))}
            className="touch-target text-muted-foreground hover:text-destructive focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <EditableTextarea
          label="Resultados"
          value={l.valor}
          onChange={(v: any) => {
            const list = [...items];
            list[i] = { ...l, valor: v.toUpperCase() };
            onChange(list);
          }}
          rows={4}
        />
      </div>
    ))}
    <button
      onClick={() =>
        onChange([
          ...items,
          {
            id: Math.random().toString(36).substr(2, 9),
            data: new Date().toISOString().slice(0, 10),
            valor: "",
          },
        ])
      }
      className="border-border text-muted-foreground hover:border-primary hover:text-primary focus-visible:ring-ring t-body flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <Plus className="h-4 w-4" /> ADICIONAR EXAME
    </button>
  </div>
));

const SimpleList = memo(({ items, onChange, placeholder }: any) => (
  <div className="space-y-4">
    {items.map((c: any, i: number) => (
      <div key={c.id} className="flex gap-3">
        <input
          value={c.text}
          onChange={(e) => {
            const list = [...items];
            list[i] = { ...c, text: e.target.value.toUpperCase() };
            onChange(list);
          }}
          className={inputCls}
          placeholder={placeholder}
        />
        <button
          onClick={() => onChange(items.filter((item: any) => item.id !== c.id))}
          className="touch-target text-muted-foreground hover:text-destructive focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
    ))}
    <button
      onClick={() =>
        onChange([...items, { id: Math.random().toString(36).substr(2, 9), text: "" }])
      }
      className="border-border text-muted-foreground hover:border-primary hover:text-primary focus-visible:ring-ring t-body flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <Plus className="h-4 w-4" /> ADICIONAR ITEM
    </button>
  </div>
));

function inferFromFilename(filename: string) {
  if (!filename || filename === "documento") return { nome: "", leito: "" };
  const leitoMatch = filename.match(/^[Ll]\s*([0-9]{1,3})[A-Za-z]?/i);
  const leito = leitoMatch ? `L${leitoMatch[1].padStart(2, "0")}` : "";
  const nameOnly = filename.replace(/\.[^/.]+$/, "");
  const cleanName = leitoMatch
    ? nameOnly.replace(leitoMatch[0], "").replace(/^[\s\-_]+/, "")
    : nameOnly;
  const parts = cleanName.split(/\s*[-_]\s*/);
  return { nome: parts[0].trim().toUpperCase(), leito };
}

// ─── Main Component ──────────────────────────────────────────────────────────

function RevisarExtracao() {
  const search = Route.useSearch() as any;
  const patient_id = search?.patient_id;
  const nav = useNavigate();
  const { userId } = useSupabaseUser();
  const [data, setData] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.offsetTop - 120, behavior: "smooth" });
  }, []);

  const updateField = useCallback((path: string, value: any) => {
    setData((prev: any) => {
      if (!prev) return prev;
      const newData = { ...prev };
      const keys = path.split(".");
      let current = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  }, []);

  useEffect(() => {
    const raw = storage.getExtracaoResultado();
    if (!raw) {
      toast.error("Nenhum dado de extração encontrado.");
      nav({ to: "/dashboard" });
      return;
    }
    try {
      let parsed = JSON.parse(raw);
      if (parsed && parsed.extracted) parsed = parsed.extracted;
      if (!parsed || typeof parsed !== "object") throw new Error("Dados inválidos");

      const filename = storage.getJobArquivo() || "Documento";
      const inferred = inferFromFilename(filename);

      setData({
        nome: parsed.nome || inferred.nome || "",
        idade: parsed.idade || "",
        sexo: parsed.sexo || "F",
        leito: parsed.leito || inferred.leito || "",
        setor: parsed.setor || "",
        data_admissao: parsed.data_admissao || new Date().toISOString().slice(0, 10),
        hda: parsed.hda || "",
        motivo_admissao: parsed.motivo_admissao || "",
        lista_de_problemas: Array.isArray(parsed.lista_de_problemas)
          ? parsed.lista_de_problemas.map((p: any) => ({
              id: Math.random().toString(36).substr(2, 9),
              text: typeof p === "string" ? p : p.text || "",
            }))
          : [],
        antibioticos: Array.isArray(parsed.antibioticos)
          ? parsed.antibioticos.map((a: any) => ({
              id: Math.random().toString(36).substr(2, 9),
              nome: typeof a === "string" ? a : a.nome || "",
              dose: a.dose || "",
              via: a.via || "",
              frequencia: a.frequencia || "",
              dataInicio: a.dataInicio || a.data_inicio || new Date().toISOString().slice(0, 10),
            }))
          : [],
        medicacoes: Array.isArray(parsed.medicacoes)
          ? parsed.medicacoes.map((m: any) => ({
              id: Math.random().toString(36).substr(2, 9),
              text: typeof m === "string" ? m : m.text || "",
            }))
          : [],
        laboratorios: Array.isArray(parsed.laboratorios)
          ? parsed.laboratorios.map((l: any) => ({
              id: Math.random().toString(36).substr(2, 9),
              data: l.data || new Date().toISOString().slice(0, 10),
              valor: typeof l === "string" ? l : l.valor || l.texto_compacto || "",
            }))
          : [],
        exame_fisico_detalhado: parsed.exame_fisico_detalhado || {
          geral: "",
          acv: "",
          ar: "",
          abdome: "",
          neuro: "",
          extremidades: "",
          pele: "",
        },
        condutas: Array.isArray(parsed.condutas)
          ? parsed.condutas.map((c: any) => ({
              id: Math.random().toString(36).substr(2, 9),
              text: typeof c === "string" ? c : c.text || "",
            }))
          : [],
        pendencias: Array.isArray(parsed.pendencias)
          ? parsed.pendencias.map((p: any) => ({
              id: Math.random().toString(36).substr(2, 9),
              text: typeof p === "string" ? p : p.text || "",
            }))
          : [],
        alertas: Array.isArray(parsed.alertas) ? parsed.alertas : [],
      });
    } catch (e) {
      toast.error("Erro ao carregar dados.");
      nav({ to: "/dashboard" });
    }
  }, [nav, patient_id]);

  const handleSave = async () => {
    if (saving || !userId) return;
    setSaving(true);
    try {
      const shiftId = storage.getShiftId();
      if (!shiftId) throw new Error("Sessão inválida");
      const patientPayload = {
        name: data.nome,
        age: data.idade,
        sex: data.sexo,
        bed: data.leito,
        sector: data.setor,
        admission_date: data.data_admissao,
        reason_for_admission: data.motivo_admissao,
        hda: data.hda,
        problem_list: data.lista_de_problemas.map((p: any) => p.text),
        antibiotics: data.antibioticos.map((a: any) => ({
          nome: a.nome,
          dose: a.dose,
          via: a.via,
          frequencia: a.frequencia,
          data_inicio: a.dataInicio,
        })),
        medications: data.medicacoes.map((m: any) => m.text),
        labs: data.laboratorios.map((l: any) => ({ data: l.data, texto_compacto: l.valor })),
        physical_exam: data.exame_fisico_detalhado,
        conducts: data.condutas.map((c: any) => c.text),
        pending_issues: data.pendencias.map((p: any) => p.text),
      };

      let savedPatient;
      try {
        if (patient_id && !patient_id.startsWith("temp_")) {
          savedPatient = await mergePatientData(patient_id, patientPayload, userId);
        } else if (patient_id && patient_id.startsWith("temp_")) {
          savedPatient = storage.mergeLocalPatient(patient_id, patientPayload);
        } else {
          savedPatient = await createPatient(
            {
              ...patientPayload,
              shift_id: shiftId,
              status: "internado",
              tipo_admissao: "admissao",
            },
            userId,
          );
        }
        storage.clearExtracaoResultado();
        toast.success("Salvo com sucesso!");
        nav({ to: "/paciente/$id", params: { id: savedPatient.id } });
      } catch {
        // Fallback local
        const localId = patient_id || "temp_" + Date.now();
        const existing = storage.getLocalPacientes();
        existing.push({ id: localId, ...patientPayload, status: "internado" });
        storage.setLocalPacientes(existing);
        storage.clearExtracaoResultado();
        toast.success("Salvo localmente!");
        nav({ to: "/paciente/$id", params: { id: localId } });
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!data)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="bg-background min-h-screen">
      <header className="bg-background/90 border-border sticky top-0 z-50 border-b backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="bg-secondary text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            >
              <X className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="t-title text-foreground">Conferir o que a IA leu</h1>
              <p className="t-label text-muted-foreground flex items-center gap-2 font-normal">
                <Clock className="h-3 w-3" /> {storage.getJobArquivo()}
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            data-testid="extraction-save"
            className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex min-h-[2.75rem] shrink-0 items-center gap-2 rounded-2xl px-5 text-base font-bold focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-5 w-5" aria-hidden="true" /> Salvar
              </>
            )}
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-8 px-4 py-6 sm:px-6">
        <Sidebar onScrollTo={scrollTo} />
        <main className="max-w-3xl flex-1 space-y-8 pb-24">
          {patient_id && (
            <div className="bg-primary/5 border-primary/20 flex items-center gap-4 rounded-3xl border p-5">
              <div className="bg-primary text-primary-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
                <Plus className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="t-title text-primary">Adicionando a um paciente existente</h3>
                <p className="t-body text-muted-foreground">
                  Dados extraídos serão mesclados ao prontuário.
                </p>
              </div>
            </div>
          )}

          <Section id="identificacao" title="Identificação" icon={<User className="h-5 w-5" />}>
            <div className="space-y-8">
              <EditableInput
                label="Nome completo"
                value={data.nome}
                onChange={(v: any) => updateField("nome", v)}
                uppercase
              />
              <EditableInput
                label="Idade"
                type="number"
                value={data.idade}
                onChange={(v: any) => updateField("idade", v)}
              />
              <div className="space-y-2">
                <span className="t-label text-muted-foreground">Sexo</span>
                <div className="bg-secondary flex gap-1.5 rounded-2xl p-1.5">
                  {["F", "M"].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateField("sexo", s)}
                      className={`focus-visible:ring-ring min-h-[2.75rem] flex-1 rounded-xl text-base font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none ${data.sexo === s ? "bg-card text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {s === "F" ? "FEMININO" : "MASCULINO"}
                    </button>
                  ))}
                </div>
              </div>
              <EditableInput
                label="Leito"
                value={data.leito}
                onChange={(v: any) => updateField("leito", v)}
                uppercase
              />
              <EditableInput
                label="Setor"
                value={data.setor}
                onChange={(v: any) => updateField("setor", v)}
              />
              <EditableInput
                label="Data de admissão"
                type="date"
                value={data.data_admissao}
                onChange={(v: any) => updateField("data_admissao", v)}
              />
            </div>
          </Section>

          <Section id="hda" title="História e motivo" icon={<Stethoscope className="h-5 w-5" />}>
            <div className="space-y-8">
              <EditableTextarea
                label="Motivo da admissão"
                value={data.motivo_admissao}
                onChange={(v: any) => updateField("motivo_admissao", v)}
                rows={3}
              />
              <EditableTextarea
                label="História da doença atual"
                value={data.hda}
                onChange={(v: any) => updateField("hda", v)}
                rows={10}
              />
            </div>
          </Section>

          <Section
            id="problemas"
            title="Lista de problemas"
            icon={<ClipboardList className="h-5 w-5" />}
          >
            <ProblemList
              items={data.lista_de_problemas}
              onChange={(newList: any) => updateField("lista_de_problemas", newList)}
            />
          </Section>

          <Section id="antibioticos" title="Antibióticos" icon={<Pill className="h-5 w-5" />}>
            <AntibioticList
              items={data.antibioticos}
              onChange={(newList: any) => updateField("antibioticos", newList)}
            />
          </Section>

          <Section id="medicacoes" title="Medicações" icon={<Activity className="h-5 w-5" />}>
            <MedicationList
              items={data.medicacoes}
              onChange={(newList: any) => updateField("medicacoes", newList)}
            />
          </Section>

          <Section
            id="laboratorios"
            title="Laboratório"
            icon={<FlaskConical className="h-5 w-5" />}
          >
            <LabList
              items={data.laboratorios}
              onChange={(newList: any) => updateField("laboratorios", newList)}
            />
          </Section>

          <Section id="exame-fisico" title="Exame físico" icon={<Heart className="h-5 w-5" />}>
            <div className="space-y-8">
              {[
                { k: "geral", l: "GERAL" },
                { k: "acv", l: "CARDIOVASCULAR" },
                { k: "ar", l: "RESPIRATÓRIO" },
                { k: "abdome", l: "ABDOME" },
                { k: "neuro", l: "NEUROLÓGICO" },
                { k: "extremidades", l: "EXTREMIDADES" },
                { k: "pele", l: "PELE / Fâneros" },
              ].map((f) => (
                <EditableInput
                  key={f.k}
                  label={f.l}
                  value={data.exame_fisico_detalhado[f.k]}
                  onChange={(v: any) => updateField(`exame_fisico_detalhado.${f.k}`, v)}
                />
              ))}
            </div>
          </Section>

          <Section id="condutas" title="Condutas" icon={<ClipboardList className="h-5 w-5" />}>
            <SimpleList
              items={data.condutas}
              onChange={(newList: any) => updateField("condutas", newList)}
            />
          </Section>

          <Section id="pendencias" title="Pendências" icon={<AlertTriangle className="h-5 w-5" />}>
            <SimpleList
              items={data.pendencias}
              onChange={(newList: any) => updateField("pendencias", newList)}
            />
          </Section>

          {data.alertas && data.alertas.length > 0 && (
            <Section
              id="alertas"
              title="Alertas da IA"
              icon={<AlertCircle className="text-destructive h-5 w-5" />}
            >
              <div className="space-y-4">
                {data.alertas.map((alerta: string, i: number) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4"
                  >
                    <Info
                      className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
                      aria-hidden="true"
                    />
                    <p className="t-body text-foreground">{alerta}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </main>
      </div>
    </div>
  );
}

export default RevisarExtracao;
