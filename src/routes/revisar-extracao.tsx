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

export const Route = createFileRoute("/revisar-extracao")({
  component: RevisarExtracao,
  head: () => ({ meta: [{ title: "Revisar Extração — DOUTOR AJUDA" }] }),
});

// ─── Components ──────────────────────────────────────────────────────────────

// Optimized Input with local state to prevent global freezing
const EditableTextarea = memo(({ value, onChange, label, rows = 4, placeholder }: any) => {
  const [local, setLocal] = useState(value);
  
  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleBlur = () => {
    if (local !== value) {
      onChange(local);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <textarea 
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

const EditableInput = memo(({ value, onChange, label, type = "text", placeholder, uppercase = false }: any) => {
  const [local, setLocal] = useState(value);
  
  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleBlur = () => {
    let v = local;
    if (uppercase && typeof v === 'string') v = v.toUpperCase();
    if (v !== value) {
      onChange(v);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <input 
        type={type}
        value={local} 
        onChange={(e) => setLocal(e.target.value)}
        onBlur={handleBlur}
        className={inputCls} 
        placeholder={placeholder}
      />
    </div>
  );
});

const Section = memo(({ id, title, icon, children }: { id: string, title: string, icon: any, children: any }) => {
  return (
    <section id={id} className="scroll-mt-32">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm">
          {icon}
        </div>
        <h2 className="text-xs font-black tracking-[0.2em] uppercase text-slate-900">{title}</h2>
      </div>
      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-10 shadow-sm space-y-8">
        {children}
      </div>
    </section>
  );
});

// ─── Main Component ──────────────────────────────────────────────────────────

// Sidebar Items
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
      if (visible) {
        setActive(visible.target.id);
      }
    }, { threshold: 0.2, rootMargin: "-100px 0px -60% 0px" });

    const sections = document.querySelectorAll("section[id]");
    sections.forEach(s => observer.observe(s));
    return () => sections.forEach(s => observer.unobserve(s));
  }, []);

  return (
    <aside className="w-72 hidden md:block sticky top-32 self-start space-y-2">
      <div className="bg-white/50 border border-slate-200 rounded-[2rem] p-3 space-y-1">
        {SIDEBAR_ITEMS.map(item => {
          const isActive = active === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onScrollTo(item.id)}
              className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all text-left group ${isActive ? "bg-primary text-white shadow-xl shadow-primary/20 translate-x-1" : "hover:bg-white text-slate-500"}`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400 group-hover:text-primary"}`} />
              <span className="text-[11px] font-black uppercase tracking-widest truncate">{item.label}</span>
              {isActive && <ChevronRight className="h-3 w-3 ml-auto animate-in slide-in-from-left-1" />}
            </button>
          );
        })}
      </div>
      <div className="p-6 text-center">
         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
           Confirme as informações abaixo antes de salvar no prontuário.
         </p>
      </div>
    </aside>
  );
});

function inferFromFilename(filename: string) {
  if (!filename || filename === 'documento' || filename === 'Documento') return { nome: "", leito: "" };
  
  // Try to match "L03 - NAME" or "L03 NAME" or "L03-NAME"
  const leitoMatch = filename.match(/^[Ll]\s*([0-9]{1,3})[A-Za-z]?/i);
  const leito = leitoMatch ? `L${leitoMatch[1].padStart(2, '0')}` : "";
  
  const nameOnly = filename.replace(/\.[^/.]+$/, "");
  // Remove the bed part from name if found
  const cleanName = leitoMatch ? nameOnly.replace(leitoMatch[0], "").replace(/^[\s\-_]+/, "") : nameOnly;
  
  const parts = cleanName.split(/\s*[-_]\s*/);
  const nome = parts[0].trim().toUpperCase();
  
  return { nome, leito };
}

function RevisarExtracao() {
  const { patient_id } = Route.useSearch() as any;
  const nav = useNavigate();
  const { userId } = useSupabaseUser();
  const [data, setData] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const raw = storage.getExtracaoResultado();
    if (!raw) {
      toast.error("Nenhum dado de extração encontrado.");
      nav({ to: "/dashboard" });
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const filename = storage.getJobArquivo();
      const inferred = inferFromFilename(filename);
      
      const preparedData = {
        ...parsed,
        nome: parsed.nome || inferred.nome || "",
        idade: parsed.idade || "",
        sexo: parsed.sexo || "F",
        leito: parsed.leito || inferred.leito || "",
        setor: parsed.setor || "",
        data_admissao: parsed.data_admissao || new Date().toISOString().slice(0, 10),
        hda: parsed.hda || "",
        motivo_admissao: parsed.motivo_admissao || "",
        lista_de_problemas: (parsed.lista_de_problemas || []).map((p: string) => ({ id: Math.random().toString(36).substr(2, 9), text: p })),
        antibioticos: (parsed.antibioticos || []).map((a: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          nome: typeof a === 'string' ? a : (a.nome || ""),
          dose: a.dose || "",
          via: a.via || "",
          frequencia: a.frequencia || "",
          dataInicio: a.dataInicio || a.data_inicio || new Date().toISOString().slice(0, 10)
        })),
        medicacoes: (parsed.medicacoes || []).map((m: string) => ({ id: Math.random().toString(36).substr(2, 9), text: m })),
        laboratorios: (parsed.laboratorios || []).map((l: any) => ({ 
          id: Math.random().toString(36).substr(2, 9), 
          data: l.data || new Date().toISOString().slice(0, 10),
          valor: typeof l === 'string' ? l : (l.valor || l.texto_compacto || "") 
        })),
        exame_fisico_detalhado: parsed.exame_fisico_detalhado || {
          geral: "", acv: "", ar: "", abdome: "", neuro: "", extremidades: "", pele: ""
        },
        condutas: (parsed.condutas || []).map((c: string) => ({ id: Math.random().toString(36).substr(2, 9), text: c })),
        pendencias: (parsed.pendencias || []).map((p: any) => ({ id: Math.random().toString(36).substr(2, 9), text: typeof p === 'string' ? p : (p.text || "") })),
        alertas: parsed.alertas || []
      };
      
      setData(preparedData);
    } catch (e) {
      toast.error("Erro ao carregar dados da extração.");
      nav({ to: "/dashboard" });
    }
  }, [nav]);

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

  // Isolated List Components to prevent full page re-renders
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
          <button onClick={() => onChange(items.filter((item: any) => item.id !== p.id))} className="p-4 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...items, { id: Math.random().toString(36).substr(2, 9), text: "" }])} className="w-full py-5 border-2 border-dashed border-slate-200 rounded-[2rem] text-[11px] font-black text-slate-400 hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-3">
        <Plus className="h-4 w-4" /> ADICIONAR PROBLEMA
      </button>
    </div>
  ));

  const AntibioticList = memo(({ items, onChange }: any) => (
    <div className="space-y-8">
      {items.map((a: any, i: number) => (
        <div key={a.id} className="bg-slate-50 border border-slate-200 rounded-[2.5rem] p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2">
               <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-xs">D{differenceInDays(new Date(), parseISO(a.dataInicio)) + 1 || "?"}</span>
               <span className="text-xs font-black text-slate-900 uppercase tracking-wider">{a.nome || "Novo ATB"}</span>
            </div>
            <button onClick={() => onChange(items.filter((item: any) => item.id !== a.id))} className="text-slate-400 hover:text-red-500 transition-all">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-6">
            <EditableInput label="NOME DO ANTIBIÓTICO" value={a.nome} onChange={(v: any) => {
              const list = [...items];
              list[i] = { ...a, nome: v.toUpperCase() };
              onChange(list);
            }} />
            <div className="grid grid-cols-2 gap-4">
               <EditableInput label="DOSE" value={a.dose} onChange={(v: any) => {
                 const list = [...items];
                 list[i] = { ...a, dose: v.toUpperCase() };
                 onChange(list);
               }} />
               <EditableInput label="VIA" value={a.via} onChange={(v: any) => {
                 const list = [...items];
                 list[i] = { ...a, via: v.toUpperCase() };
                 onChange(list);
               }} />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <EditableInput label="FREQUÊNCIA" value={a.frequencia} onChange={(v: any) => {
                 const list = [...items];
                 list[i] = { ...a, frequencia: v.toUpperCase() };
                 onChange(list);
               }} />
               <EditableInput label="DATA INÍCIO" type="date" value={a.dataInicio} onChange={(v: any) => {
                 const list = [...items];
                 list[i] = { ...a, dataInicio: v };
                 onChange(list);
               }} />
            </div>
          </div>
        </div>
      ))}
      <button onClick={() => onChange([...items, { id: Math.random().toString(36).substr(2, 9), nome: "", dose: "", via: "EV", frequencia: "12/12h", dataInicio: new Date().toISOString().slice(0, 10) }])} className="w-full py-5 border-2 border-dashed border-slate-200 rounded-[2rem] text-[11px] font-black text-slate-400 hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-3">
        <Plus className="h-4 w-4" /> ADICIONAR ANTIBIÓTICO
      </button>
    </div>
  ));

  const MedicationList = memo(({ items, onChange }: any) => (
    <div className="space-y-4">
      {items.map((m: any, i: number) => (
        <div key={m.id} className="flex gap-3">
          <input value={m.text} onChange={(e) => {
            const list = [...items];
            list[i] = { ...m, text: e.target.value.toUpperCase() };
            onChange(list);
          }} className={inputCls} />
          <button onClick={() => onChange(items.filter((item: any) => item.id !== m.id))} className="p-4 text-slate-400 hover:text-red-500 rounded-2xl transition-all">
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...items, { id: Math.random().toString(36).substr(2, 9), text: "" }])} className="w-full py-5 border-2 border-dashed border-slate-200 rounded-[2rem] text-[11px] font-black text-slate-400 hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-3">
        <Plus className="h-4 w-4" /> ADICIONAR MEDICAÇÃO
      </button>
    </div>
  ));

  const LabList = memo(({ items, onChange }: any) => (
    <div className="space-y-8">
      {items.map((l: any, i: number) => (
        <div key={l.id} className="bg-white border border-slate-200 rounded-[2rem] p-8 space-y-6 shadow-sm">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <EditableInput type="date" value={l.data} onChange={(v: any) => {
              const list = [...items];
              list[i] = { ...l, data: v };
              onChange(list);
            }} />
            <button onClick={() => onChange(items.filter((item: any) => item.id !== l.id))} className="text-slate-400 hover:text-red-500 transition-all">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <EditableTextarea label="RESULTADOS EXAMES" value={l.valor} onChange={(v: any) => {
            const list = [...items];
            list[i] = { ...l, valor: v.toUpperCase() };
            onChange(list);
          }} rows={4} placeholder="Ex: Hb 12.5, Leuco 14k, PCR 45..." />
        </div>
      ))}
      <button onClick={() => onChange([...items, { id: Math.random().toString(36).substr(2, 9), data: new Date().toISOString().slice(0, 10), valor: "" }])} className="w-full py-5 border-2 border-dashed border-slate-200 rounded-[2rem] text-[11px] font-black text-slate-400 hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-3">
        <Plus className="h-4 w-4" /> ADICIONAR DATA DE EXAME
      </button>
    </div>
  ));

  const SimpleList = memo(({ items, onChange, placeholder }: any) => (
    <div className="space-y-4">
      {items.map((c: any, i: number) => (
        <div key={c.id} className="flex gap-3">
          <input value={c.text} onChange={(e) => {
            const list = [...items];
            list[i] = { ...c, text: e.target.value.toUpperCase() };
            onChange(list);
          }} className={inputCls} placeholder={placeholder} />
          <button onClick={() => onChange(items.filter((item: any) => item.id !== c.id))} className="p-4 text-slate-400 hover:text-red-500 rounded-2xl transition-all">
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...items, { id: Math.random().toString(36).substr(2, 9), text: "" }])} className="w-full py-5 border-2 border-dashed border-slate-200 rounded-[2rem] text-[11px] font-black text-slate-400 hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-3">
        <Plus className="h-4 w-4" /> ADICIONAR ITEM
      </button>
    </div>
  ));

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <RefreshCw className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const handleSave = async () => {
    if (saving || !userId) return;
    setSaving(true);
    
    try {
      const shiftId = storage.getShiftId();
      if (!shiftId || shiftId.startsWith("temp_")) {
        throw new Error("Seção expirada ou offline");
      }

      let savedPatient;
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
          nome: a.nome, dose: a.dose, via: a.via, frequencia: a.frequencia, data_inicio: a.dataInicio
        })),
        medications: data.medicacoes.map((m: any) => m.text),
        labs: data.laboratorios.map((l: any) => ({ data: l.data, texto_compacto: l.valor, valores: {} })),
        physical_exam: data.exame_fisico_detalhado,
        conducts: data.condutas.map((c: any) => c.text),
        pending_issues: data.pendencias.map((p: any) => p.text)
      };
      
      if (patient_id) {
        savedPatient = await mergePatientData(patient_id, patientPayload, userId);
      } else {
        savedPatient = await createPatient({
          ...patientPayload,
          shift_id: shiftId,
          status: 'internado',
          tipo_admissao: 'admissao'
        }, userId);
      }

      storage.clearExtracaoResultado();
      storage.clearUploadPatientId();
      toast.success("Dados salvos com sucesso!");
      nav({ to: "/paciente/$id", params: { id: savedPatient.id } });
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({ top: el.offsetTop - 120, behavior: "smooth" });
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F1F5F9]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all">
              <X className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-sm font-black tracking-tight text-slate-900 uppercase">REVISAR EXTRAÇÃO</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                 <Clock className="h-3 w-3" /> IA PROCESSOU {storage.getJobArquivo()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={handleSave} disabled={saving} className="bg-primary text-white px-8 py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all disabled:opacity-50">
               {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> SALVAR DADOS</>}
             </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-10 flex gap-12">
        <Sidebar onScrollTo={scrollTo} />

        {/* Content - Strictly Sequential */}
        <main className="flex-1 max-w-3xl space-y-16 pb-40">
          
          {patient_id && (
            <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 flex items-center gap-6 animate-in slide-in-from-top-4 duration-500">
              <div className="h-14 w-14 rounded-2xl bg-primary text-white flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                 <Plus className="h-8 w-8" />
              </div>
              <div>
                 <h3 className="text-sm font-black text-primary uppercase tracking-[0.2em] mb-1">MODO: ADICIONAR AO PACIENTE</h3>
                 <p className="text-xs text-slate-500 font-bold leading-relaxed">
                   Os dados extraídos deste documento serão mesclados ao prontuário do paciente já cadastrado. 
                   Campos vazios não sobrescreverão dados existentes.
                 </p>
              </div>
            </div>
          )}

          <Section id="identificacao" title="IDENTIFICAÇÃO" icon={<User className="h-5 w-5" />}>
            <div className="space-y-8">
              <EditableInput label="NOME COMPLETO" value={data.nome} onChange={(v: any) => updateField('nome', v)} placeholder="Nome do paciente" />
              <EditableInput label="IDADE" type="number" value={data.idade} onChange={(v: any) => updateField('idade', v)} />
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SEXO</label>
                <div className="flex bg-slate-100 rounded-2xl p-1.5 gap-1.5">
                  {["F", "M"].map(s => (
                    <button key={s} onClick={() => updateField('sexo', s)} className={`flex-1 py-4 rounded-xl text-xs font-black transition-all ${data.sexo === s ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
                      {s === "F" ? "FEMININO" : "MASCULINO"}
                    </button>
                  ))}
                </div>
              </div>

              <EditableInput label="LEITO" value={data.leito} onChange={(v: any) => updateField('leito', v)} placeholder="Ex: L12" uppercase />
              <EditableInput label="SETOR" value={data.setor} onChange={(v: any) => updateField('setor', v)} placeholder="Ex: UTI" />
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
            <ProblemList 
              items={data.lista_de_problemas} 
              onChange={(newList: any) => updateField('lista_de_problemas', newList)} 
            />
          </Section>

          <Section id="antibioticos" title="ANTIBIÓTICOS" icon={<Pill className="h-5 w-5" />}>
            <AntibioticList 
              items={data.antibioticos} 
              onChange={(newList: any) => updateField('antibioticos', newList)} 
            />
          </Section>

          <Section id="medicacoes" title="MEDICAÇÕES" icon={<Activity className="h-5 w-5" />}>
             <MedicationList 
               items={data.medicacoes} 
               onChange={(newList: any) => updateField('medicacoes', newList)} 
             />
          </Section>

          <Section id="laboratorios" title="LABORATÓRIOS" icon={<FlaskConical className="h-5 w-5" />}>
            <LabList 
              items={data.laboratorios} 
              onChange={(newList: any) => updateField('laboratorios', newList)} 
            />
          </Section>

          <Section id="exame-fisico" title="EXAME FÍSICO" icon={<Heart className="h-5 w-5" />}>
            <div className="space-y-8">
              {[
                { key: "geral", label: "GERAL" },
                { key: "acv", label: "CARDIOVASCULAR" },
                { key: "ar", label: "RESPIRATÓRIO" },
                { key: "abdome", label: "ABDOME" },
                { key: "neuro", label: "NEUROLÓGICO" },
                { key: "extremidades", label: "EXTREMIDADES" },
                { key: "pele", label: "PELE / FÂNEROS" }
              ].map((field) => (
                <EditableInput 
                  key={field.key}
                  label={field.label}
                  value={data.exame_fisico_detalhado[field.key]} 
                  onChange={(v: any) => updateField(`exame_fisico_detalhado.${field.key}`, v)} 
                />
              ))}
            </div>
          </Section>

          <Section id="condutas" title="CONDUTAS" icon={<ClipboardList className="h-5 w-5" />}>
             <SimpleList 
               items={data.condutas} 
               onChange={(newList: any) => updateField('condutas', newList)} 
               placeholder="Ex: Iniciar antibioticoterapia conforme protocolo..."
             />
          </Section>

          <Section id="pendencias" title="PENDÊNCIAS" icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}>
             <SimpleList 
               items={data.pendencias} 
               onChange={(newList: any) => updateField('pendencias', newList)} 
               placeholder="Ex: Aguardar TC de crânio..."
             />
          </Section>

          {data.alertas && data.alertas.length > 0 && (
            <Section id="alertas" title="ALERTAS DA IA" icon={<AlertCircle className="h-5 w-5 text-red-500" />}>
              <div className="space-y-4">
                {data.alertas.map((alerta: string, i: number) => (
                  <div key={i} className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4 text-amber-900">
                    <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-bold uppercase tracking-wide leading-relaxed">{alerta}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

        </main>
      </div>

      {/* Floating Save Bar for Mobile */}
      <div className="md:hidden fixed bottom-6 left-6 right-6 z-50">
        <button onClick={handleSave} disabled={saving} className="w-full bg-primary text-white py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl flex items-center justify-center gap-4">
          {saving ? <RefreshCw className="h-5 w-5 animate-spin" /> : <><Save className="h-5 w-5" /> SALVAR DADOS</>}
        </button>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputCls = "w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/50 transition-all placeholder:text-slate-300 shadow-sm";
const textareaCls = "w-full bg-white border border-slate-200 rounded-2xl px-5 py-5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/50 transition-all leading-relaxed placeholder:text-slate-300 shadow-sm";
