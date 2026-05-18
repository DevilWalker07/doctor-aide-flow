import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo, memo, useCallback } from "react";
import { 
  User, Stethoscope, ClipboardList, FlaskConical, AlertCircle, 
  Trash2, Plus, Save, RefreshCw, X, AlertTriangle, Pill, Calendar,
  Activity, ArrowRight, CheckCircle2, LayoutList, ChevronRight,
  Clock, Heart, Info
} from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, parseISO, isValid } from "date-fns";
import { createPatient, mergePatientData, type Patient } from "@/lib/db";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { storage } from "@/lib/storage";
import { ANTIBIOTICOS_ROTINEIROS, searchAntibioticos, type AntibioticoRotineiro } from "@/lib/antibioticos-rotineiros";

export const Route = createFileRoute("/revisar-extracao")({
  component: RevisarExtracao,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      patient_id: search.patient_id as string | undefined,
    };
  },
  head: () => ({ meta: [{ title: "Revisar Extração — DOUTOR AJUDA" }] }),
});

// ─── Styles ──────────────────────────────────────────────────────────────────
const inputCls = "w-full bg-elevated border border-border rounded-2xl px-5 py-4 text-sm font-semibold text-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/50 transition-all placeholder:text-slate-300 shadow-sm";
const textareaCls = "w-full bg-elevated border border-border rounded-2xl px-5 py-5 text-sm font-semibold text-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/50 transition-all leading-relaxed placeholder:text-slate-300 shadow-sm";

// ─── Components ──────────────────────────────────────────────────────────────

const EditableTextarea = memo(({ value, onChange, label, rows = 4, placeholder }: any) => {
  const [local, setLocal] = useState(value || "");
  useEffect(() => { setLocal(value || ""); }, [value]);
  const handleBlur = () => { if (local !== value) onChange(local); };
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">{label}</label>
      <textarea value={local} onChange={(e) => setLocal(e.target.value)} onBlur={handleBlur} rows={rows} className={textareaCls} placeholder={placeholder} />
    </div>
  );
});

const EditableInput = memo(({ value, onChange, label, type = "text", placeholder, uppercase = false }: any) => {
  const [local, setLocal] = useState(value || "");
  useEffect(() => { setLocal(value || ""); }, [value]);
  const handleBlur = () => {
    let v = local;
    if (uppercase && typeof v === 'string') v = v.toUpperCase();
    if (v !== value) onChange(v);
  };
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">{label}</label>
      <input type={type} value={local} onChange={(e) => setLocal(e.target.value)} onBlur={handleBlur} className={inputCls} placeholder={placeholder} />
    </div>
  );
});

const Section = memo(({ id, title, icon, children }: { id: string, title: string, icon: any, children: any }) => (
  <section id={id} className="scroll-mt-32">
    <div className="flex items-center gap-3 mb-6">
      <div className="h-10 w-10 rounded-xl bg-elevated border border-border flex items-center justify-center text-muted-foreground shadow-sm">{icon}</div>
      <h2 className="text-xs font-black tracking-[0.2em] uppercase text-foreground">{title}</h2>
    </div>
    <div className="bg-elevated border border-border rounded-[2.5rem] p-8 md:p-10 shadow-sm space-y-8">{children}</div>
  </section>
));

const SIDEBAR_ITEMS = [
  { id: "identificacao", label: "Identificação", icon: User },
  { id: "hda", label: "HDA / Motivo", icon: Stethoscope },
  { id: "problemas", label: "Problemas", icon: ClipboardList },
  { id: "antibioticos", label: "Antibióticos", icon: Pill },
  { id: "medicacoes", label: "Medicações", icon: Activity },
  { id: "laboratorios", label: "Laboratórios", icon: FlaskConical },
  { id: "exame-fisico", label: "Exame Físico", icon: Activity },
  { id: "condutas", label: "Condutas", icon: ClipboardList },
  { id: "pendencias", label: "Pendências", icon: AlertTriangle },
  { id: "alertas", label: "Alertas", icon: AlertCircle },
];

const Sidebar = memo(({ onScrollTo }: { onScrollTo: (id: string) => void }) => {
  const [active, setActive] = useState("identificacao");
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.find(e => e.isIntersecting);
      if (visible) setActive(visible.target.id);
    }, { threshold: 0.2, rootMargin: "-100px 0px -60% 0px" });
    const sections = document.querySelectorAll("section[id]");
    sections.forEach(s => observer.observe(s));
    return () => sections.forEach(s => observer.unobserve(s));
  }, []);
  return (
    <aside className="w-72 hidden md:block sticky top-32 self-start space-y-2">
      <div className="bg-elevated/50 border border-border rounded-[2rem] p-3 space-y-1">
        {SIDEBAR_ITEMS.map(item => {
          const isActive = active === item.id;
          const Icon = item.icon;
          return (
            <button key={item.id} onClick={() => onScrollTo(item.id)} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all ${isActive ? "bg-elevated text-primary shadow-sm" : "text-muted-foreground hover:text-foreground/80 hover:bg-elevated/30"}`}>
              <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-slate-300"}`} />
              {item.label}
              {isActive && <ChevronRight className="ml-auto h-3 w-3" />}
            </button>
          );
        })}
      </div>
    </aside>
  );
});

// List Components
const ProblemList = memo(({ items, onChange }: any) => (
  <div className="space-y-4">
    {items.map((p: any, i: number) => (
      <div key={p.id} className="flex gap-3 group">
        <input value={p.text} onChange={(e) => {
          const newList = [...items];
          newList[i] = { ...p, text: e.target.value.toUpperCase() };
          onChange(newList);
        }} className={inputCls} />
        <button onClick={() => onChange(items.filter((item: any) => item.id !== p.id))} className="p-4 text-muted-foreground hover:text-red-500 rounded-2xl"><Trash2 className="h-5 w-5" /></button>
      </div>
    ))}
    <button onClick={() => onChange([...items, { id: Math.random().toString(36).substr(2, 9), text: "" }])} className="w-full py-5 border-2 border-dashed border-border rounded-[2rem] text-[11px] font-black text-muted-foreground flex items-center justify-center gap-3"><Plus className="h-4 w-4" /> ADICIONAR PROBLEMA</button>
  </div>
));

const AntibioticList = memo(({ items, onChange }: any) => {
  const today = new Date().toISOString().slice(0, 10);
  const addRotineiro = (atb: AntibioticoRotineiro) => {
    onChange([...items, {
      id: Math.random().toString(36).substr(2, 9),
      nome: atb.nome,
      dose: atb.dose,
      via: atb.via,
      frequencia: atb.frequencia,
      dataInicio: today,
    }]);
  };
  return (
    <div className="space-y-8">
      <div className="bg-ai/5 border border-ai/20 rounded-2xl p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-ai mb-3">
          ADICIONAR ROTINEIRO (1 CLIQUE)
        </p>
        <div className="flex flex-wrap gap-2">
          {ANTIBIOTICOS_ROTINEIROS.map((atb) => (
            <button
              key={atb.nome}
              type="button"
              onClick={() => addRotineiro(atb)}
              className="px-3 py-1.5 rounded-lg bg-elevated border border-ai/30 text-ai text-[10px] font-black uppercase tracking-wider hover:bg-ai hover:text-white transition-all"
              title={`${atb.dose} ${atb.via} ${atb.frequencia}`}
            >
              + {atb.nome.replace("PIPERACILINA + TAZOBACTAM", "PIP-TAZO").replace("AMOXICILINA + CLAVULANATO", "AMOXI-CLAV")}
            </button>
          ))}
        </div>
      </div>
      {items.map((a: any, i: number) => (
        <div key={a.id} className="bg-subtle border border-border rounded-[2.5rem] p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-2">
               <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-xs">D{differenceInDays(new Date(), parseISO(a.dataInicio)) + 1 || "?"}</span>
               <span className="text-xs font-black text-foreground uppercase tracking-wider">{a.nome || "Novo ATB"}</span>
            </div>
            <button onClick={() => onChange(items.filter((item: any) => item.id !== a.id))} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
          </div>
          <div className="space-y-6">
            <AntibioticNameAutocomplete
              value={a.nome}
              onSelect={(atb) => {
                const list = [...items];
                list[i] = { ...a, nome: atb.nome, dose: a.dose || atb.dose, via: a.via || atb.via, frequencia: a.frequencia || atb.frequencia };
                onChange(list);
              }}
              onTextChange={(v) => { const list = [...items]; list[i] = { ...a, nome: v.toUpperCase() }; onChange(list); }}
            />
            <div className="grid grid-cols-2 gap-4">
               <EditableInput label="DOSE" value={a.dose} onChange={(v: any) => { const list = [...items]; list[i] = { ...a, dose: v.toUpperCase() }; onChange(list); }} />
               <EditableInput label="VIA" value={a.via} onChange={(v: any) => { const list = [...items]; list[i] = { ...a, via: v.toUpperCase() }; onChange(list); }} />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <EditableInput label="FREQUÊNCIA" value={a.frequencia} onChange={(v: any) => { const list = [...items]; list[i] = { ...a, frequencia: v.toUpperCase() }; onChange(list); }} />
               <EditableInput label="DATA INÍCIO" type="date" value={a.dataInicio} onChange={(v: any) => { const list = [...items]; list[i] = { ...a, dataInicio: v }; onChange(list); }} />
            </div>
          </div>
        </div>
      ))}
      <button onClick={() => onChange([...items, { id: Math.random().toString(36).substr(2, 9), nome: "", dose: "", via: "EV", frequencia: "12/12h", dataInicio: today }])} className="w-full py-5 border-2 border-dashed border-border rounded-[2rem] text-[11px] font-black text-muted-foreground flex items-center justify-center gap-3"><Plus className="h-4 w-4" /> ADICIONAR ATB MANUAL</button>
    </div>
  );
});

const AntibioticNameAutocomplete = ({ value, onSelect, onTextChange }: {
  value: string;
  onSelect: (atb: AntibioticoRotineiro) => void;
  onTextChange: (v: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(() => value ? searchAntibioticos(value, 6) : [], [value]);
  return (
    <div className="relative">
      <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">NOME DO ANTIBIÓTICO</label>
      <input
        value={value}
        onChange={(e) => { onTextChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="w-full px-5 py-4 rounded-2xl border border-border bg-elevated text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-primary/40"
        placeholder="Digite ou escolha..."
      />
      {open && suggestions.length > 0 && value && !suggestions.some(s => s.nome === value.toUpperCase()) && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-elevated border border-border rounded-2xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
          {suggestions.map((atb) => (
            <button
              key={atb.nome}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onSelect(atb); setOpen(false); }}
              className="w-full text-left px-5 py-3 hover:bg-secondary border-b border-border last:border-b-0"
            >
              <p className="text-xs font-black uppercase tracking-wider">{atb.nome}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">{atb.dose} · {atb.via} · {atb.frequencia}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const MedicationList = memo(({ items, onChange }: any) => (
  <div className="space-y-4">
    {items.map((m: any, i: number) => (
      <div key={m.id} className="flex gap-3">
        <input value={m.text} onChange={(e) => { const list = [...items]; list[i] = { ...m, text: e.target.value.toUpperCase() }; onChange(list); }} className={inputCls} />
        <button onClick={() => onChange(items.filter((item: any) => item.id !== m.id))} className="p-4 text-muted-foreground hover:text-red-500 rounded-2xl"><Trash2 className="h-5 w-5" /></button>
      </div>
    ))}
    <button onClick={() => onChange([...items, { id: Math.random().toString(36).substr(2, 9), text: "" }])} className="w-full py-5 border-2 border-dashed border-border rounded-[2rem] text-[11px] font-black text-muted-foreground flex items-center justify-center gap-3"><Plus className="h-4 w-4" /> ADICIONAR MEDICAÇÃO</button>
  </div>
));

const LabList = memo(({ items, onChange }: any) => (
  <div className="space-y-8">
    {items.map((l: any, i: number) => (
      <div key={l.id} className="bg-elevated border border-border rounded-[2rem] p-8 shadow-sm">
        <div className="flex justify-between items-center border-b border-border pb-4">
          <EditableInput type="date" value={l.data} onChange={(v: any) => { const list = [...items]; list[i] = { ...l, data: v }; onChange(list); }} />
          <button onClick={() => onChange(items.filter((item: any) => item.id !== l.id))} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
        </div>
        <EditableTextarea label="RESULTADOS EXAMES" value={l.valor} onChange={(v: any) => { const list = [...items]; list[i] = { ...l, valor: v.toUpperCase() }; onChange(list); }} rows={4} />
      </div>
    ))}
    <button onClick={() => onChange([...items, { id: Math.random().toString(36).substr(2, 9), data: new Date().toISOString().slice(0, 10), valor: "" }])} className="w-full py-5 border-2 border-dashed border-border rounded-[2rem] text-[11px] font-black text-muted-foreground flex items-center justify-center gap-3"><Plus className="h-4 w-4" /> ADICIONAR EXAME</button>
  </div>
));

const SimpleList = memo(({ items, onChange, placeholder }: any) => (
  <div className="space-y-4">
    {items.map((c: any, i: number) => (
      <div key={c.id} className="flex gap-3">
        <input value={c.text} onChange={(e) => { const list = [...items]; list[i] = { ...c, text: e.target.value.toUpperCase() }; onChange(list); }} className={inputCls} placeholder={placeholder} />
        <button onClick={() => onChange(items.filter((item: any) => item.id !== c.id))} className="p-4 text-muted-foreground hover:text-red-500 rounded-2xl"><Trash2 className="h-5 w-5" /></button>
      </div>
    ))}
    <button onClick={() => onChange([...items, { id: Math.random().toString(36).substr(2, 9), text: "" }])} className="w-full py-5 border-2 border-dashed border-border rounded-[2rem] text-[11px] font-black text-muted-foreground flex items-center justify-center gap-3"><Plus className="h-4 w-4" /> ADICIONAR ITEM</button>
  </div>
));

function inferFromFilename(filename: string) {
  if (!filename || filename === 'documento') return { nome: "", leito: "" };
  const leitoMatch = filename.match(/^[Ll]\s*([0-9]{1,3})[A-Za-z]?/i);
  const leito = leitoMatch ? `L${leitoMatch[1].padStart(2, '0')}` : "";
  const nameOnly = filename.replace(/\.[^/.]+$/, "");
  const cleanName = leitoMatch ? nameOnly.replace(leitoMatch[0], "").replace(/^[\s\-_]+/, "") : nameOnly;
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
      const keys = path.split('.');
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
      if (!parsed || typeof parsed !== 'object') throw new Error("Dados inválidos");

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
        lista_de_problemas: Array.isArray(parsed.lista_de_problemas) ? parsed.lista_de_problemas.map((p: any) => ({ id: Math.random().toString(36).substr(2, 9), text: typeof p === 'string' ? p : (p.text || "") })) : [],
        antibioticos: Array.isArray(parsed.antibioticos) ? parsed.antibioticos.map((a: any) => ({ id: Math.random().toString(36).substr(2, 9), nome: typeof a === 'string' ? a : (a.nome || ""), dose: a.dose || "", via: a.via || "", frequencia: a.frequencia || "", dataInicio: a.dataInicio || a.data_inicio || new Date().toISOString().slice(0, 10) })) : [],
        medicacoes: Array.isArray(parsed.medicacoes) ? parsed.medicacoes.map((m: any) => ({ id: Math.random().toString(36).substr(2, 9), text: typeof m === 'string' ? m : (m.text || "") })) : [],
        laboratorios: Array.isArray(parsed.laboratorios) ? parsed.laboratorios.map((l: any) => ({ id: Math.random().toString(36).substr(2, 9), data: l.data || new Date().toISOString().slice(0, 10), valor: typeof l === 'string' ? l : (l.valor || l.texto_compacto || "") })) : [],
        exame_fisico_detalhado: parsed.exame_fisico_detalhado || { geral: "", acv: "", ar: "", abdome: "", neuro: "", extremidades: "", pele: "" },
        condutas: Array.isArray(parsed.condutas) ? parsed.condutas.map((c: any) => ({ id: Math.random().toString(36).substr(2, 9), text: typeof c === 'string' ? c : (c.text || "") })) : [],
        pendencias: Array.isArray(parsed.pendencias) ? parsed.pendencias.map((p: any) => ({ id: Math.random().toString(36).substr(2, 9), text: typeof p === 'string' ? p : (p.text || "") })) : [],
        alertas: Array.isArray(parsed.alertas) ? parsed.alertas : []
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
        name: data.nome, age: data.idade, sex: data.sexo, bed: data.leito, sector: data.setor,
        admission_date: data.data_admissao, reason_for_admission: data.motivo_admissao, hda: data.hda,
        problem_list: data.lista_de_problemas.map((p: any) => p.text),
        antibiotics: data.antibioticos.map((a: any) => ({
          nome: a.nome, dose: a.dose, via: a.via, frequencia: a.frequencia,
          data_inicio: a.dataInicio,
          ...(a.dataFim || a.data_fim ? { data_fim: a.dataFim || a.data_fim } : {}),
          ...(a.status ? { status: a.status } : {}),
        })),
        medications: data.medicacoes.map((m: any) => m.text),
        labs: data.laboratorios.map((l: any) => ({ data: l.data, texto_compacto: l.valor })),
        physical_exam: data.exame_fisico_detalhado,
        conducts: data.condutas.map((c: any) => c.text),
        pending_issues: data.pendencias.map((p: any) => p.text)
      };
      
      let savedPatient;
      try {
        if (patient_id && !patient_id.startsWith("temp_")) {
          savedPatient = await mergePatientData(patient_id, patientPayload, userId);
        } else if (patient_id && patient_id.startsWith("temp_")) {
          savedPatient = storage.mergeLocalPatient(patient_id, patientPayload);
        } else {
          savedPatient = await createPatient({ ...patientPayload, shift_id: shiftId, status: 'internado', tipo_admissao: 'admissao' }, userId);
        }
        storage.clearExtracaoResultado();
        toast.success("Salvo com sucesso!");
        nav({ to: "/paciente/$id", params: { id: savedPatient.id } });
      } catch {
        // Fallback local — sempre marca o paciente com o shift_id ATIVO
        // para que ele apareça apenas no dashboard daquele plantão.
        const localId = patient_id || "temp_" + Date.now();
        const existing = storage.getLocalPacientes();
        const existingIdx = existing.findIndex((p: any) => p.id === localId);
        if (existingIdx >= 0) {
          existing[existingIdx] = { ...existing[existingIdx], ...patientPayload, shift_id: shiftId, status: 'internado' };
        } else {
          existing.push({ id: localId, ...patientPayload, shift_id: shiftId, status: 'internado' });
        }
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

  if (!data) return <div className="min-h-screen flex items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-subtle">
      <header className="bg-elevated/80 backdrop-blur-xl border-b border-border sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="h-10 w-10 rounded-xl bg-subtle flex items-center justify-center text-muted-foreground"><X className="h-5 w-5" /></Link>
            <div>
              <h1 className="text-sm font-black text-foreground uppercase">REVISAR EXTRAÇÃO</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2"><Clock className="h-3 w-3" /> {storage.getJobArquivo()}</p>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="bg-primary text-white px-8 py-3.5 rounded-xl font-bold text-xs uppercase flex items-center gap-3 shadow-xl disabled:opacity-50">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> SALVAR DADOS</>}
          </button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-10 flex gap-12">
        <Sidebar onScrollTo={scrollTo} />
        <main className="flex-1 max-w-3xl space-y-16 pb-40">
          {patient_id && (
            <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 flex items-center gap-6">
              <div className="h-14 w-14 rounded-2xl bg-primary text-white flex items-center justify-center shrink-0"><Plus className="h-8 w-8" /></div>
              <div>
                 <h3 className="text-sm font-black text-primary uppercase mb-1">MODO: ADICIONAR AO PACIENTE</h3>
                 <p className="text-xs text-muted-foreground font-bold">Dados extraídos serão mesclados ao prontuário.</p>
              </div>
            </div>
          )}

          <Section id="identificacao" title="IDENTIFICAÇÃO" icon={<User className="h-5 w-5" />}>
            <div className="space-y-8">
              <EditableInput label="NOME COMPLETO" value={data.nome} onChange={(v: any) => updateField('nome', v)} uppercase />
              <EditableInput label="IDADE" type="number" value={data.idade} onChange={(v: any) => updateField('idade', v)} />
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">SEXO</label>
                <div className="flex bg-subtle rounded-2xl p-1.5 gap-1.5">
                  {["F", "M"].map(s => (
                    <button key={s} onClick={() => updateField('sexo', s)} className={`flex-1 py-4 rounded-xl text-xs font-black transition-all ${data.sexo === s ? "bg-elevated text-primary shadow-sm" : "text-muted-foreground"}`}>
                      {s === "F" ? "FEMININO" : "MASCULINO"}
                    </button>
                  ))}
                </div>
              </div>
              <EditableInput label="LEITO" value={data.leito} onChange={(v: any) => updateField('leito', v)} uppercase />
              <EditableInput label="SETOR" value={data.setor} onChange={(v: any) => updateField('setor', v)} />
              <EditableInput label="DATA ADMISSÃO" type="date" value={data.data_admissao} onChange={(v: any) => updateField('data_admissao', v)} />
            </div>
          </Section>

          <Section id="hda" title="HDA / MOTIVO" icon={<Stethoscope className="h-5 w-5" />}>
            <div className="space-y-8">
              <EditableTextarea label="MOTIVO ADMISSÃO" value={data.motivo_admissao} onChange={(v: any) => updateField('motivo_admissao', v)} rows={3} />
              <EditableTextarea label="HDA (HISTÓRIA DA DOENÇA ATUAL)" value={data.hda} onChange={(v: any) => updateField('hda', v)} rows={10} />
            </div>
          </Section>

          <Section id="problemas" title="LISTA DE PROBLEMAS" icon={<ClipboardList className="h-5 w-5" />}>
            <ProblemList items={data.lista_de_problemas} onChange={(newList: any) => updateField('lista_de_problemas', newList)} />
          </Section>

          <Section id="antibioticos" title="ANTIBIÓTICOS" icon={<Pill className="h-5 w-5" />}>
            <AntibioticList items={data.antibioticos} onChange={(newList: any) => updateField('antibioticos', newList)} />
          </Section>

          <Section id="medicacoes" title="MEDICAÇÕES" icon={<Activity className="h-5 w-5" />}>
             <MedicationList items={data.medicacoes} onChange={(newList: any) => updateField('medicacoes', newList)} />
          </Section>

          <Section id="laboratorios" title="LABORATÓRIOS" icon={<FlaskConical className="h-5 w-5" />}>
            <LabList items={data.laboratorios} onChange={(newList: any) => updateField('laboratorios', newList)} />
          </Section>

          <Section id="exame-fisico" title="EXAME FÍSICO" icon={<Heart className="h-5 w-5" />}>
            <div className="space-y-8">
              {[
                { k: "geral", l: "GERAL" }, 
                { k: "acv", l: "CARDIOVASCULAR" }, 
                { k: "ar", l: "RESPIRATÓRIO" }, 
                { k: "abdome", l: "ABDOME" }, 
                { k: "neuro", l: "NEUROLÓGICO" },
                { k: "extremidades", l: "EXTREMIDADES" },
                { k: "pele", l: "PELE / Fâneros" }
              ].map(f => (
                <EditableInput key={f.k} label={f.l} value={data.exame_fisico_detalhado[f.k]} onChange={(v: any) => updateField(`exame_fisico_detalhado.${f.k}`, v)} />
              ))}
            </div>
          </Section>

          <Section id="condutas" title="CONDUTAS" icon={<ClipboardList className="h-5 w-5" />}>
             <SimpleList items={data.condutas} onChange={(newList: any) => updateField('condutas', newList)} />
          </Section>

          <Section id="pendencias" title="PENDÊNCIAS" icon={<AlertTriangle className="h-5 w-5" />}>
             <SimpleList items={data.pendencias} onChange={(newList: any) => updateField('pendencias', newList)} />
          </Section>

          {data.alertas && data.alertas.length > 0 && (
            <Section id="alertas" title="ALERTAS DA IA" icon={<AlertCircle className="h-5 w-5 text-red-500" />}>
              <div className="space-y-4">
                {data.alertas.map((alerta: string, i: number) => (
                  <div key={i} className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4">
                    <Info className="h-5 w-5 text-amber-500" />
                    <p className="text-xs font-bold uppercase text-amber-900">{alerta}</p>
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
