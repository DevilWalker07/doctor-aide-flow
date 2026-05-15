import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  User, Stethoscope, ClipboardList, FlaskConical, AlertCircle, 
  Trash2, Plus, Save, RefreshCw, X, AlertTriangle, Pill, Calendar,
  Activity, ArrowRight, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, parseISO, isValid } from "date-fns";
import { createPatient, mergePatientData, type Patient } from "@/lib/db";

export const Route = createFileRoute("/revisar-extracao")({
  component: RevisarExtracao,
  head: () => ({ meta: [{ title: "Revisar Extração — DOUTOR AJUDA" }] }),
});

function RevisarExtracao() {
  const { patient_id } = Route.useSearch() as any;
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("doutor_ajuda_extracao");
    if (!raw) {
      toast.error("Nenhum dado de extração encontrado.");
      nav({ to: "/dashboard" });
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      
      // Normalize and prepare data for editable state
      const preparedData = {
        ...parsed,
        nome: parsed.nome || "",
        idade: parsed.idade || "",
        sexo: parsed.sexo || "F",
        leito: parsed.leito || "",
        setor: parsed.setor || "",
        data_admissao: parsed.data_admissao || new Date().toISOString().slice(0, 10),
        hda: parsed.hda || "",
        motivo_admissao: parsed.motivo_admissao || "",
        lista_de_problemas: (parsed.lista_de_problemas || []).map((p: string) => ({ id: Math.random().toString(36).substr(2, 9), text: p })),
        antibioticos: (parsed.antibioticos || []).map((a: string) => ({
          id: Math.random().toString(36).substr(2, 9),
          nome: a,
          dose: "",
          via: "",
          frequencia: "",
          dataInicio: new Date().toISOString().slice(0, 10)
        })),
        medicacoes: (parsed.medicacoes || []).map((m: string) => ({ id: Math.random().toString(36).substr(2, 9), text: m })),
        laboratorios: (parsed.laboratorios || []).map((l: string) => ({ 
          id: Math.random().toString(36).substr(2, 9), 
          data: new Date().toISOString().slice(0, 10),
          valor: l 
        })),
        exame_fisico_detalhado: parsed.exame_fisico_detalhado || {
          geral: "", acv: "", ar: "", abdome: "", neuro: "", extremidades: "", pele: ""
        },
        condutas: (parsed.condutas || []).map((c: string) => ({ id: Math.random().toString(36).substr(2, 9), text: c })),
        pendencias: (parsed.pendencias || []).map((p: string) => ({ id: Math.random().toString(36).substr(2, 9), text: p })),
        alertas: parsed.alertas || []
      };
      
      setData(preparedData);
    } catch (e) {
      toast.error("Erro ao carregar dados da extração.");
      nav({ to: "/dashboard" });
    }
  }, [nav]);

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    
    try {
      const shiftId = localStorage.getItem("da_shift_id");
      
      // If we have a real shift ID, try saving to Supabase
      if (shiftId && !shiftId.startsWith("temp_")) {
        let savedPatient;
        
        if (patient_id) {
          // Merge with existing patient
          savedPatient = await mergePatientData(patient_id, {
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
          });
        } else {
          // Create new patient
          savedPatient = await createPatient({
            shift_id: shiftId,
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
            pending_issues: data.pendencias.map((p: any) => p.text),
            status: 'internado',
            tipo_admissao: 'admissao'
          });
        }

        localStorage.setItem("da_paciente_atual_id", savedPatient.id);
        localStorage.removeItem("doutor_ajuda_extracao");
        toast.success("Dados salvos no Supabase com sucesso!");
        nav({ to: "/paciente/$id", params: { id: savedPatient.id } });
        return;
      }
      
      throw new Error("Offline ou ID temporário");
    } catch (err) {
      console.warn("Falha ao salvar no Supabase, usando fallback", err);
      toast.warning("Erro ao salvar. Dados mantidos localmente.");
      
      // Fallback
      const fallbackId = patient_id || "temp_" + Date.now();
      const existing = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
      const idx = existing.findIndex((p: any) => p.id === fallbackId);
      
      const newPatientData = { id: fallbackId, ...data };
      if (idx >= 0) {
        existing[idx] = newPatientData;
      } else {
        existing.push(newPatientData);
      }
      
      localStorage.setItem("da_pacientes", JSON.stringify(existing));
      localStorage.setItem("da_paciente_atual", fallbackId);
      localStorage.setItem("doutor_ajuda_paciente_atual", JSON.stringify(data)); // legacy support
      
      nav({ to: "/paciente/temp" });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (confirm("Descartar todos os dados extraídos?")) {
      localStorage.removeItem("doutor_ajuda_extracao");
      nav({ to: "/dashboard" });
    }
  };

  const handleReprocess = () => {
    nav({ to: "/paciente-internado" });
  };

  const updateField = (path: string, value: any) => {
    setData((prev: any) => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const addItem = (listKey: string, defaultValue: any) => {
    updateField(listKey, [...data[listKey], { id: Math.random().toString(36).substr(2, 9), ...defaultValue }]);
  };

  const removeItem = (listKey: string, id: string) => {
    updateField(listKey, data[listKey].filter((item: any) => item.id !== id));
  };

  const updateItemField = (listKey: string, id: string, field: string, value: any) => {
    updateField(listKey, data[listKey].map((item: any) => item.id === id ? { ...item, [field]: value } : item));
  };

  const calculateDValue = (startDateStr: string) => {
    const start = parseISO(startDateStr);
    if (!isValid(start)) return "D?";
    const diff = differenceInDays(new Date(), start);
    return `D${diff >= 0 ? diff + 1 : 0}`;
  };

  return (
    <div className="min-h-screen bg-background pb-40">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-ai/10 text-ai flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight">REVISAR EXTRAÇÃO</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Confirme e edite os dados extraídos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleReprocess} className="p-2.5 hover:bg-secondary rounded-xl transition-all text-muted-foreground group" title="Reprocessar">
              <RefreshCw className="h-5 w-5 group-hover:rotate-180 transition-transform duration-500" />
            </button>
            <button onClick={handleDiscard} className="p-2.5 hover:bg-destructive/10 hover:text-destructive rounded-xl transition-all text-muted-foreground" title="Descartar">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        
        {/* 1. IDENTIFICAÇÃO */}
        <Section title="IDENTIFICAÇÃO" icon={<User className="h-5 w-5" />}>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">NOME COMPLETO</label>
              <input value={data.nome} onChange={(e) => updateField('nome', e.target.value)} className={inputCls} placeholder="Ex: Maria José da Silva" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">IDADE</label>
                <input type="number" value={data.idade} onChange={(e) => updateField('idade', e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">SEXO</label>
                <div className="flex bg-secondary/50 rounded-xl p-1 h-[50px]">
                  {["F", "M"].map(s => (
                    <button 
                      key={s} 
                      onClick={() => updateField('sexo', s)}
                      className={`flex-1 rounded-lg text-xs font-bold transition-all ${data.sexo === s ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {s === "F" ? "FEMININO" : "MASCULINO"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">LEITO</label>
              <input value={data.leito} onChange={(e) => updateField('leito', e.target.value.toUpperCase())} className={inputCls} placeholder="Ex: L12" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">SETOR</label>
              <input value={data.setor} onChange={(e) => updateField('setor', e.target.value)} className={inputCls} placeholder="Ex: UTI Adulto" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">DATA ADMISSÃO</label>
              <input type="date" value={data.data_admissao} onChange={(e) => updateField('data_admissao', e.target.value)} className={inputCls} />
            </div>
          </div>
        </Section>

        {/* 2. HISTÓRIA CLÍNICA */}
        <Section title="HISTÓRIA CLÍNICA" icon={<Stethoscope className="h-5 w-5" />}>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">MOTIVO DA ADMISSÃO</label>
              <textarea value={data.motivo_admissao} onChange={(e) => updateField('motivo_admissao', e.target.value)} rows={2} className={textareaCls} placeholder="Ex: Insuficiência respiratória aguda..." />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">HDA</label>
              <textarea value={data.hda} onChange={(e) => updateField('hda', e.target.value)} rows={6} className={textareaCls} placeholder="Descreva o curso clínico e anamnese..." />
            </div>
          </div>
        </Section>

        {/* 3. LISTA DE PROBLEMAS */}
        <Section title="LISTA DE PROBLEMAS" icon={<ClipboardList className="h-5 w-5" />}>
          <div className="space-y-3">
            {data.lista_de_problemas.map((p: any) => (
              <div key={p.id} className="flex gap-2 group animate-in slide-in-from-left-2 duration-300">
                <input value={p.text} onChange={(e) => updateItemField('lista_de_problemas', p.id, 'text', e.target.value)} className={inputCls} placeholder="Descreva o problema..." />
                <button onClick={() => removeItem('lista_de_problemas', p.id)} className="p-3.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
            <button onClick={() => addItem('lista_de_problemas', { text: "" })} className="w-full py-4 border-2 border-dashed border-border rounded-2xl text-xs font-bold text-muted-foreground hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-2 mt-2">
              <Plus className="h-4 w-4" /> ADICIONAR PROBLEMA
            </button>
          </div>
        </Section>

        {/* 4. ANTIBIÓTICOS */}
        <Section title="ANTIBIÓTICOS" icon={<FlaskConical className="h-5 w-5" />}>
          <div className="space-y-6">
            {data.antibioticos.map((a: any) => (
              <div key={a.id} className="bg-secondary/20 border border-border rounded-3xl p-6 space-y-6 relative group animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between border-b border-border/50 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Pill className="h-4 w-4" />
                    </div>
                    <span className="font-extrabold text-sm uppercase tracking-tight">
                      {a.nome || "Novo ATB"} — <span className="text-primary">{calculateDValue(a.dataInicio)}</span>
                    </span>
                  </div>
                  <button onClick={() => removeItem('antibioticos', a.id)} className="text-muted-foreground hover:text-destructive p-2 rounded-lg hover:bg-destructive/10 transition-all">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest ml-1">NOME DO ANTIBIÓTICO</label>
                    <input value={a.nome} onChange={(e) => updateItemField('antibioticos', a.id, 'nome', e.target.value)} className={inputSmallCls} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest ml-1">DOSE</label>
                    <input value={a.dose} onChange={(e) => updateItemField('antibioticos', a.id, 'dose', e.target.value)} className={inputSmallCls} placeholder="Ex: 1g" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest ml-1">VIA</label>
                    <input value={a.via} onChange={(e) => updateItemField('antibioticos', a.id, 'via', e.target.value)} className={inputSmallCls} placeholder="Ex: EV" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest ml-1">FREQUÊNCIA</label>
                    <input value={a.frequencia} onChange={(e) => updateItemField('antibioticos', a.id, 'frequencia', e.target.value)} className={inputSmallCls} placeholder="Ex: 12/12h" />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest ml-1">DATA DE INÍCIO</label>
                    <input type="date" value={a.dataInicio} onChange={(e) => updateItemField('antibioticos', a.id, 'dataInicio', e.target.value)} className={inputSmallCls} />
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => addItem('antibioticos', { nome: "", dose: "", via: "", frequencia: "", dataInicio: new Date().toISOString().slice(0, 10) })} className="w-full py-5 border-2 border-dashed border-border rounded-2xl text-xs font-bold text-muted-foreground hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" /> ADICIONAR ANTIBIÓTICO
            </button>
          </div>
        </Section>

        {/* 5. MEDICAÇÕES */}
        <Section title="MEDICAÇÕES" icon={<Pill className="h-5 w-5" />}>
           <div className="space-y-3">
            {data.medicacoes.map((m: any) => (
              <div key={m.id} className="flex gap-2 group animate-in slide-in-from-left-2 duration-300">
                <input value={m.text} onChange={(e) => updateItemField('medicacoes', m.id, 'text', e.target.value)} className={inputCls} placeholder="Nome, dose e posologia..." />
                <button onClick={() => removeItem('medicacoes', m.id)} className="p-3.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
            <button onClick={() => addItem('medicacoes', { text: "" })} className="w-full py-4 border-2 border-dashed border-border rounded-2xl text-xs font-bold text-muted-foreground hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-2 mt-2">
              <Plus className="h-4 w-4" /> ADICIONAR MEDICAÇÃO
            </button>
          </div>
        </Section>

        {/* 6. LABORATÓRIOS */}
        <Section title="LABORATÓRIOS" icon={<FlaskConical className="h-5 w-5" />}>
          <div className="space-y-4">
            {data.laboratorios.map((l: any) => (
              <div key={l.id} className="flex flex-col md:flex-row gap-4 p-5 bg-secondary/20 rounded-3xl border border-border animate-in zoom-in-95 duration-300">
                <div className="md:w-48">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest ml-1 block mb-1">DATA</label>
                  <input type="date" value={l.data} onChange={(e) => updateItemField('laboratorios', l.id, 'data', e.target.value)} className={inputSmallCls} />
                </div>
                <div className="flex-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest ml-1 block mb-1">RESULTADOS (TEXTO COMPACTO)</label>
                  <input value={l.valor} onChange={(e) => updateItemField('laboratorios', l.id, 'valor', e.target.value)} className={inputSmallCls} placeholder="Ex: Hb 12.5, Leuco 14k, PCR 45..." />
                </div>
                <button onClick={() => removeItem('laboratorios', l.id)} className="self-end p-2.5 text-muted-foreground hover:text-destructive transition-all">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
            <button onClick={() => addItem('laboratorios', { data: new Date().toISOString().slice(0, 10), valor: "" })} className="w-full py-4 border-2 border-dashed border-border rounded-2xl text-xs font-bold text-muted-foreground hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-2 mt-2">
              <Calendar className="h-4 w-4" /> ADICIONAR DATA
            </button>
          </div>
        </Section>

        {/* 7. EXAME FÍSICO */}
        <Section title="EXAME FÍSICO" icon={<Activity className="h-5 w-5" />}>
          <div className="grid md:grid-cols-2 gap-8">
            {[
              { key: "geral", label: "GERAL" },
              { key: "acv", label: "CARDIOVASCULAR" },
              { key: "ar", label: "RESPIRATÓRIO" },
              { key: "abdome", label: "ABDOME" },
              { key: "neuro", label: "NEUROLÓGICO" },
              { key: "extremidades", label: "EXTREMIDADES" },
              { key: "pele", label: "PELE / FÂNEROS" }
            ].map((field) => (
              <div key={field.key} className="space-y-2">
                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">{field.label}</label>
                <input 
                  value={data.exame_fisico_detalhado[field.key]} 
                  onChange={(e) => updateField(`exame_fisico_detalhado.${field.key}`, e.target.value)} 
                  className={inputCls} 
                  placeholder={`Descrição ${field.label.toLowerCase()}...`}
                />
              </div>
            ))}
          </div>
        </Section>

        {/* 8. CONDUTAS */}
        <Section title="CONDUTAS" icon={<ClipboardList className="h-5 w-5" />}>
           <div className="space-y-3">
            {data.condutas.map((c: any) => (
              <div key={c.id} className="flex gap-2 group animate-in slide-in-from-left-2 duration-300">
                <input value={c.text} onChange={(e) => updateItemField('condutas', c.id, 'text', e.target.value)} className={inputCls} placeholder="Descreva a conduta..." />
                <button onClick={() => removeItem('condutas', c.id)} className="p-3.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
            <button onClick={() => addItem('condutas', { text: "" })} className="w-full py-4 border-2 border-dashed border-border rounded-2xl text-xs font-bold text-muted-foreground hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-2 mt-2">
              <Plus className="h-4 w-4" /> ADICIONAR CONDUTA
            </button>
          </div>
        </Section>

        {/* 9. PENDÊNCIAS */}
        <Section title="PENDÊNCIAS" icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}>
           <div className="space-y-3">
            {data.pendencias.map((p: any) => (
              <div key={p.id} className="flex gap-3 group animate-in slide-in-from-left-2 duration-300">
                <div className="h-12 w-12 shrink-0 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <input value={p.text} onChange={(e) => updateItemField('pendencias', p.id, 'text', e.target.value)} className={inputCls} placeholder="Ex: Aguardar resultado de biópsia..." />
                <button onClick={() => removeItem('pendencias', p.id)} className="p-3.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
            <button onClick={() => addItem('pendencias', { text: "" })} className="w-full py-4 border-2 border-dashed border-border rounded-2xl text-xs font-bold text-muted-foreground hover:border-amber-500/50 hover:text-amber-600 transition-all flex items-center justify-center gap-2 mt-2">
              <Plus className="h-4 w-4" /> ADICIONAR PENDÊNCIA
            </button>
          </div>
        </Section>

        {/* 10. ALERTAS DA IA */}
        {data.alertas && data.alertas.length > 0 && (
          <Section title="ALERTAS DA IA" icon={<AlertCircle className="h-5 w-5 text-destructive" />}>
            <div className="space-y-4">
              {data.alertas.map((alerta: string, i: number) => {
                const isCritical = alerta.includes("ilegível") || alerta.includes("🔴");
                return (
                  <div key={i} className={`p-5 rounded-2xl flex gap-4 items-center border transition-all ${isCritical ? "bg-red-50 text-red-700 border-red-100" : "bg-amber-50 text-amber-700 border-amber-100"}`}>
                     <span className="text-xl shrink-0">{isCritical ? "🔴" : "🟡"}</span>
                     <p className="text-xs font-bold uppercase tracking-wide leading-relaxed">{alerta}</p>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

      </main>

      {/* Footer Actions */}
      <footer className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border p-6 z-40 shadow-2xl">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-4">
          <button 
            onClick={handleReprocess}
            className="flex-1 py-4.5 px-6 rounded-2xl border border-border font-bold uppercase tracking-widest text-[10px] text-muted-foreground hover:bg-secondary transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" /> REPROCESSAR
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex-[2.5] py-4.5 px-8 rounded-2xl bg-primary text-primary-foreground font-extrabold uppercase tracking-[0.15em] text-[10px] shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>SALVAR E ABRIR PACIENTE <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      </footer>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string, icon: any, children: any }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="flex items-center gap-3 mb-6 ml-2">
        <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground border border-border/50">
          {icon}
        </div>
        <h2 className="text-xs font-extrabold tracking-[0.25em] uppercase text-foreground">{title}</h2>
      </div>
      <div className="bg-white border border-border rounded-[3rem] p-8 md:p-12 shadow-sm space-y-10">
        {children}
      </div>
    </div>
  );
}

const Loader2 = ({ className }: { className?: string }) => (
  <RefreshCw className={`animate-spin ${className}`} />
);

const inputCls = "w-full bg-secondary/40 border border-border rounded-xl px-5 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all placeholder:text-muted-foreground/50";
const inputSmallCls = "w-full bg-secondary/40 border border-border rounded-xl px-4 py-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all";
const textareaCls = "w-full bg-secondary/40 border border-border rounded-2xl px-5 py-5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 leading-relaxed transition-all placeholder:text-muted-foreground/50";
