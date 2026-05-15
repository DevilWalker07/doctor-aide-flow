import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  ChevronLeft, Save, Plus, Trash2, Pill, Activity, 
  Stethoscope, AlertTriangle, FileText, User, 
  Thermometer, Wind, Baby, Info
} from "lucide-react";
import { toast } from "sonner";
import { useShift } from "@/hooks/useShift";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";

import { getPatientById, createPatient, updatePatient } from "@/lib/db";

import { storage } from "@/lib/storage";

export const Route = createFileRoute("/cadastro-manual")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tipo: (search.tipo as "admissao" | "internado") || "internado",
      id: (search.id as string) | undefined,
    };
  },
  component: CadastroManualPage,
  head: () => ({ meta: [{ title: "Cadastro Manual — DOUTOR AJUDA" }] }),
});

const PREDEFINED_COMORBIDITIES = ["HAS", "DM2", "ICC", "DPOC", "IRC", "Tabagismo", "Etilismo", "Neoplasia", "Obesidade"];

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
        nav({ to: generateEvolution ? "/evolucao/$id" : "/dashboard", params: { id: savedPatient.id } });
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
      nav({ to: generateEvolution ? "/evolucao/$id" : "/dashboard", params: { id: newPatient.id } as any });
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
                <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value.toUpperCase()})} className={inputCls} placeholder="Nome do paciente" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">IDADE</label>
                  <input type="number" value={form.idade} onChange={e => setForm({...form, idade: e.target.value})} className={inputCls} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">SEXO</label>
                  <div className="flex bg-secondary/50 rounded-xl p-1 h-[50px]">
                    {["F", "M"].map(s => (
                      <button key={s} onClick={() => setForm({...form, sexo: s as any})} className={`flex-1 rounded-lg text-xs font-bold transition-all ${form.sexo === s ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`}>
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
                <input value={form.leito} onChange={e => setForm({...form, leito: e.target.value.toUpperCase()})} className={inputCls} placeholder="Ex: L12" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">SETOR</label>
                <input value={form.setor} onChange={e => setForm({...form, setor: e.target.value.toUpperCase()})} className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">DATA DE ADMISSÃO</label>
                <input type="date" value={form.data_admissao} onChange={e => setForm({...form, data_admissao: e.target.value})} className={inputCls} />
              </div>
           </div>
           {tipo === 'admissao' && (
             <div className="space-y-2">
                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">PROCEDÊNCIA</label>
                <input value={form.procedencia} onChange={e => setForm({...form, procedencia: e.target.value})} className={inputCls} placeholder="Ex: UPA Central" />
             </div>
           )}
        </Section>

        {/* MOTIVO DA ADMISSÃO & HDA */}
        <Section title="MOTIVO DA ADMISSÃO" icon={<FileText className="h-5 w-5" />}>
           <textarea 
             value={form.motivo_admissao} 
             onChange={e => setForm({...form, motivo_admissao: e.target.value})} 
             className={textareaCls} 
             placeholder="Ex: dispneia progressiva há 3 dias..." 
             rows={2}
           />
           <div className="space-y-2 pt-4">
              <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">HDA (HISTÓRIA DA DOENÇA ATUAL)</label>
              <textarea 
                value={form.hda} 
                onChange={e => setForm({...form, hda: e.target.value})} 
                className={textareaCls} 
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
                  className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${form.comorbidades.includes(c) ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-white text-muted-foreground border-border hover:border-primary/40"}`}
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
                <input 
                  value={customComorbidity} 
                  onChange={e => setCustomComorbidity(e.target.value.toUpperCase())} 
                  className={inputCls} 
                  placeholder="DIGITE A COMORBIDADE" 
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
                  <input value={p.text} onChange={e => updateItem('lista_de_problemas', p.id, e.target.value.toUpperCase())} className={inputCls} placeholder="EX: INSUFICIÊNCIA CARDÍACA DESCOMPENSADA" />
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
                        <input value={atb.nome} onChange={e => {
                          const newList = [...form.antibioticos];
                          newList[idx].nome = e.target.value.toUpperCase();
                          setForm({...form, antibioticos: newList});
                        }} className={inputCls} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-muted-foreground uppercase">DOSE</label>
                          <input value={atb.dose} onChange={e => {
                            const newList = [...form.antibioticos];
                            newList[idx].dose = e.target.value.toUpperCase();
                            setForm({...form, antibioticos: newList});
                          }} className={inputCls} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-muted-foreground uppercase">DATA INÍCIO</label>
                          <input type="date" value={atb.dataInicio} onChange={e => {
                            const newList = [...form.antibioticos];
                            newList[idx].dataInicio = e.target.value;
                            setForm({...form, antibioticos: newList});
                          }} className={inputCls} />
                        </div>
                      </div>
                   </div>
                   <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[9px] font-bold text-muted-foreground uppercase">VIA</label>
                         <div className="flex bg-white rounded-xl p-1 border border-border">
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
           <div className="space-y-3">
              {form.medicacoes.map(m => (
                <div key={m.id} className="flex gap-2">
                  <input value={m.text} onChange={e => updateItem('medicacoes', m.id, e.target.value.toUpperCase())} className={inputCls} placeholder="NOME, DOSE, FREQUÊNCIA" />
                  <button onClick={() => removeItem('medicacoes', m.id)} className="p-4 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive transition-colors group">
                    <Trash2 className="h-5 w-5 group-hover:text-white" />
                  </button>
                </div>
              ))}
              <button onClick={() => addItem('medicacoes')} className="w-full py-4 border-2 border-dashed border-border rounded-xl text-xs font-bold text-muted-foreground hover:border-primary/40 transition-all flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" /> ADICIONAR MEDICAÇÃO
              </button>
           </div>
        </Section>

        {/* LABORATÓRIOS */}
        <Section title="LABORATÓRIOS" icon={<Activity className="h-5 w-5" />}>
           <div className="space-y-6">
              {form.laboratorios.map((lab, idx) => (
                <div key={lab.id} className="space-y-3 border-b border-border pb-6 last:border-0">
                   <div className="flex items-center justify-between">
                      <div className="w-40">
                         <input type="date" value={lab.data} onChange={e => {
                            const newList = [...form.laboratorios];
                            newList[idx].data = e.target.value;
                            setForm({...form, laboratorios: newList});
                         }} className={inputCls} />
                      </div>
                      {idx > 0 && (
                        <button onClick={() => setForm({...form, laboratorios: form.laboratorios.filter(l => l.id !== lab.id)})} className="text-destructive hover:bg-destructive/10 p-2 rounded-lg transition-colors">
                           <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                   </div>
                   <textarea 
                     value={lab.valor} 
                     onChange={e => {
                        const newList = [...form.laboratorios];
                        newList[idx].valor = e.target.value.toUpperCase();
                        setForm({...form, laboratorios: newList});
                     }} 
                     className={textareaCls} 
                     placeholder="Hb 10,2 | Ht 31 | Leuco 14500 | PCR 18 | Creat 1,4" 
                     rows={3} 
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
           <div className="space-y-6">
              {[
                { key: 'estado_geral', label: 'ESTADO GERAL', placeholder: 'EX: BEG, LOTE, ACIDANÓTICO, ANICTÉRICO...' },
                { key: 'acv', label: 'ACV (CARDIO-VASCULAR)', placeholder: 'EX: RCR 2T BNF SEM SOPROS, PULSOS PRESENTES' },
                { key: 'ar', label: 'AR (RESPIRATÓRIO)', placeholder: 'EX: MVU SEM RUÍDOS ADVENTÍCIOS, EUPNEICO' },
                { key: 'abdome', label: 'ABDOME', placeholder: 'EX: RHA+, PLANO, INDOLOR À PALPAÇÃO' },
                { key: 'neuro', label: 'NEUROLÓGICO', placeholder: 'EX: GLASGOW 15, SEM DÉFICITS' },
                { key: 'extremidades', label: 'EXTREMIDADES / MMII', placeholder: 'EX: SEM EDEMAS, SEM SINAIS DE TVP' },
                { key: 'pele', label: 'PELE / MUCOSAS', placeholder: 'EX: CORADAS, HIDRATADAS, SEM LESÕES' },
              ].map(field => (
                <div key={field.key} className="space-y-1">
                   <label className="text-[9px] font-bold text-muted-foreground uppercase">{field.label}</label>
                   <input 
                     value={(form.exame_fisico as any)[field.key]} 
                     onChange={e => setForm({...form, exame_fisico: {...form.exame_fisico, [field.key]: e.target.value.toUpperCase()}})} 
                     className={inputCls} 
                     placeholder={field.placeholder}
                   />
                </div>
              ))}
           </div>
        </Section>

        {/* CAMPOS EXTRAS (UTI / PEDIATRIA) */}
        {tipoEvolucao === 'uti' && (
          <Section title="CAMPOS UTI" icon={<Wind className="h-5 w-5" />}>
             <div className="space-y-8">
                <div className="flex items-center justify-between bg-secondary/30 p-4 rounded-xl border border-border">
                   <div className="flex items-center gap-3">
                      <Wind className="h-5 w-5 text-primary" />
                      <span className="text-xs font-bold uppercase tracking-widest">VENTILAÇÃO MECÂNICA</span>
                   </div>
                   <div className="flex bg-white rounded-lg p-1 border border-border">
                      <button onClick={() => setForm({...form, uti: {...form.uti, vm: false}})} className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all ${!form.uti.vm ? "bg-primary text-white" : "text-muted-foreground"}`}>NÃO</button>
                      <button onClick={() => setForm({...form, uti: {...form.uti, vm: true}})} className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all ${form.uti.vm ? "bg-primary text-white" : "text-muted-foreground"}`}>SIM</button>
                   </div>
                </div>

                {form.uti.vm && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-in fade-in slide-in-from-top-2">
                     {['modo', 'fio2', 'peep', 'volume', 'fr'].map(v => (
                       <div key={v} className="space-y-1">
                          <label className="text-[9px] font-bold text-muted-foreground uppercase">{v.toUpperCase()}</label>
                          <input 
                            value={(form.uti as any)[v]} 
                            onChange={e => setForm({...form, uti: {...form.uti, [v]: e.target.value.toUpperCase()}})} 
                            className={inputCls} 
                          />
                       </div>
                     ))}
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-8">
                   <div className="space-y-3">
                      <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">DROGAS VASOATIVAS</label>
                      {form.uti.dva.map(dva => (
                        <div key={dva.id} className="flex gap-2">
                           <input value={dva.text} onChange={e => setForm({...form, uti: {...form.uti, dva: form.uti.dva.map(item => item.id === dva.id ? {...item, text: e.target.value.toUpperCase()} : item)}})} className={inputCls} placeholder="EX: NORADRENALINA 0.1 MCG/KG/MIN" />
                           <button onClick={() => setForm({...form, uti: {...form.uti, dva: form.uti.dva.filter(item => item.id !== dva.id)}})} className="p-4 rounded-xl bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                      <button onClick={() => setForm({...form, uti: {...form.uti, dva: [...form.uti.dva, {id: Date.now().toString(), text: ""}]}})} className="w-full py-4 border-2 border-dashed border-border rounded-xl text-[10px] font-bold text-muted-foreground">+ ADICIONAR DVA</button>
                   </div>
                   <div className="space-y-6">
                      <div className="space-y-2">
                         <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">BALANÇO HÍDRICO 24H (ML)</label>
                         <input type="number" value={form.uti.bh} onChange={e => setForm({...form, uti: {...form.uti, bh: e.target.value}})} className={inputCls} placeholder="EX: +1200" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">SEDAÇÃO</label>
                         <input value={form.uti.sedacao} onChange={e => setForm({...form, uti: {...form.uti, sedacao: e.target.value.toUpperCase()}})} className={inputCls} placeholder="EX: FENTANIL + MIDAZOLAM" />
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
                   <input type="number" value={form.pediatria.peso} onChange={e => setForm({...form, pediatria: {...form.pediatria, peso: e.target.value}})} className={inputCls} />
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-bold text-muted-foreground uppercase">ALTURA (CM)</label>
                   <input type="number" value={form.pediatria.altura} onChange={e => setForm({...form, pediatria: {...form.pediatria, altura: e.target.value}})} className={inputCls} />
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-bold text-muted-foreground uppercase">IDADE EM MESES</label>
                   <input type="number" value={form.pediatria.meses} onChange={e => setForm({...form, pediatria: {...form.pediatria, meses: e.target.value}})} className={inputCls} />
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
                   <textarea value={form.pediatria.desenvolvimento} onChange={e => setForm({...form, pediatria: {...form.pediatria, desenvolvimento: e.target.value}})} className={textareaCls} rows={2} />
                </div>
             </div>
          </Section>
        )}

        {/* CONDUTAS */}
        <Section title="CONDUTAS" icon={<Save className="h-5 w-5" />}>
           <textarea value={form.condutas} onChange={e => setForm({...form, condutas: e.target.value.toUpperCase()})} className={textareaCls} rows={4} placeholder="Digite o plano terapêutico..." />
        </Section>

        {/* PENDÊNCIAS */}
        <Section title="PENDÊNCIAS" icon={<AlertTriangle className="h-5 w-5" />}>
           <div className="space-y-3">
              {form.pendencias.map(p => (
                <div key={p.id} className="flex gap-2">
                  <div className="flex items-center justify-center w-12 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20 shrink-0">
                     <AlertTriangle className="h-4 w-4" />
                  </div>
                  <input value={p.text} onChange={e => updateItem('pendencias', p.id, e.target.value.toUpperCase())} className={inputCls} placeholder="EX: AGUARDANDO RESULTADO DE ECOCARDIOGRAMA" />
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
      <div className="bg-white border border-border rounded-[3rem] p-8 md:p-12 shadow-sm space-y-6">
        {children}
      </div>
    </div>
  );
}

const inputCls = "w-full bg-secondary/40 border border-border rounded-xl px-5 py-4 text-sm font-bold placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white transition-all uppercase";
const textareaCls = "w-full bg-secondary/40 border border-border rounded-2xl px-5 py-5 text-sm font-bold placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white leading-relaxed transition-all uppercase";
