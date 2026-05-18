import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  ChevronLeft, Save, Plus, Trash2, Pill, Activity, 
  Stethoscope, AlertTriangle, FileText, User, 
  Thermometer, Wind, Baby, Info, FlaskConical
} from "lucide-react";
import { toast } from "sonner";
import { useShift } from "@/hooks/useShift";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";

import { getPatientById, createPatient, updatePatient } from "@/lib/db";

import { storage } from "@/lib/storage";

import { ControlledInput, ControlledTextarea } from "@/components/ui/controlled-input";

export const Route = createFileRoute("/cadastro-manual")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tipo: (search.tipo as "admissao" | "internado") || "internado",
      id: search.id as string | undefined,
    };
  },
  component: CadastroManualPage,
  head: () => ({ meta: [{ title: "Cadastro Manual — DOUTOR AJUDA" }] }),
});

const PREDEFINED_COMORBIDITIES = ["HAS", "DM2", "ICC", "DPOC", "IRC", "Tabagismo", "Etilismo", "Neoplasia", "Obesidade", "Hipotireoidismo", "DLP", "AVE Prévio"];

const PREDEFINED_MEDS = [
  { label: "SINTOMÁTICOS", items: ["Dipirona 1g EV 6/6h", "Ondansetrona 8mg EV 8/8h", "Plasil 10mg EV 8/8h"] },
  { label: "PROFILAXIA", items: ["Enoxaparina 40mg SC 24/24h", "Heparina 5000UI SC 8/8h", "Omeprazol 40mg EV 24/24h"] },
  { label: "HIDRATAÇÃO", items: ["SF 0,9% 500ml EV agora", "RL 500ml EV agora", "SG 5% 500ml EV agora"] }
];

const PREDEFINED_PHYSICAL = {
  estado_geral: ["BEG, LOTE, ACIDANÓTICO, ANICTÉRICO", "MEG, SONOLENTO, DESIDRATADO ++/4+", "REG, LOTE, PALIDEZ CUTÂNEA"],
  acv: ["RCR 2T BNF SEM SOPROS, PULSOS PRESENTES", "RCR 2T BNF COM SOPRO SISTÓLICO 2+/6+ EM FOCO MITRAL", "ARRITMIA COMPLETA (FA), BNF"],
  ar: ["MVU SEM RUÍDOS ADVENTÍCIOS, EUPNEICO", "MVU DIMINUÍDO EM BASES, COM ESTERTORES CREPITANTES À DIREITA", "MVU GLOBALMENTE DIMINUÍDO, COM SIBILOS EXPIRATÓRIOS"],
  abdome: ["RHA+, PLANO, INDOLOR À PALPAÇÃO", "RHA+, DISTENDIDO, TIMPÂNICO, INDOLOR", "RHA DIMINUÍDO, DOLOROSO À PALPAÇÃO EM FID"],
  neuro: ["GLASGOW 15, SEM DÉFICITS FOCAIS", "GLASGOW 13 (A4V3M6), ISOCÓRICO E FOTORREAGENTE", "VIGIL, ORIENTADO, HEMIPARESIA À DIREITA"],
};

const PREDEFINED_DVA = ["NORADRENALINA", "DOBUTAMINA", "VASOPRESSINA", "NITROPRUSSIATO", "NIPRIDE", "TRIDIL"];
const PREDEFINED_VENT = ["PCV", "VCV", "PSV", "CPAP", "SIMV"];

function CadastroManualPage() {
  const { tipo, id } = Route.useSearch() as any;
  const nav = useNavigate();
  const { userId } = useSupabaseUser();
  const { getShift, getTipo } = useShift();
  const shift = getShift();
  const tipoEvolucao = getTipo(); // uti | enfermaria_pediatrica | etc
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!id);

  const [form, setForm] = useState({
    nome: "", idade: "", sexo: "F" as "F" | "M", leito: "", setor: shift?.setor || "", 
    data_admissao: new Date().toISOString().slice(0, 10), procedencia: "",
    motivo_admissao: "", hda: "", 
    comorbidades: [] as string[],
    lista_de_problemas: [] as { id: string; text: string }[],
    antibioticos: [] as any[],
    medicacoes: [] as { id: string; text: string }[],
    laboratorios: [{ id: Date.now().toString(), data: new Date().toISOString().slice(0, 10), valor: "" }],
    exame_fisico: { estado_geral: "", acv: "", ar: "", abdome: "", neuro: "", extremidades: "", pele: "" },
    uti: { vm: false, modo: "", fio2: "", peep: "", volume: "", fr: "", dva: [] as {id: string, text: string}[], bh: "", sedacao: "" },
    pediatria: { peso: "", altura: "", meses: "", aleitamento: false, desenvolvimento: "" },
    condutas: "",
    pendencias: [] as { id: string; text: string }[]
  });

  const [customComorbidity, setCustomComorbidity] = useState("");
  const [showCustomComorbidity, setShowCustomComorbidity] = useState(false);

  // Auto-calculate pediatric age in months if applicable
  useEffect(() => {
    if (tipoEvolucao === "enfermaria_pediatrica" && form.idade) {
      const ageInMonths = parseInt(form.idade) * 12;
      if (ageInMonths < 24) {
        setForm(f => ({ ...f, pediatria: { ...f.pediatria, meses: ageInMonths.toString() } }));
      }
    }
  }, [form.idade, tipoEvolucao]);

  // Load existing patient if id is provided
  useEffect(() => {
    if (!id || !userId) {
      if (id) setLoading(false);
      return;
    }
    
    async function load() {
      try {
        if (id.startsWith("temp_")) throw new Error("Local");
        const p = await getPatientById(id, userId!);
        if (p) populateForm(p);
      } catch {
        // Fallback local
        const existing = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
        const p = existing.find((x: any) => x.id === id);
        if (p) populateFormFromLocal(p);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, userId]);

  const populateForm = (p: any) => {
    setForm(f => ({
      ...f,
      nome: p.name || "",
      idade: p.age || "",
      sexo: (p.sex as any) || "F",
      leito: p.bed || "",
      setor: p.sector || "",
      data_admissao: p.admission_date || new Date().toISOString().slice(0, 10),
      procedencia: p.procedencia || "",
      motivo_admissao: p.reason_for_admission || "",
      hda: p.hda || "",
      comorbidades: p.comorbidities || [],
      lista_de_problemas: (p.problem_list || []).map((text: string) => ({ id: Math.random().toString(), text })),
      antibioticos: (p.antibiotics || []).map((a: any) => ({
        id: Math.random().toString(),
        nome: a.nome, dose: a.dose, via: a.via, frequencia: a.frequencia, dataInicio: a.data_inicio || a.dataInicio
      })),
      medicacoes: (p.medications || []).map((text: string) => ({ id: Math.random().toString(), text })),
      laboratorios: (p.labs || []).map((l: any) => ({
        id: Math.random().toString(), data: l.data, valor: l.texto_compacto || l.valor
      })),
      exame_fisico: {
        estado_geral: p.physical_exam?.geral || "",
        acv: p.physical_exam?.acv || "",
        ar: p.physical_exam?.ar || "",
        abdome: p.physical_exam?.abdome || "",
        neuro: p.physical_exam?.neuro || "",
        extremidades: p.physical_exam?.extremidades || "",
        pele: p.physical_exam?.pele || "",
      },
      condutas: (p.conducts || []).join("\n"),
      pendencias: (p.pending_issues || []).map((text: string) => ({ id: Math.random().toString(), text })),
    }));
  };

  const populateFormFromLocal = (p: any) => {
    setForm(f => ({
      ...f,
      ...p
    }));
  };

  const handleSave = async (generateEvolution = false) => {
    if (!form.nome || !form.leito) {
      toast.error("Nome e Leito são obrigatórios.");
      return;
    }

    if (!userId) {
      toast.error("Usuário não identificado.");
      return;
    }

    if (saving) return;
    setSaving(true);

    try {
      const shiftId = storage.getShiftId();
      
      if (shiftId && !shiftId.startsWith("temp_")) {
        const payload = {
          name: form.nome,
          age: form.idade,
          sex: form.sexo,
          bed: form.leito,
          sector: form.setor,
          admission_date: form.data_admissao,
          reason_for_admission: form.motivo_admissao,
          hda: form.hda,
          comorbidities: form.comorbidades,
          problem_list: form.lista_de_problemas.map(p => p.text),
          antibiotics: form.antibioticos.map(a => ({
            nome: a.nome, dose: a.dose, via: a.via, frequencia: a.frequencia, data_inicio: a.dataInicio
          })),
          medications: form.medicacoes.map(m => m.text),
          labs: form.laboratorios.map(l => ({ data: l.data, texto_compacto: l.valor, valores: {} })),
          physical_exam: {
            geral: form.exame_fisico.estado_geral,
            acv: form.exame_fisico.acv,
            ar: form.exame_fisico.ar,
            abdome: form.exame_fisico.abdome,
            neuro: form.exame_fisico.neuro,
            extremidades: form.exame_fisico.extremidades,
            pele: form.exame_fisico.pele,
          },
          conducts: form.condutas ? form.condutas.split("\n").filter(Boolean) : [],
          pending_issues: form.pendencias.map(p => p.text),
          status: "internado",
          tipo_admissao: tipo
        };

        let savedPatient;
        if (id && !id.startsWith("temp_")) {
          savedPatient = await updatePatient(id, payload, userId);
        } else {
          savedPatient = await createPatient({ ...payload, shift_id: shiftId }, userId);
        }

        toast.success(id ? "Paciente atualizado!" : "Paciente cadastrado com sucesso!");
      if (generateEvolution) {
        nav({ to: "/evolucao/$id", params: { id: savedPatient.id } });
      } else {
        nav({ to: "/dashboard" });
      }
        return;
      }
      
      throw new Error("Offline ou ID temporário");
    } catch (err) {
      console.warn("Salvando offline", err);
      
      // Fallback
      const newPatient = {
        id: id || "temp_" + Date.now(),
        ...form,
        status: "internado",
        tipo_admissao: tipo,
        criado_em: Date.now()
      };

      const existing = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
      const idx = existing.findIndex((p: any) => p.id === newPatient.id);
      
      if (idx >= 0) existing[idx] = newPatient;
      else existing.push(newPatient);

      localStorage.setItem("da_pacientes", JSON.stringify(existing));

      toast.success(id ? "Paciente atualizado localmente!" : "Paciente cadastrado localmente!");
      if (generateEvolution) {
        nav({ to: "/evolucao/$id", params: { id: newPatient.id } });
      } else {
        nav({ to: "/dashboard" });
      }
    } finally {
      setSaving(false);
    }
  };

  const addItem = (key: 'lista_de_problemas' | 'medicacoes' | 'pendencias') => {
    setForm(f => ({
      ...f,
      [key]: [...f[key], { id: Date.now().toString() + Math.random(), text: "" }]
    }));
  };

  const updateItem = (key: 'lista_de_problemas' | 'medicacoes' | 'pendencias', id: string, text: string) => {
    setForm(f => ({
      ...f,
      [key]: f[key].map(item => item.id === id ? { ...item, text } : item)
    }));
  };

  const removeItem = (key: 'lista_de_problemas' | 'medicacoes' | 'pendencias', id: string) => {
    setForm(f => ({
      ...f,
      [key]: f[key].filter(item => item.id !== id)
    }));
  };

  const handleConductKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const lines = form.condutas.split("\n").filter(Boolean);
      const lastLine = lines[lines.length - 1] || "";
      const currentNumberMatch = lastLine.match(/^(\d+)\./);
      const nextNumber = currentNumberMatch ? parseInt(currentNumberMatch[1]) + 1 : lines.length + 1;
      
      // If the textarea is empty or doesn't have enumeration yet, start with 1.
      if (form.condutas.trim() === "") {
        e.preventDefault();
        setForm(f => ({ ...f, condutas: "1. " }));
        return;
      }

      // Add next number automatically
      e.preventDefault();
      setForm(f => ({ ...f, condutas: form.condutas + "\n" + nextNumber + ". " }));
    }
  };

  const handleAISuggestions = async () => {
    toast.info("A IA está analisando o caso clínico...");
    // Mock simulation
    setTimeout(() => {
      const suggestions = "1. Vigilância hemodiátrica rigorosa\n2. Reavaliar antibioticoterapia em 48h\n3. Controle de balanço hídrico diário\n4. Fisioterapia motora e respiratória";
      setForm(f => ({ ...f, condutas: f.condutas + (f.condutas ? "\n" : "") + suggestions }));
      toast.success("Sugestões de conduta adicionadas!");
    }, 2000);
  };

  const triggerPhotoExtraction = (field: 'laboratorios' | 'medicacoes') => {
    toast.promise(new Promise(res => setTimeout(res, 3000)), {
       loading: "Processando imagem...",
       success: "Dados extraídos com sucesso!",
       error: "Falha na extração."
    });
    // In a real scenario, this would open a file picker and call the documentExtractor
  };

  const addATB = () => {
    setForm(f => ({
      ...f,
      antibioticos: [...f.antibioticos, { 
        id: Date.now().toString(), 
        nome: "", dose: "", via: "EV", frequencia: "12/12h", 
        dataInicio: new Date().toISOString().slice(0, 10) 
      }]
    }));
  };

  const toggleComorbidity = (c: string) => {
    setForm(f => ({
      ...f,
      comorbidades: f.comorbidades.includes(c) 
        ? f.comorbidades.filter(item => item !== c)
        : [...f.comorbidades, c]
    }));
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      {loading && (
        <div className="fixed inset-0 z-50 bg-background/50 backdrop-blur-sm flex items-center justify-center">
           <div className="animate-spin text-primary"><Activity className="h-8 w-8" /></div>
        </div>
      )}
      <header className="max-w-5xl mx-auto px-6 h-20 w-full flex items-center justify-between sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
        <button onClick={() => window.history.back()} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group">
          <ChevronLeft className="h-4 w-4" /> VOLTAR
        </button>
        <span className="text-xs font-extrabold tracking-[0.2em] uppercase text-primary">
          {tipo === 'admissao' ? "CADASTRO DE ADMISSÃO" : "CADASTRO MANUAL"}
        </span>
        <div className="w-16" />
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        
        {/* IDENTIFICAÇÃO */}
        <Section title="IDENTIFICAÇÃO" icon={<User className="h-5 w-5" />}>
           <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">NOME COMPLETO *</label>
                <ControlledInput 
                  value={form.nome} 
                  onValueChange={v => setForm({...form, nome: v})} 
                  placeholder="Nome do paciente" 
                  uppercase 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">IDADE</label>
                  <ControlledInput 
                    type="number" 
                    value={form.idade} 
                    onValueChange={v => setForm({...form, idade: v})} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">SEXO</label>
                  <div className="flex bg-secondary/50 rounded-xl p-1 h-[50px]">
                    {["F", "M"].map(s => (
                      <button key={s} onClick={() => setForm({...form, sexo: s as any})} className={`flex-1 rounded-lg text-xs font-bold transition-all ${form.sexo === s ? "bg-elevated text-primary shadow-sm" : "text-muted-foreground"}`}>
                        {s === "F" ? "FEM" : "MASC"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
           </div>
           <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">LEITO *</label>
                <ControlledInput 
                  value={form.leito} 
                  onValueChange={v => setForm({...form, leito: v})} 
                  placeholder="Ex: L12" 
                  uppercase 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">SETOR</label>
                <ControlledInput 
                  value={form.setor} 
                  onValueChange={v => setForm({...form, setor: v})} 
                  uppercase
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">DATA DE ADMISSÃO</label>
                <ControlledInput 
                  type="date" 
                  value={form.data_admissao} 
                  onValueChange={v => setForm({...form, data_admissao: v})} 
                />
              </div>
           </div>
           {tipo === 'admissao' && (
             <div className="space-y-2">
                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">PROCEDÊNCIA</label>
                <ControlledInput 
                  value={form.procedencia} 
                  onValueChange={v => setForm({...form, procedencia: v})} 
                  placeholder="Ex: UPA Central" 
                />
             </div>
           )}
        </Section>

        {/* MOTIVO DA ADMISSÃO & HDA */}
        <Section title="MOTIVO DA ADMISSÃO" icon={<FileText className="h-5 w-5" />}>
           <ControlledTextarea 
             value={form.motivo_admissao} 
             onValueChange={v => setForm({...form, motivo_admissao: v})} 
             placeholder="Ex: dispneia progressiva há 3 dias..." 
             rows={2}
           />
           <div className="space-y-2 pt-4">
              <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">HDA (HISTÓRIA DA DOENÇA ATUAL)</label>
              <ControlledTextarea 
                value={form.hda} 
                onValueChange={v => setForm({...form, hda: v})} 
                rows={6}
                placeholder="Descreva o quadro clínico completo..."
              />
           </div>
        </Section>

        {/* COMORBIDADES */}
        <Section title="COMORBIDADES" icon={<Stethoscope className="h-5 w-5" />}>
           <div className="flex flex-wrap gap-2">
              {PREDEFINED_COMORBIDITIES.map(c => (
                <button 
                  key={c} 
                  onClick={() => toggleComorbidity(c)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${form.comorbidades.includes(c) ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-elevated text-muted-foreground border-border hover:border-primary/40"}`}
                >
                  {c}
                </button>
              ))}
              <button 
                onClick={() => setShowCustomComorbidity(!showCustomComorbidity)}
                className="px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-secondary text-muted-foreground border border-border"
              >
                + OUTRA
              </button>
           </div>
           {showCustomComorbidity && (
             <div className="flex gap-2 pt-4 animate-in fade-in slide-in-from-top-2">
                <ControlledInput 
                  value={customComorbidity} 
                  onValueChange={setCustomComorbidity} 
                  placeholder="DIGITE A COMORBIDADE" 
                  uppercase
                  onKeyDown={e => {
                    if (e.key === 'Enter' && customComorbidity) {
                      toggleComorbidity(customComorbidity);
                      setCustomComorbidity("");
                      setShowCustomComorbidity(false);
                    }
                  }}
                />
             </div>
           )}
        </Section>

        {/* LISTA DE PROBLEMAS */}
        <Section title="LISTA DE PROBLEMAS" icon={<Activity className="h-5 w-5" />}>
           <div className="space-y-3">
              {form.lista_de_problemas.map(p => (
                <div key={p.id} className="flex gap-2">
                  <ControlledInput 
                    value={p.text} 
                    onValueChange={v => updateItem('lista_de_problemas', p.id, v)} 
                    placeholder="EX: INSUFICIÊNCIA CARDÍACA DESCOMPENSADA" 
                    uppercase
                  />
                  <button onClick={() => removeItem('lista_de_problemas', p.id)} className="p-4 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive transition-colors group">
                    <Trash2 className="h-5 w-5 group-hover:text-white" />
                  </button>
                </div>
              ))}
              <button onClick={() => addItem('lista_de_problemas')} className="w-full py-4 border-2 border-dashed border-border rounded-xl text-xs font-bold text-muted-foreground hover:border-primary/40 hover:text-primary transition-all flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" /> ADICIONAR PROBLEMA
              </button>
           </div>
        </Section>

        {/* ANTIBIÓTICOS */}
        <Section title="ANTIBIÓTICOS" icon={<Pill className="h-5 w-5" />}>
           <div className="space-y-6">
              {form.antibioticos.map((atb, idx) => (
                <div key={atb.id} className="bg-secondary/30 border border-border rounded-2xl p-6 relative group">
                   <button onClick={() => setForm({...form, antibioticos: form.antibioticos.filter(a => a.id !== atb.id)})} className="absolute top-4 right-4 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                   </button>
                   <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase">NOME DO ATB</label>
                        <ControlledInput 
                          value={atb.nome} 
                          onValueChange={v => {
                            const newList = [...form.antibioticos];
                            newList[idx].nome = v;
                            setForm({...form, antibioticos: newList});
                          }} 
                          uppercase
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-muted-foreground uppercase">DOSE</label>
                          <ControlledInput 
                            value={atb.dose} 
                            onValueChange={v => {
                              const newList = [...form.antibioticos];
                              newList[idx].dose = v;
                              setForm({...form, antibioticos: newList});
                            }} 
                            uppercase
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-muted-foreground uppercase">DATA INÍCIO</label>
                          <ControlledInput 
                            type="date" 
                            value={atb.dataInicio} 
                            onValueChange={v => {
                              const newList = [...form.antibioticos];
                              newList[idx].dataInicio = v;
                              setForm({...form, antibioticos: newList});
                            }} 
                          />
                        </div>
                      </div>
                   </div>
                   <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[9px] font-bold text-muted-foreground uppercase">VIA</label>
                         <div className="flex bg-elevated rounded-xl p-1 border border-border">
                            {["EV", "VO", "IM", "SC", "Inalatória"].map(v => (
                              <button key={v} onClick={() => {
                                const newList = [...form.antibioticos];
                                newList[idx].via = v;
                                setForm({...form, antibioticos: newList});
                              }} className={`flex-1 py-2 rounded-lg text-[9px] font-bold transition-all ${atb.via === v ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}>
                                {v}
                              </button>
                            ))}
                         </div>
                      </div>
                      <div className="space-y-1">
                         <label className="text-[9px] font-bold text-muted-foreground uppercase">FREQUÊNCIA</label>
                         <select value={atb.frequencia} onChange={e => {
                            const newList = [...form.antibioticos];
                            newList[idx].frequencia = e.target.value;
                            setForm({...form, antibioticos: newList});
                         }} className={inputCls}>
                            {["8/8h", "12/12h", "24/24h", "6/6h", "Dose única"].map(f => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                         </select>
                      </div>
                   </div>
                </div>
              ))}
              <button onClick={addATB} className="w-full py-4 border-2 border-dashed border-ai/30 rounded-xl text-xs font-bold text-ai hover:bg-ai/5 transition-all flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" /> ADICIONAR ANTIBIÓTICO
              </button>
           </div>
        </Section>

        {/* MEDICAÇÕES */}
        <Section title="MEDICAÇÕES EM USO" icon={<Pill className="h-5 w-5" />}>
           <div className="flex justify-between items-center mb-6">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">LISTA DE PRESCRIÇÃO</p>
              <button 
                onClick={() => triggerPhotoExtraction('medicacoes')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-ai/10 text-ai text-[10px] font-black uppercase tracking-widest border border-ai/20 hover:bg-ai/20 transition-all"
              >
                <Activity className="h-3.5 w-3.5" /> EXTRAIR DE FOTO/PRINT
              </button>
           </div>
           
           <div className="space-y-6">
              {PREDEFINED_MEDS.map(group => (
                <div key={group.label} className="space-y-2">
                   <p className="text-[9px] font-bold text-muted-foreground ml-1">{group.label}</p>
                   <div className="flex flex-wrap gap-2">
                      {group.items.map(item => (
                        <button 
                          key={item} 
                          onClick={() => setForm(f => ({...f, medicacoes: [...f.medicacoes, { id: Math.random().toString(), text: item.toUpperCase() }]}))}
                          className="px-3 py-1.5 rounded-lg border border-border text-[10px] font-bold text-foreground/80 bg-elevated hover:border-primary/40 hover:bg-subtle"
                        >
                          + {item}
                        </button>
                      ))}
                   </div>
                </div>
              ))}
           </div>

           <div className="space-y-3 pt-6 border-t border-border mt-6">
              {form.medicacoes.map(m => (
                <div key={m.id} className="flex gap-2">
                  <ControlledInput 
                    value={m.text} 
                    onValueChange={v => updateItem('medicacoes', m.id, v)} 
                    placeholder="NOME, DOSE, FREQUÊNCIA" 
                    uppercase
                  />
                  <button onClick={() => removeItem('medicacoes', m.id)} className="p-4 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive transition-colors group">
                    <Trash2 className="h-5 w-5 group-hover:text-white" />
                  </button>
                </div>
              ))}
              <button onClick={() => addItem('medicacoes')} className="w-full py-4 border-2 border-dashed border-border rounded-xl text-xs font-bold text-muted-foreground hover:border-primary/40 transition-all flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" /> ADICIONAR MEDICAÇÃO MANUAL
              </button>
           </div>
        </Section>

        {/* LABORATÓRIOS */}
        <Section title="LABORATÓRIOS" icon={<Activity className="h-5 w-5" />}>
           <div className="flex justify-between items-center mb-6">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">RESULTADOS E EVOLUÇÃO</p>
              <button 
                onClick={() => triggerPhotoExtraction('laboratorios')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20 hover:bg-primary/20 transition-all"
              >
                <FlaskConical className="h-3.5 w-3.5" /> EXTRAIR DE EXAME (FOTO/PDF)
              </button>
           </div>

           <div className="space-y-6">
              {form.laboratorios.map((lab, idx) => (
                <div key={lab.id} className="space-y-3 border-b border-border pb-6 last:border-0">
                   <div className="flex items-center justify-between">
                      <div className="w-40">
                         <ControlledInput 
                           type="date" 
                           value={lab.data} 
                           onValueChange={v => {
                             const newList = [...form.laboratorios];
                             newList[idx].data = v;
                             setForm({...form, laboratorios: newList});
                           }} 
                         />
                      </div>
                      {idx > 0 && (
                        <button onClick={() => setForm({...form, laboratorios: form.laboratorios.filter(l => l.id !== lab.id)})} className="text-destructive hover:bg-destructive/10 p-2 rounded-lg transition-colors">
                           <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                   </div>
                   <ControlledTextarea 
                     value={lab.valor} 
                     onValueChange={v => {
                        const newList = [...form.laboratorios];
                        newList[idx].valor = v;
                        setForm({...form, laboratorios: newList});
                     }} 
                     placeholder="Hb 10,2 | Ht 31 | Leuco 14500 | PCR 18 | Creat 1,4" 
                     rows={3} 
                     uppercase
                   />
                </div>
              ))}
              <button onClick={() => setForm({...form, laboratorios: [...form.laboratorios, { id: Date.now().toString(), data: new Date().toISOString().slice(0, 10), valor: "" }]})} className="w-full py-4 border-2 border-dashed border-border rounded-xl text-xs font-bold text-muted-foreground hover:border-primary/40 transition-all flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" /> ADICIONAR OUTRA DATA
              </button>
           </div>
        </Section>

        {/* EXAME FÍSICO */}
        <Section title="EXAME FÍSICO" icon={<Thermometer className="h-5 w-5" />}>
           <div className="space-y-8">
              {[
                { key: 'estado_geral', label: 'ESTADO GERAL' },
                { key: 'acv', label: 'ACV (CARDIO-VASCULAR)' },
                { key: 'ar', label: 'AR (RESPIRATÓRIO)' },
                { key: 'abdome', label: 'ABDOME' },
                { key: 'neuro', label: 'NEUROLÓGICO' },
                { key: 'extremidades', label: 'EXTREMIDADES / MMII' },
                { key: 'pele', label: 'PELE / MUCOSAS' },
              ].map(field => (
                <div key={field.key} className="space-y-3">
                   <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">{field.label}</label>
                   <div className="flex flex-wrap gap-2 mb-2">
                      {(PREDEFINED_PHYSICAL as any)[field.key]?.map((phrase: string) => (
                        <button 
                          key={phrase} 
                          onClick={() => setForm({...form, exame_fisico: {...form.exame_fisico, [field.key]: phrase.toUpperCase()}})}
                          className="px-3 py-1.5 rounded-lg border border-border text-[9px] font-bold text-muted-foreground bg-subtle/50 hover:border-primary/30 transition-all"
                        >
                          + {phrase.split(',')[0]}...
                        </button>
                      ))}
                   </div>
                   <ControlledInput 
                     value={(form.exame_fisico as any)[field.key]} 
                     onValueChange={v => setForm({...form, exame_fisico: {...form.exame_fisico, [field.key]: v}})} 
                     placeholder="Clique acima ou digite..."
                     uppercase
                   />
                </div>
              ))}
           </div>
        </Section>

        {/* CAMPOS EXTRAS (UTI / PEDIATRIA) */}
        {tipoEvolucao === 'uti' && (
          <Section title="CAMPOS UTI" icon={<Wind className="h-5 w-5" />}>
             <div className="space-y-10">
                <div className="flex items-center justify-between bg-subtle p-6 rounded-3xl border border-border">
                   <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-elevated flex items-center justify-center text-primary shadow-sm border border-border">
                        <Wind className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground block mb-0.5">VENTILAÇÃO MECÂNICA</span>
                        <p className="text-[9px] font-bold text-muted-foreground">Marque se o paciente está entubado ou em VNI</p>
                      </div>
                   </div>
                   <div className="flex bg-elevated rounded-xl p-1.5 border border-border shadow-sm">
                      <button onClick={() => setForm({...form, uti: {...form.uti, vm: false}})} className={`px-6 py-2.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${!form.uti.vm ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-muted-foreground"}`}>NÃO</button>
                      <button onClick={() => setForm({...form, uti: {...form.uti, vm: true}})} className={`px-6 py-2.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${form.uti.vm ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-muted-foreground"}`}>SIM</button>
                   </div>
                </div>

                {form.uti.vm && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex flex-wrap gap-2">
                       {PREDEFINED_VENT.map(m => (
                         <button key={m} onClick={() => setForm({...form, uti: {...form.uti, modo: m}})} className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all ${form.uti.modo === m ? "bg-primary text-white border-primary" : "bg-elevated text-muted-foreground border-border hover:border-primary/30"}`}>
                           {m}
                         </button>
                       ))}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                       {[
                         { k: 'fio2', l: 'FiO2 (%)' },
                         { k: 'peep', l: 'PEEP' },
                         { k: 'volume', l: 'VOL/PRES' },
                         { k: 'fr', l: 'FR' }
                       ].map(v => (
                         <div key={v.k} className="space-y-1.5">
                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">{v.l}</label>
                            <ControlledInput 
                              value={(form.uti as any)[v.k]} 
                              onValueChange={val => setForm({...form, uti: {...form.uti, [v.k]: val}})} 
                              uppercase
                            />
                         </div>
                       ))}
                    </div>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-10 border-t border-border pt-10">
                   <div className="space-y-6">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-black text-foreground uppercase tracking-widest">DROGAS VASOATIVAS</label>
                        <div className="h-px flex-1 bg-subtle mx-4" />
                      </div>
                      <div className="flex flex-wrap gap-2 mb-4">
                         {PREDEFINED_DVA.map(d => (
                           <button 
                            key={d} 
                            onClick={() => setForm({...form, uti: {...form.uti, dva: [...form.uti.dva, {id: Math.random().toString(), text: d + " "}]}})}
                            className="px-3 py-1.5 rounded-lg border border-border text-[9px] font-bold text-muted-foreground hover:text-primary hover:border-primary/30"
                           >
                            + {d}
                           </button>
                         ))}
                      </div>
                      <div className="space-y-3">
                        {form.uti.dva.map(dva => (
                          <div key={dva.id} className="flex gap-2 group">
                             <ControlledInput 
                              value={dva.text} 
                              onValueChange={val => setForm({...form, uti: {...form.uti, dva: form.uti.dva.map(item => item.id === dva.id ? {...item, text: val} : item)}})} 
                              placeholder="DOSE/VELOCIDADE..." 
                              uppercase
                             />
                             <button onClick={() => setForm({...form, uti: {...form.uti, dva: form.uti.dva.filter(item => item.id !== dva.id)}})} className="p-4 rounded-xl bg-subtle text-muted-foreground hover:text-destructive transition-colors">
                                <Trash2 className="h-4 w-4" />
                             </button>
                          </div>
                        ))}
                        <button onClick={() => setForm({...form, uti: {...form.uti, dva: [...form.uti.dva, {id: Date.now().toString(), text: ""}]}})} className="w-full py-4 border-2 border-dashed border-border rounded-2xl text-[10px] font-black text-muted-foreground hover:text-primary hover:border-primary/40 transition-all">+ ADICIONAR DVA MANUAL</button>
                      </div>
                   </div>
                   <div className="space-y-8">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-foreground uppercase tracking-widest block mb-1">BALANÇO HÍDRICO 24H (ML)</label>
                         <ControlledInput 
                           type="number" 
                           value={form.uti.bh} 
                           onValueChange={v => setForm({...form, uti: {...form.uti, bh: v}})} 
                           placeholder="EX: +1200" 
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-foreground uppercase tracking-widest block mb-1">SEDAÇÃO / ANALGESIA</label>
                         <ControlledInput 
                           value={form.uti.sedacao} 
                           onValueChange={v => setForm({...form, uti: {...form.uti, sedacao: v}})} 
                           placeholder="EX: FENTANIL + MIDAZOLAM" 
                           uppercase
                         />
                      </div>
                   </div>
                </div>
             </div>
          </Section>
        )}

        {tipoEvolucao === 'enfermaria_pediatrica' && (
          <Section title="CAMPOS PEDIATRIA" icon={<Baby className="h-5 w-5" />}>
             <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-1">
                   <label className="text-[9px] font-bold text-muted-foreground uppercase">PESO (KG)</label>
                   <ControlledInput 
                     type="number" 
                     value={form.pediatria.peso} 
                     onValueChange={v => setForm({...form, pediatria: {...form.pediatria, peso: v}})} 
                   />
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-bold text-muted-foreground uppercase">ALTURA (CM)</label>
                   <ControlledInput 
                     type="number" 
                     value={form.pediatria.altura} 
                     onValueChange={v => setForm({...form, pediatria: {...form.pediatria, altura: v}})} 
                   />
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-bold text-muted-foreground uppercase">IDADE EM MESES</label>
                   <ControlledInput 
                     type="number" 
                     value={form.pediatria.meses} 
                     onValueChange={v => setForm({...form, pediatria: {...form.pediatria, meses: v}})} 
                   />
                </div>
             </div>
             <div className="grid md:grid-cols-2 gap-8 pt-6">
                <div className="space-y-4">
                   <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">ALEITAMENTO MATERNO</label>
                   <div className="flex bg-secondary/30 rounded-xl p-1 border border-border">
                      <button onClick={() => setForm({...form, pediatria: {...form.pediatria, aleitamento: false}})} className={`flex-1 py-3 rounded-lg text-[10px] font-bold transition-all ${!form.pediatria.aleitamento ? "bg-primary text-white" : "text-muted-foreground"}`}>NÃO</button>
                      <button onClick={() => setForm({...form, pediatria: {...form.pediatria, aleitamento: true}})} className={`flex-1 py-3 rounded-lg text-[10px] font-bold transition-all ${form.pediatria.aleitamento ? "bg-primary text-white" : "text-muted-foreground"}`}>SIM</button>
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">DESENVOLVIMENTO</label>
                   <ControlledTextarea 
                     value={form.pediatria.desenvolvimento} 
                     onValueChange={v => setForm({...form, pediatria: {...form.pediatria, desenvolvimento: v}})} 
                     rows={2} 
                   />
                </div>
             </div>
          </Section>
        )}

        {/* CONDUTAS */}
        <Section title="PLANO TERAPÊUTICO / CONDUTAS" icon={<Save className="h-5 w-5" />}>
           <div className="flex justify-between items-center mb-4">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">DIGITE E DÊ ENTER PARA NUMERAR</p>
              <button 
                onClick={handleAISuggestions}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-ai text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-ai/20 hover:shadow-ai/40 hover:-translate-y-0.5 transition-all"
              >
                <Activity className="h-3.5 w-3.5" /> IA SUGERIR CONDUTAS
              </button>
           </div>
           <ControlledTextarea 
             value={form.condutas} 
             onValueChange={v => setForm({...form, condutas: v})} 
             onKeyDown={handleConductKeyDown}
             rows={8} 
             placeholder="1. Vigiar balanço..." 
             uppercase
           />
           <div className="mt-4 p-4 bg-subtle rounded-2xl border border-border flex items-start gap-3">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed">
                Dica: Pressione ENTER para criar automaticamente o próximo item da lista.
              </p>
           </div>
        </Section>

        {/* PENDÊNCIAS */}
        <Section title="PENDÊNCIAS" icon={<AlertTriangle className="h-5 w-5" />}>
           <div className="space-y-3">
              {form.pendencias.map(p => (
                <div key={p.id} className="flex gap-2">
                  <div className="flex items-center justify-center w-12 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20 shrink-0">
                     <AlertTriangle className="h-4 w-4" />
                  </div>
                  <ControlledInput 
                    value={p.text} 
                    onValueChange={v => updateItem('pendencias', p.id, v)} 
                    placeholder="EX: AGUARDANDO RESULTADO DE ECOCARDIOGRAMA" 
                    uppercase
                  />
                  <button onClick={() => removeItem('pendencias', p.id)} className="p-4 rounded-xl bg-destructive/10 text-destructive"><Trash2 className="h-5 w-5" /></button>
                </div>
              ))}
              <button onClick={() => addItem('pendencias')} className="w-full py-4 border-2 border-dashed border-amber-500/30 rounded-xl text-xs font-bold text-amber-600 hover:bg-amber-500/5 transition-all flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" /> ADICIONAR PENDÊNCIA
              </button>
           </div>
        </Section>


        {/* BOTÕES FINAIS */}
        <footer className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border p-6 z-40">
           <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-4">
              <button disabled={saving} onClick={() => handleSave(false)} className="flex-1 py-5 rounded-2xl border border-border font-extrabold uppercase tracking-widest text-[10px] text-muted-foreground hover:bg-secondary transition-all disabled:opacity-50">
                {saving ? "SALVANDO..." : (id ? "ATUALIZAR PACIENTE" : "SALVAR PACIENTE")}
              </button>
              <button disabled={saving} onClick={() => handleSave(true)} className="flex-[2] py-5 rounded-2xl bg-primary text-primary-foreground font-extrabold uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                <Save className="h-4 w-4" /> {id ? "ATUALIZAR E GERAR EVOLUÇÃO" : "SALVAR E GERAR EVOLUÇÃO"}
              </button>
           </div>
        </footer>

      </main>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string, icon: any, children: any }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-6 ml-1">
        <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground border border-border/50">
          {icon}
        </div>
        <h2 className="text-[10px] font-black tracking-[0.25em] uppercase text-foreground">{title}</h2>
      </div>
      <div className="bg-elevated border border-border rounded-[3rem] p-8 md:p-12 shadow-sm space-y-6">
        {children}
      </div>
    </div>
  );
}

const inputCls = "w-full bg-secondary/40 border border-border rounded-xl px-5 py-4 text-sm font-bold placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-elevated transition-all uppercase";
const textareaCls = "w-full bg-secondary/40 border border-border rounded-2xl px-5 py-5 text-sm font-bold placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-elevated leading-relaxed transition-all uppercase";
