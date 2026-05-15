import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { 
  ChevronLeft, Copy, Save, Pill, Activity, 
  AlertTriangle, Check, Plus, Trash2, Edit3, 
  Info, HeartPulse, Wind, FlaskConical, ArrowRight
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { getPatientById, createPrescription } from "@/lib/db";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { storage } from "@/lib/storage";

export const Route = createFileRoute("/prescricao/$id")({
  component: PrescricaoPage,
  head: () => ({ meta: [{ title: "Gerar Prescrição — DOUTOR AJUDA" }] }),
});

const DIET_OPTIONS = ["Geral", "Hipossódica", "Hipolipídica", "Hipoglicídica", "Pastosa", "Líquida", "Zero via oral", "Sonda"];
const CARE_CHIPS = ["Cabeceira 30°", "Decúbito elevado", "Mobilização precoce", "Peso diário", "Controle de diurese", "Cuidados com cateter", "Controle de glicemia", "Fisioterapia respiratória"];
const VITALS_FREQ = ["6/6h", "4/4h", "2/2h", "Contínuo"];
const VITALS_PARAMS = ["Oximetria", "Glicemia capilar", "Débito urinário", "PVC"];
const SYMPTOMATIC_CHIPS = [
  "Dipirona 1g IV se dor ou T>37,8°C",
  "Paracetamol 1g VO se dor ou febre",
  "Metoclopramida 10mg IV se náusea",
  "Ondansetrona 4mg IV se náusea refratária",
  "Bromoprida 10mg VO 8/8h",
  "Ranitidina 50mg IV 12/12h",
  "Tramadol 100mg IV se dor moderada/intensa"
];
const PROPHYLAXIS_CHIPS = [
  "Enoxaparina 40mg SC 1x/dia",
  "Heparina 5000UI SC 8/8h",
  "Omeprazol 20mg VO 1x/dia",
  "Omeprazol 40mg IV 1x/dia",
  "Sulfato ferroso 40mg VO",
  "Vitamina D 1000UI VO"
];

function PrescricaoPage() {
  const { id } = useParams({ from: "/prescricao/$id" });
  const nav = useNavigate();
  const { userId } = useSupabaseUser();
  const [paciente, setPaciente] = useState<any>(null);
  const [tipoUnidade, setTipoUnidade] = useState<string>("enfermaria_clinica");
  const [isSaving, setIsSaving] = useState(false);

  // ... (state setters)
  const [dieta, setDieta] = useState("");
  const [dietaComplemento, setDietaComplemento] = useState("");
  const [cuidados, setCuidados] = useState<string[]>([]);
  const [vitalsFreq, setVitalsFreq] = useState("");
  const [vitalsParams, setVitalsParams] = useState<string[]>([]);
  const [medicacoes, setMedicacoes] = useState<any[]>([]);
  const [antibioticos, setAntibioticos] = useState<any[]>([]);
  const [sintomaticos, setSintomaticos] = useState<string[]>([]);
  const [profilaxias, setProfilaxias] = useState<string[]>([]);
  const [hidratacao, setHidratacao] = useState({ active: false, tipo: "", volume: "", velocidade: "" });
  const [exames, setExames] = useState<string[]>([]);
  const [pendencias, setPendencias] = useState<string[]>([]);
  
  // UTI specific
  const [dvas, setDvas] = useState<any[]>([]);
  const [sedacao, setSedacao] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      try {
        if (id.startsWith("temp_")) throw new Error("Local");
        const p = await getPatientById(id, userId!);
        setPaciente(p);
        setMedicacoes((p.medications || []).map((m: string) => ({ id: Math.random().toString(), text: m })));
        setAntibioticos(p.antibiotics || []);
        setPendencias(p.pending_issues || []);
      } catch (err) {
        const existing = storage.getLocalPacientes();
        const p = existing.find((x: any) => x.id === id);
        if (p) {
          setPaciente(p);
          setMedicacoes(p.medicacoes || []);
          setAntibioticos(p.antibioticos || []);
          setPendencias(p.pendencias?.map((item: any) => item.text) || []);
          if (p.uti?.dva) setDvas(p.uti.dva);
          if (p.uti?.sedacao) setSedacao([{ id: "sed_1", text: p.uti.sedacao }]);
        }
      }
    }
    load();
    const savedTipo = storage.getTipo();
    if (savedTipo) setTipoUnidade(savedTipo);
  }, [id, userId]);

  const handleCopy = () => {
    const dataPlantao = format(new Date(), "dd/MM/yyyy");
    let text = `PRESCRIÇÃO MÉDICA — ${paciente.name} — LEITO ${paciente.bed} — ${dataPlantao}\n\n`;

    text += `1. DIETA: ${dieta}${dietaComplemento ? ` (${dietaComplemento})` : ""}\n`;
    text += `2. CUIDADOS GERAIS:\n${cuidados.map(c => `   - ${c}`).join("\n")}\n`;
    text += `3. SINAIS VITAIS: ${vitalsFreq} ${vitalsParams.length > 0 ? `+ ${vitalsParams.join(", ")}` : ""}\n`;
    text += `4. MEDICAÇÕES CONTÍNUAS:\n${medicacoes.map(m => `   - ${m.text}`).join("\n")}\n`;
    text += `5. ANTIBIÓTICOS:\n${antibioticos.map(a => `   - ${a.nome} ${a.dose} ${a.via} ${a.frequencia}`).join("\n")}\n`;
    text += `6. SINTOMÁTICOS:\n${sintomaticos.map(s => `   - ${s}`).join("\n")}\n`;
    text += `7. PROFILAXIAS:\n${profilaxias.map(p => `   - ${p}`).join("\n")}\n`;
    text += `8. HIDRATAÇÃO: ${hidratacao.active ? `${hidratacao.tipo} ${hidratacao.volume}ml (${hidratacao.velocidade}ml/h)` : "Nenhuma"}\n`;
    text += `9. EXAMES:\n${exames.map(e => `   - ${e}`).join("\n")}\n`;
    text += `10. PENDÊNCIAS:\n${pendencias.map(p => `    - ${p}`).join("\n")}\n`;

    if (tipoUnidade === "uti") {
      text += `\n11. DROGAS VASOATIVAS:\n${dvas.map(d => `    - ${d.text}`).join("\n")}\n`;
      text += `12. SEDAÇÃO / ANALGESIA:\n${sedacao.map(s => `    - ${s.text}`).join("\n")}\n`;
    }

    navigator.clipboard.writeText(text.toUpperCase());
    toast.success("Prescrição copiada para a área de transferência!");
  };

  const handleSave = async () => {
    if (isSaving || !userId) return;
    setIsSaving(true);
    
    const prescricaoContent = {
      dieta: dietaComplemento ? `${dieta} (${dietaComplemento})` : dieta,
      cuidados_gerais: cuidados,
      sinais_vitais: `${vitalsFreq} ${vitalsParams.length > 0 ? `+ ${vitalsParams.join(", ")}` : ""}`,
      medicacoes_continuas: medicacoes.map(m => m.text),
      antibioticos: antibioticos.map(a => `${a.nome} ${a.dose} ${a.via} ${a.frequencia}`),
      sintomaticos,
      profilaxias,
      hidratacao: hidratacao.active ? `${hidratacao.tipo} ${hidratacao.volume}ml (${hidratacao.velocidade}ml/h)` : "Nenhuma",
      exames,
      pendencias,
      ...(tipoUnidade === "uti" ? {
        dvas: dvas.map(d => d.text),
        sedacao: sedacao.map(s => s.text)
      } : {})
    };

    try {
      const shiftId = storage.getShiftId();
      if (shiftId && !shiftId.startsWith("temp_") && !id.startsWith("temp_")) {
        await createPrescription({
          patient_id: id,
          shift_id: shiftId,
          content: prescricaoContent
        }, userId);
        toast.success("Prescrição salva!");
      } else {
        throw new Error("Local fallback");
      }
    } catch (error) {
      console.warn("Salvando prescrição localmente", error);
      const prescricao = {
        patient_id: id,
        shift_id: storage.getShiftId() || "unknown",
        data: new Date().toISOString(),
        content: prescricaoContent
      };
      const existing = JSON.parse(localStorage.getItem("da_prescricoes") || "[]");
      existing.push(prescricao);
      localStorage.setItem("da_prescricoes", JSON.stringify(existing));
      toast.success("Prescrição salva localmente!");
    } finally {
      setIsSaving(false);
      nav({ to: "/dashboard" });
    }
  };

  if (!paciente) return null;

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="bg-white border-b border-border sticky top-0 z-30 shadow-sm overflow-hidden">
        <div className="absolute top-0 left-0 w-1 bg-primary h-full" />
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <button onClick={() => nav({ to: "/paciente/$id", params: { id } })} className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary transition-all">
                 <ChevronLeft className="h-5 w-5" />
              </button>
              <div>
                 <h1 className="text-xl font-black text-foreground tracking-tight uppercase">PRESCRIÇÃO MÉDICA</h1>
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{paciente.name} · LEITO {paciente.bed} · {format(new Date(), "dd/MM/yyyy")}</p>
              </div>
           </div>
           <div className="flex items-center gap-3">
              <button onClick={handleSave} disabled={isSaving} className="px-6 py-2.5 rounded-xl border border-border text-[10px] font-black uppercase tracking-widest hover:bg-secondary transition-all flex items-center gap-2 disabled:opacity-50">
                 <Save className="h-3 w-3" /> {isSaving ? "SALVANDO..." : "SALVAR"}
              </button>
              <button onClick={handleCopy} className="px-6 py-2.5 rounded-xl bg-navy text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-navy/20 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                 <Copy className="h-3 w-3" /> COPIAR
              </button>
           </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
         
         {/* 1. DIETA */}
         <Section title="1. DIETA" icon={<Activity className="h-4 w-4" />}>
            <div className="flex flex-wrap gap-2 mb-4">
               {DIET_OPTIONS.map(opt => (
                  <Chip key={opt} label={opt} selected={dieta === opt} onClick={() => setDieta(opt)} />
               ))}
            </div>
            <input 
               value={dietaComplemento} 
               onChange={e => setDietaComplemento(e.target.value.toUpperCase())}
               className={inputCls} 
               placeholder="COMPLEMENTO DA DIETA (EX: VIA ORAL, 1200KCAL...)" 
            />
         </Section>

         {/* 2. CUIDADOS GERAIS */}
         <Section title="2. CUIDADOS GERAIS" icon={<Info className="h-4 w-4" />}>
            <div className="flex flex-wrap gap-2 mb-6">
               {CARE_CHIPS.map(opt => (
                  <Chip key={opt} label={opt} selected={cuidados.includes(opt)} onClick={() => setCuidados(prev => prev.includes(opt) ? prev.filter(i => i !== opt) : [...prev, opt])} />
               ))}
               <button className="px-4 py-2 rounded-xl bg-secondary text-muted-foreground text-[10px] font-bold uppercase">+ ADICIONAR OUTRO</button>
            </div>
            <EditableList items={cuidados} onChange={setCuidados} />
         </Section>

         {/* 3. SINAIS VITAIS */}
         <Section title="3. SINAIS VITAIS" icon={<Activity className="h-4 w-4" />}>
            <div className="flex flex-wrap gap-2 mb-6">
               {VITALS_FREQ.map(opt => (
                  <Chip key={opt} label={opt} selected={vitalsFreq === opt} onClick={() => setVitalsFreq(opt)} />
               ))}
            </div>
            <div className="flex flex-wrap gap-2">
               {VITALS_PARAMS.map(opt => (
                  <Chip key={opt} label={opt} selected={vitalsParams.includes(opt)} onClick={() => setVitalsParams(prev => prev.includes(opt) ? prev.filter(i => i !== opt) : [...prev, opt])} />
               ))}
               <button className="px-4 py-2 rounded-xl bg-secondary text-muted-foreground text-[10px] font-bold uppercase">+ ADICIONAR</button>
            </div>
         </Section>

         {/* 4. MEDICAÇÕES CONTÍNUAS */}
         <Section title="4. MEDICAÇÕES DE USO CONTÍNUO" icon={<Pill className="h-4 w-4" />}>
            <div className="space-y-3">
               {medicacoes.map((m, idx) => (
                  <div key={m.id} className="flex gap-2">
                     <input value={m.text} onChange={e => {
                        const next = [...medicacoes];
                        next[idx].text = e.target.value.toUpperCase();
                        setMedicacoes(next);
                     }} className={inputCls} />
                     <button onClick={() => setMedicacoes(medicacoes.filter(item => item.id !== m.id))} className="p-4 rounded-xl bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
               ))}
               <button onClick={() => setMedicacoes([...medicacoes, { id: Date.now().toString(), text: "" }])} className="w-full py-4 border-2 border-dashed border-border rounded-xl text-[10px] font-bold text-muted-foreground uppercase">+ ADICIONAR MEDICAÇÃO</button>
            </div>
         </Section>

         {/* 5. ANTIBIÓTICOS */}
         <Section title="5. ANTIBIÓTICOS" icon={<FlaskConical className="h-4 w-4" />}>
            <div className="space-y-3">
               {antibioticos.map((a, idx) => (
                  <div key={idx} className="flex gap-2 items-center p-4 bg-ai/5 border border-ai/20 rounded-2xl">
                     <div className="flex-1">
                        <p className="text-xs font-black text-ai uppercase tracking-tight">{a.nome} {a.dose} {a.via} {a.frequencia}</p>
                     </div>
                     <button className="p-2 text-muted-foreground hover:text-primary"><Edit3 className="h-4 w-4" /></button>
                     <button onClick={() => setAntibioticos(antibioticos.filter((_, i) => i !== idx))} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
               ))}
               <button className="w-full py-4 border-2 border-dashed border-ai/30 rounded-xl text-[10px] font-bold text-ai uppercase">+ ADICIONAR ATB</button>
            </div>
         </Section>

         {/* 6. SINTOMÁTICOS */}
         <Section title="6. SINTOMÁTICOS" icon={<HeartPulse className="h-4 w-4" />}>
            <div className="flex flex-wrap gap-2 mb-6">
               {SYMPTOMATIC_CHIPS.map(opt => (
                  <Chip key={opt} label={opt} selected={sintomaticos.includes(opt)} onClick={() => setSintomaticos(prev => prev.includes(opt) ? prev.filter(i => i !== opt) : [...prev, opt])} />
               ))}
            </div>
            <EditableList items={sintomaticos} onChange={setSintomaticos} />
         </Section>

         {/* 7. PROFILAXIAS */}
         <Section title="7. PROFILAXIAS" icon={<Check className="h-4 w-4" />}>
            <div className="flex flex-wrap gap-2 mb-6">
               {PROPHYLAXIS_CHIPS.map(opt => (
                  <Chip key={opt} label={opt} selected={profilaxias.includes(opt)} onClick={() => setProfilaxias(prev => prev.includes(opt) ? prev.filter(i => i !== opt) : [...prev, opt])} />
               ))}
            </div>
            <EditableList items={profilaxias} onChange={setProfilaxias} />
         </Section>

         {/* 8. HIDRATAÇÃO */}
         <Section title="8. HIDRATAÇÃO" icon={<Activity className="h-4 w-4" />}>
            <div className="flex items-center gap-4 mb-4">
               <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">ATIVAR:</span>
               <div className="flex bg-secondary rounded-lg p-1">
                  <button onClick={() => setHidratacao({...hidratacao, active: false})} className={`px-4 py-1.5 rounded-md text-[10px] font-bold ${!hidratacao.active ? "bg-primary text-white" : "text-muted-foreground"}`}>NÃO</button>
                  <button onClick={() => setHidratacao({...hidratacao, active: true})} className={`px-4 py-1.5 rounded-md text-[10px] font-bold ${hidratacao.active ? "bg-primary text-white" : "text-muted-foreground"}`}>SIM</button>
               </div>
            </div>
            {hidratacao.active && (
               <div className="grid md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2">
                  <select value={hidratacao.tipo} onChange={e => setHidratacao({...hidratacao, tipo: e.target.value})} className={inputCls}>
                     <option value="">SELECIONE O TIPO</option>
                     <option value="SF 0,9%">SF 0,9%</option>
                     <option value="SG 5%">SG 5%</option>
                     <option value="Ringer Lactato">Ringer Lactato</option>
                  </select>
                  <input value={hidratacao.volume} onChange={e => setHidratacao({...hidratacao, volume: e.target.value})} className={inputCls} placeholder="VOLUME (ML)" />
                  <input value={hidratacao.velocidade} onChange={e => setHidratacao({...hidratacao, velocidade: e.target.value})} className={inputCls} placeholder="VELOCIDADE (ML/H)" />
               </div>
            )}
         </Section>

         {/* 9. EXAMES */}
         <Section title="9. EXAMES SOLICITADOS" icon={<FlaskConical className="h-4 w-4" />}>
            <div className="space-y-3">
               {exames.map((e, idx) => (
                  <div key={idx} className="flex gap-2">
                     <input value={e} onChange={val => setExames(exames.map((item, i) => i === idx ? val.target.value.toUpperCase() : item))} className={inputCls} />
                     <button onClick={() => setExames(exames.filter((_, i) => i !== idx))} className="p-4 rounded-xl bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
               ))}
               <button onClick={() => setExames([...exames, ""])} className="w-full py-4 border-2 border-dashed border-border rounded-xl text-[10px] font-bold text-muted-foreground uppercase">+ ADICIONAR EXAME</button>
            </div>
         </Section>

         {/* 10. PENDÊNCIAS */}
         <Section title="10. PENDÊNCIAS" icon={<AlertTriangle className="h-4 w-4" />}>
            <EditableList items={pendencias} onChange={setPendencias} />
         </Section>

         {/* UTI EXTRAS */}
         {tipoUnidade === "uti" && (
            <>
               <Section title="DROGAS VASOATIVAS" icon={<Wind className="h-4 w-4" />}>
                  <div className="space-y-3">
                     {dvas.map((d, idx) => (
                        <div key={d.id} className="flex gap-2">
                           <input value={d.text} onChange={e => {
                              const next = [...dvas];
                              next[idx].text = e.target.value.toUpperCase();
                              setDvas(next);
                           }} className={inputCls} placeholder="NOME, DOSE, VELOCIDADE..." />
                           <button onClick={() => setDvas(dvas.filter(item => item.id !== d.id))} className="p-4 rounded-xl bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                        </div>
                     ))}
                     <button onClick={() => setDvas([...dvas, { id: Date.now().toString(), text: "" }])} className="w-full py-4 border-2 border-dashed border-border rounded-xl text-[10px] font-bold text-muted-foreground uppercase">+ ADICIONAR DVA</button>
                  </div>
               </Section>
               <Section title="SEDAÇÃO / ANALGESIA" icon={<HeartPulse className="h-4 w-4" />}>
                  <div className="space-y-3">
                     {sedacao.map((s, idx) => (
                        <div key={s.id} className="flex gap-2">
                           <input value={s.text} onChange={e => {
                              const next = [...sedacao];
                              next[idx].text = e.target.value.toUpperCase();
                              setSedacao(next);
                           }} className={inputCls} placeholder="NOME, DOSE, VELOCIDADE..." />
                           <button onClick={() => setSedacao(sedacao.filter(item => item.id !== s.id))} className="p-4 rounded-xl bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                        </div>
                     ))}
                     <button onClick={() => setSedacao([...sedacao, { id: Date.now().toString(), text: "" }])} className="w-full py-4 border-2 border-dashed border-border rounded-xl text-[10px] font-bold text-muted-foreground uppercase">+ ADICIONAR SEDAÇÃO</button>
                  </div>
               </Section>
            </>
         )}

         <div className="pt-12 text-center">
            <button onClick={() => nav({ to: "/dashboard" })} className="text-[10px] font-black text-muted-foreground hover:text-foreground uppercase tracking-[0.2em] transition-all flex items-center gap-2 mx-auto border-b border-transparent hover:border-muted-foreground">
               <ChevronLeft className="h-4 w-4" /> VOLTAR AO DASHBOARD
            </button>
         </div>

      </main>
    </div>
  );
}

function Section({ title, icon, children }: { title: string, icon: any, children: any }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-4 ml-1">
        <div className="h-8 w-8 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
        <h2 className="text-[10px] font-black tracking-[0.2em] uppercase text-foreground">{title}</h2>
      </div>
      <div className="bg-white border border-border rounded-[2rem] p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}

function Chip({ label, selected, onClick }: { label: string, selected: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${selected ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-white text-muted-foreground border-border hover:border-primary/40"}`}
    >
      {label}
    </button>
  );
}

function EditableList({ items, onChange }: { items: string[], onChange: (items: string[]) => void }) {
  return (
     <div className="space-y-2">
        {items.map((item, idx) => (
           <div key={idx} className="flex gap-2">
              <input 
                 value={item} 
                 onChange={e => {
                    const next = [...items];
                    next[idx] = e.target.value.toUpperCase();
                    onChange(next);
                 }} 
                 className={inputCls} 
              />
              <button onClick={() => onChange(items.filter((_, i) => i !== idx))} className="p-4 rounded-xl bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
           </div>
        ))}
     </div>
  );
}

const inputCls = "w-full bg-secondary/30 border border-border rounded-xl px-5 py-4 text-xs font-bold placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white transition-all uppercase";
