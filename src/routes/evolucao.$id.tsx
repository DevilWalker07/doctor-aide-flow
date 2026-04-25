import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, FlaskConical, FileText, Sparkles, Copy, X, Loader2, AlertTriangle, FileUp, ImageIcon, ClipboardPaste, Check, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checklist, type ChecklistItem } from "@/components/evolucao/Checklist";
import { getPatient, savePatient, usePatients, type Patient, type PatientData } from "@/lib/store";
import { ckdEpi2021, ckdStage, hgtStats, abxDay, formatDateBR, pcrTrend } from "@/lib/medical";
import { toast } from "sonner";
import { extractLabWithAI, generateEvolutionWithAI } from "@/lib/aiService";
import { saveEvolution } from "@/lib/store";

export const Route = createFileRoute("/evolucao/$id")({
  component: EvolucaoPage,
  head: () => ({ meta: [{ title: "Evolução Clínica — DOUTOR AJUDA" }] }),
});

const TODAY = "2026-03-28";

function EvolucaoPage() {
  const { id } = useParams({ from: "/evolucao/$id" });
  const [patient, setPatient] = useState<Patient | null>(null);
  const [data, setData] = useState<PatientData>({});
  const [labOpen, setLabOpen] = useState(false);
  const [evolOpen, setEvolOpen] = useState(false);

  useEffect(() => {
    const p = getPatient(id);
    if (p) {
      setPatient(p);
      setData(p.data || {});
    }
  }, [id]);

  function update<K extends keyof PatientData>(key: K, value: PatientData[K]) {
    const next = { ...data, [key]: value };
    setData(next);
    if (patient) savePatient({ ...patient, data: next });
  }
  function patch<K extends keyof PatientData>(key: K, partial: Partial<NonNullable<PatientData[K]>>) {
    const cur = (data[key] || {}) as object;
    update(key, { ...cur, ...partial } as PatientData[K]);
  }

  // Calculations
  const creat = data.lab?.raw?.["Creatinina"] ? parseFloat(data.lab.raw["Creatinina"].replace(",", ".")) : 0;
  const egfr = patient ? ckdEpi2021(creat, patient.age, patient.sex) : 0;
  const stage = egfr ? ckdStage(egfr) : null;
  const abx = data.abx?.[0];
  const abxD = abx ? abxDay(abx.d0, TODAY) : 0;
  const hgtVals = [data.hgt?.h06, data.hgt?.h12, data.hgt?.h18, data.hgt?.h00];
  const hgt = hgtStats(hgtVals);
  const trend = pcrTrend(data.pcrHist || []);

  const checklist: ChecklistItem[] = useMemo(() => [
    { id: "ident", label: "IDENTIFICAÇÃO", status: patient?.name ? "done" : "pending" },
    { id: "vit", label: "SINAIS VITAIS", status: data.vitals?.pas ? "done" : "pending" },
    { id: "stat", label: "STATUS CLÍNICO", status: data.status?.geral ? "done" : "pending" },
    { id: "resp", label: "RESPIRATÓRIO", status: data.resp?.padrao ? "done" : "pending" },
    { id: "dig", label: "DIGESTIVO", status: data.digest?.tolerancia ? "done" : "pending" },
    { id: "diur", label: "DIURESE", status: data.diurese?.padrao ? "done" : "pending" },
    { id: "lab", label: "LABORATÓRIO", status: data.lab ? (stage?.warn ? "warn" : "done") : "pending" },
    { id: "atb", label: "ANTIBIÓTICOS", status: abx ? "done" : "pending" },
    { id: "exam", label: "EXAME FÍSICO", status: data.exam?.ect ? "done" : "pending" },
    { id: "cond", label: "CONDUTAS", status: data.conducta?.dx ? "done" : "pending" },
    { id: "pend", label: "PENDÊNCIAS / INTERCORRÊNCIAS", status: data.conducta?.pendencias ? "done" : "pending" },
  ], [patient, data, stage, abx]);

  if (!patient) {
    return (
      <div className="min-h-screen bg-background grid place-items-center">
        <div className="text-center">
          <p className="text-muted-foreground">Paciente não encontrado.</p>
          <Link to="/dashboard" className="mt-4 inline-block text-primary text-sm font-bold uppercase tracking-wide">VOLTAR AO DASHBOARD</Link>
        </div>
      </div>
    );
  }

  const previa = buildPrevia(patient, data, hgt, stage, egfr, abxD);

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <header className="bg-background/90 backdrop-blur-xl border-b border-border sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1500px] mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5"/>
          </Link>
          <Badge variant="navy" size="xl" className="font-mono shadow-sm">{patient.bed}</Badge>
          <div className="min-w-0">
            <h1 className="font-extrabold text-lg tracking-tight truncate leading-tight">{patient.name}</h1>
            <p className="text-xs font-medium text-muted-foreground tracking-wide mt-0.5">{patient.age}A · {patient.sex === "F" ? "FEMININO" : "MASCULINO"} · {patient.sector}</p>
          </div>

          <div className="flex items-center gap-2 ml-2 flex-wrap">
            {stage && <Badge variant={stage.warn ? "destructive" : "soft"}>TFGe {egfr} · {stage.stage}</Badge>}
            {abx && <Badge variant="ai">ATB D{abxD}/{abx.durDays}</Badge>}
            {trend === "rebound" && <Badge variant="destructive">PCR REASCENDENTE</Badge>}
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            <button onClick={() => {
              if (patient) {
                savePatient(patient);
                toast.success("Sincronizado com sucesso!");
              }
            }} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-[11px] font-bold uppercase tracking-widest hover:bg-secondary hover:border-border transition-all"><RefreshCw className="h-3.5 w-3.5"/> <span className="hidden sm:inline">SINCRONIZAR</span></button>
            <button onClick={() => setLabOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-ai text-ai-foreground text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-ai/20 hover:shadow-ai/40 hover:-translate-y-0.5 transition-all"><FlaskConical className="h-3.5 w-3.5"/> <span className="hidden sm:inline">IMPORTAR LAB</span></button>
            <button onClick={() => setEvolOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"><FileText className="h-3.5 w-3.5"/> <span className="hidden sm:inline">GERAR EVOLUÇÃO</span></button>
          </div>
        </div>
      </header>

      <div className="max-w-[1500px] mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[280px_1fr_360px] gap-6">
        {/* Sidebar */}
        <div><Checklist items={checklist} /></div>

        {/* Center column */}
        <div className="space-y-5">
          <SectionCard title="SINAIS VITAIS" icon="❤️">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                ["PAS", "pas", "mmHg"], ["PAD", "pad", "mmHg"], ["FC", "fc", "bpm"],
                ["FR", "fr", "irpm"], ["SpO₂", "spo2", "%"], ["TEMP", "temp", "°C"],
              ].map(([l, k, u]) => (
                <SmallInput key={k} label={l} unit={u} value={(data.vitals as any)?.[k]} onChange={(v) => patch("vitals", { [k]: v } as any)} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <SmallInput label="PAS MÍN 24H" unit="mmHg" value={data.vitals?.pasMin} onChange={(v) => patch("vitals", { pasMin: v })} />
              <SmallInput label="PAS MÁX 24H" unit="mmHg" value={data.vitals?.pasMax} onChange={(v) => patch("vitals", { pasMax: v })} />
            </div>
          </SectionCard>

          <SectionCard title="HGT — CURVA GLICÊMICA" icon="🩸"
            extra={<>
              {hgt.peak > 180 && <Badge variant="destructive">HIPERGLICEMIA</Badge>}
              {hgt.nadir < 70 && hgt.nadir > 0 && <Badge variant="warning">HIPOGLICEMIA</Badge>}
            </>}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[["06H", "h06"], ["12H", "h12"], ["18H", "h18"], ["00H", "h00"]].map(([l, k]) => (
                <SmallInput key={k} label={l} unit="mg/dL" value={(data.hgt as any)?.[k]} onChange={(v) => patch("hgt", { [k]: v } as any)} />
              ))}
            </div>
            {hgt.count > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-3">
                <Stat label="MÉDIA" value={`${hgt.mean}`} />
                <Stat label="PICO" value={`${hgt.peak}`} tone={hgt.peak > 180 ? "danger" : undefined} />
                <Stat label="NADIR" value={`${hgt.nadir}`} tone={hgt.nadir < 70 ? "warn" : undefined} />
              </div>
            )}
          </SectionCard>

          <SectionCard title="STATUS CLÍNICO" icon="📋">
            <Seg label="ESTADO GERAL" value={data.status?.geral} options={["BEG", "REG", "MEG"]} onChange={(v) => patch("status", { geral: v })} />
            <Seg label="CLÍNICA" value={data.status?.clinica} options={["ESTÁVEL", "INSTÁVEL"]} onChange={(v) => patch("status", { clinica: v })} />
            <Seg label="HEMODINÂMICA" value={data.status?.hemo} options={["ESTÁVEL", "INSTÁVEL", "EM USO DE DVA"]} onChange={(v) => patch("status", { hemo: v })} />
            <Seg label="CONSCIÊNCIA" value={data.status?.consc} options={["ORIENTADO", "DESORIENTADO", "REBAIXADO"]} onChange={(v) => patch("status", { consc: v })} />
            {data.status?.consc === "REBAIXADO" && (
              <SmallInput label="GLASGOW" unit="" value={data.status?.glasgow} onChange={(v) => patch("status", { glasgow: v })} />
            )}
          </SectionCard>

          <SectionCard title="RESPIRATÓRIO" icon="🫁">
            <Seg label="PADRÃO" value={data.resp?.padrao} options={["EUPNEICO", "DISPNEICO", "TAQUIPNEICO"]} onChange={(v) => patch("resp", { padrao: v })} />
            <Seg label="SUPORTE" value={data.resp?.suporte} options={["AR AMBIENTE", "CATETER O2", "MÁSCARA SIMPLES", "MÁSCARA RESERVATÓRIO", "VNI", "VM"]} onChange={(v) => patch("resp", { suporte: v })} />
            {data.resp?.suporte && data.resp.suporte !== "AR AMBIENTE" && data.resp.suporte !== "VM" && (
              <SmallInput label="FLUXO O₂" unit="L/min" value={data.resp?.o2} onChange={(v) => patch("resp", { o2: v })} />
            )}
            {data.resp?.suporte === "VM" && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SmallInput label="MODO" unit="" value={data.resp?.modo as any} onChange={(v) => patch("resp", { modo: String(v) })} />
                <SmallInput label="FiO₂" unit="%" value={data.resp?.fio2} onChange={(v) => patch("resp", { fio2: v })} />
                <SmallInput label="PEEP" unit="cmH₂O" value={data.resp?.peep} onChange={(v) => patch("resp", { peep: v })} />
                <SmallInput label="FR" unit="irpm" value={data.resp?.vmFr} onChange={(v) => patch("resp", { vmFr: v })} />
              </div>
            )}
          </SectionCard>

          <SectionCard title="DIGESTIVO" icon="🍽️">
            <Seg label="TOLERÂNCIA À DIETA" value={data.digest?.tolerancia} options={["BOA", "PARCIAL", "NÃO TOLERA"]} onChange={(v) => patch("digest", { tolerancia: v })} />
            <Seg label="TIPO" value={data.digest?.tipo} options={["ORAL", "SNE", "GTT", "NPT", "JEJUM"]} onChange={(v) => patch("digest", { tipo: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Toggle label="NÁUSEAS" value={!!data.digest?.nauseas} onChange={(v) => patch("digest", { nauseas: v })} />
              <Toggle label="VÔMITOS" value={!!data.digest?.vomitos} onChange={(v) => patch("digest", { vomitos: v })} />
            </div>
            <Seg label="DEJEÇÕES" value={data.digest?.dejecoes} options={["PRESENTES", "AUSENTES", "DIARREICAS", "MELENA", "ENTERORRAGIA"]} onChange={(v) => patch("digest", { dejecoes: v })} />
            <Seg label="ABDOME" value={data.digest?.abdome} options={["PLANO", "FLÁCIDO", "DISTENDIDO", "DOLOROSO"]} onChange={(v) => patch("digest", { abdome: v })} />
          </SectionCard>

          <SectionCard title="DIURESE" icon="💧">
            <Seg label="PADRÃO" value={data.diurese?.padrao} options={["PRESENTE", "OLIGÚRIA", "ANÚRIA"]} onChange={(v) => patch("diurese", { padrao: v })} />
            <Seg label="VIA" value={data.diurese?.via} options={["ESPONTÂNEA", "SVD", "FRALDA", "CISTOSTOMIA"]} onChange={(v) => patch("diurese", { via: v })} />
            <div className="grid grid-cols-2 gap-3">
              <SmallInput label="DÉBITO" unit="mL/24h" value={data.diurese?.debito} onChange={(v) => patch("diurese", { debito: v })} />
              <SmallInput label="BALANÇO" unit="mL" value={data.diurese?.bhValor} onChange={(v) => patch("diurese", { bhValor: v })} />
            </div>
          </SectionCard>

          <SectionCard title="ANTIBIÓTICOS" icon="💊">
            {abx ? (
              <div className="rounded-xl border border-ai/30 bg-ai/5 p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm uppercase tracking-tight">{abx.name} {abx.dose} {abx.via} {abx.freq}</div>
                  <div className="text-xs text-muted-foreground mt-1">D0: {formatDateBR(abx.d0)} · DURAÇÃO {abx.durDays} DIAS</div>
                </div>
                <Badge variant="ai" size="lg">D{abxD}/{abx.durDays}</Badge>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">Nenhum antibiótico cadastrado</div>
            )}
          </SectionCard>

          <SectionCard title="LABORATÓRIO" icon="🧪"
            extra={<button onClick={() => setLabOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ai text-ai-foreground text-[11px] font-bold uppercase tracking-wide"><Sparkles className="h-3 w-3"/> IMPORTAR COM IA</button>}>
            {data.lab ? (
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-tight text-muted-foreground">DATA: {data.lab.date}</div>
                <pre className="whitespace-pre-wrap text-xs leading-relaxed bg-input-bg border border-border rounded-lg p-3 font-mono">{data.lab.formatted}</pre>
                {stage?.warn && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 flex gap-2 text-xs">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0"/>
                    <span><b>ATENÇÃO RENAL:</b> AJUSTAR DOSE DE MEDICAMENTOS COM EXCREÇÃO RENAL. TFGe {egfr} mL/min/1,73m² · {stage.stage}.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <FlaskConical className="h-8 w-8 mx-auto text-muted-foreground mb-2"/>
                <p className="text-sm text-muted-foreground">Nenhum laboratório importado</p>
                <button onClick={() => setLabOpen(true)} className="mt-3 px-4 py-2 rounded-lg bg-ai text-ai-foreground text-xs font-bold uppercase tracking-wide">IMPORTAR AGORA</button>
              </div>
            )}
          </SectionCard>

          <SectionCard title="EXAME FÍSICO" icon="🩺"
            extra={<button onClick={() => update("exam", DEFAULT_EXAM)} className="px-3 py-1.5 rounded-md border border-border text-[11px] font-bold uppercase tracking-wide hover:bg-secondary">EXAME FÍSICO PADRÃO</button>}>
            {(["ect", "acv", "ar", "abd", "ext"] as const).map((k) => (
              <div key={k}>
                <label className="label-tech block mb-1.5">{k.toUpperCase()}</label>
                <textarea
                  value={(data.exam as any)?.[k] || ""}
                  onChange={(e) => patch("exam", { [k]: e.target.value.toUpperCase() } as any)}
                  rows={2}
                  className="w-full bg-input-bg border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            ))}
          </SectionCard>

          <SectionCard title="CONDUTAS, PENDÊNCIAS, INTERCORRÊNCIAS" icon="✅">
            <div className="flex flex-wrap gap-1.5">
              {["SEM QUEIXAS", "SEM INTERCORRÊNCIAS", "SEM PENDÊNCIAS", "DIURESE FISIOLÓGICA", "DEJEÇÕES FISIOLÓGICAS", "AR AMBIENTE", "HEMODINAMICAMENTE ESTÁVEL"].map((q) => (
                <button key={q} onClick={() => {
                  const cur = data.conducta?.condutas || "";
                  patch("conducta", { condutas: (cur ? cur + ". " : "") + q });
                }} className="px-2.5 py-1 rounded-md border border-border text-[10px] font-bold uppercase tracking-wide hover:bg-secondary hover:border-primary/40">+ {q}</button>
              ))}
            </div>
            {(["dx", "condutas", "pendencias", "intercorrencias"] as const).map((k, i) => (
              <div key={k}>
                <label className="label-tech block mb-1.5">{["IMPRESSÃO DIAGNÓSTICA", "CONDUTAS", "PENDÊNCIAS", "INTERCORRÊNCIAS"][i]}</label>
                <textarea
                  value={(data.conducta as any)?.[k] || ""}
                  onChange={(e) => patch("conducta", { [k]: e.target.value.toUpperCase() } as any)}
                  rows={2}
                  className="w-full bg-input-bg border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            ))}
          </SectionCard>
        </div>

        {/* Right column: previa */}
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-[2rem] p-6 md:p-8 sticky top-24 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-navy">PRÉVIA DA EVOLUÇÃO</h3>
              <Badge variant="soft" className="animate-pulse">AO VIVO</Badge>
            </div>
            <div className="rounded-2xl bg-input-bg border border-border p-5 max-h-[55vh] overflow-y-auto custom-scrollbar">
              <p className="text-xs leading-relaxed font-medium whitespace-pre-wrap text-foreground/80">{previa}</p>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(previa); toast.success("Prévia copiada"); }}
              className="w-full mt-4 py-3.5 rounded-xl border-2 border-dashed border-ai/40 bg-ai/5 text-ai text-[11px] font-bold uppercase tracking-widest hover:border-ai hover:bg-ai/10 transition-all flex items-center justify-center gap-2">
              <FlaskConical className="h-4 w-4" /> COLAR TEXTO LIVRE E IMPORTAR COM IA
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-xl border-t border-border z-30 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
        <div className="max-w-[1500px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground tracking-wide">
            CHECKLIST: <b className="text-foreground">{checklist.filter(c => c.status === "done").length}/{checklist.length}</b> COMPLETO
          </div>
          <button onClick={() => setEvolOpen(true)} className="group inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-navy text-navy-foreground font-bold uppercase tracking-widest hover:shadow-2xl hover:shadow-navy/30 hover:-translate-y-0.5 transition-all duration-300">
            <Sparkles className="h-4 w-4 text-warning group-hover:rotate-12 transition-transform duration-300"/> EVOLUÇÃO PADRÃO-OURO
          </button>
        </div>
      </div>

      {labOpen && <LabModal onClose={() => setLabOpen(false)} onUse={(lab) => {
        update("lab", lab);
        toast.success("Laboratório importado e formatado");
        setLabOpen(false);
      }} 
      patientContext={{ age: patient?.age, sex: patient?.sex }} 
    />}

      <EvolutionModal 
        open={evolOpen} 
        close={() => setEvolOpen(false)} 
        content={previa} 
        pId={patient?.id || ""} 
      />
    </div>
  );
}

const DEFAULT_EXAM = {
  ect: "BEG, CORADA, HIDRATADA, ACIANÓTICA, ANICTÉRICA.",
  acv: "RCR 2T, BULHAS NORMOFONÉTICAS, SEM SOPROS.",
  ar: "MV+ BILATERALMENTE, SEM RUÍDOS ADVENTÍCIOS.",
  abd: "PLANO, FLÁCIDO, RHA+, INDOLOR À PALPAÇÃO.",
  ext: "SEM EDEMAS, PANTURRILHAS LIVRES.",
};

function SectionCard({ title, icon, extra, children }: { title: string; icon?: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-border rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
      <header className="px-6 py-4 border-b border-border flex items-center justify-between bg-secondary/30">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-navy">{icon && <span className="mr-2 text-base">{icon}</span>}{title}</h3>
        <div className="flex items-center gap-2">{extra}</div>
      </header>
      <div className="p-6 space-y-5">{children}</div>
    </section>
  );
}

function SmallInput({ label, unit, value, onChange }: { label: string; unit: string; value?: number | string; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="label-tech block mb-1.5 ml-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? (undefined as any) : Number(e.target.value))}
          className="w-full bg-input-bg border border-border rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all pr-12"
        />
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-widest text-muted-foreground font-medium">{unit}</span>}
      </div>
    </div>
  );
}

function Seg({ label, value, options, onChange }: { label: string; value?: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label-tech block mb-2 ml-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 bg-input-bg border border-border rounded-xl p-1.5">
        {options.map((o) => (
          <button key={o} onClick={() => onChange(o)}
            className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all ${value === o ? "bg-white text-primary shadow-sm ring-1 ring-border scale-100" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 scale-95 hover:scale-100"}`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between bg-input-bg border border-border rounded-xl px-4 py-2.5">
      <span className="label-tech font-bold">{label}</span>
      <div className="flex bg-white border border-border rounded-lg p-1 shadow-sm">
        <button onClick={() => onChange(false)} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${!value ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>NÃO</button>
        <button onClick={() => onChange(true)} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}>SIM</button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" | "danger" }) {
  const cls = tone === "danger" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-xl bg-input-bg border border-border p-4 text-center">
      <div className="label-tech font-bold">{label}</div>
      <div className={`text-3xl font-extrabold mt-1.5 tracking-tight ${cls}`}>{value}</div>
    </div>
  );
}

function buildPrevia(p: Patient, d: PatientData, hgt: ReturnType<typeof hgtStats>, stage: ReturnType<typeof ckdStage> | null, egfr: number, abxD: number): string {
  const parts: string[] = [];
  parts.push(`PACIENTE EM LEITO ${p.bed} — ${p.sector}`);
  if (d.status?.geral) parts.push(`EVOLUI EM ${d.status.geral}`);
  if (d.status?.clinica && d.status?.hemo) parts.push(`${d.status.clinica === "ESTÁVEL" ? "CLÍNICA E HEMODINAMICAMENTE" : "CLÍNICA"} ${d.status.hemo}`);
  if (d.resp?.padrao && d.resp?.suporte) parts.push(`${d.resp.padrao} EM ${d.resp.suporte}${d.resp.o2 ? ` ${d.resp.o2}L/MIN` : ""}`);
  if (d.digest?.tolerancia) parts.push(`TOLERANDO DIETA ${d.digest.tipo || ""} (${d.digest.tolerancia})`);
  if (d.digest?.nauseas !== undefined) parts.push(`${d.digest.nauseas ? "REFERE" : "NEGA"} NÁUSEAS`);
  if (d.digest?.vomitos !== undefined) parts.push(`${d.digest.vomitos ? "REFERE" : "NEGA"} VÔMITOS`);
  if (d.diurese?.padrao) parts.push(`DIURESE ${d.diurese.padrao}${d.diurese.via ? `, ${d.diurese.via}` : ""}`);
  if (d.digest?.dejecoes) parts.push(`DEJEÇÕES ${d.digest.dejecoes}`);
  if (hgt.count > 0) parts.push(`CURVA HGT: ${[d.hgt?.h06, d.hgt?.h12, d.hgt?.h18, d.hgt?.h00].filter(Boolean).join("-")} MG/DL — MÉDIA ${hgt.mean} / PICO ${hgt.peak} / NADIR ${hgt.nadir}`);
  if (d.abx?.[0]) parts.push(`ANTIBIÓTICO: ${d.abx[0].name} D${abxD}/${d.abx[0].durDays}`);
  if (stage) parts.push(`TFGe ${egfr} ML/MIN/1,73M² — ${stage.stage}`);
  return parts.join(". ") + ".";
}

// ---------------- LAB MODAL ----------------

function LabModal({ onClose, onUse, patientContext }: { onClose: () => void; onUse: (lab: PatientData["lab"]) => void; patientContext: any }) {
  const [tab, setTab] = useState<"text" | "pdf" | "img">("text");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<PatientData["lab"] | null>(null);

  async function process() {
    setLoading(true);
    setStep(0);
    const progressInterval = setInterval(() => {
      setStep(s => s < 3 ? s + 1 : s);
    }, 1500);

    try {
      const resultData = await extractLabWithAI(text, patientContext);
      clearInterval(progressInterval);
      setStep(4);
      setResult({
        date: resultData.data_exame || new Date().toLocaleDateString('pt-BR'),
        raw: resultData.valores || {},
        formatted: resultData.texto_formatado || "",
      });
    } catch (e) {
      clearInterval(progressInterval);
      toast.error("Falha ao usar IA. Verifique conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-navy/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-[2rem] shadow-2xl shadow-navy/30 w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        <header className="px-8 py-6 border-b border-border flex items-center justify-between bg-ai text-ai-foreground">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">IMPORTAÇÃO INTELIGENTE</h2>
              <p className="text-xs font-bold uppercase tracking-widest opacity-80 mt-1">ESTRUTURAÇÃO AUTOMÁTICA DE LABORATÓRIO</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"><X className="h-5 w-5 text-white"/></button>
        </header>

        <div className="flex-1 overflow-y-auto bg-input-bg p-8 custom-scrollbar">
          {!result && !loading && (
            <div className="bg-white border border-border shadow-sm rounded-2xl p-8">
              <p className="text-sm font-medium text-muted-foreground leading-relaxed mb-6">
                Cole abaixo o resultado do laboratório (qualquer formato, sujo, de outro sistema ou com texto misturado). A IA irá limpar e estruturar no padrão Doutor Ajuda para a evolução médica.
              </p>
              <textarea
                className="w-full h-48 bg-input-bg border border-border rounded-2xl p-5 text-sm focus:outline-none focus:ring-2 focus:ring-ai/40 focus:border-ai/40 leading-relaxed transition-all resize-none"
                placeholder="Ex: Hgb 12.5 ht 38 leuco 12000 plaq 250k..."
                value={text} onChange={(e) => setText(e.target.value)}
              />
              <div className="mt-6 flex justify-end">
                <button onClick={process} disabled={!text.trim()} className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-ai text-ai-foreground text-[11px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 shadow-xl shadow-ai/20 hover:-translate-y-0.5 transition-all">
                  <Sparkles className="h-4 w-4" /> PROCESSAR LABORATÓRIO
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="p-16 text-center">
              <RefreshCw className="h-12 w-12 mx-auto text-ai animate-spin mb-8" />
              <ul className="space-y-4 max-w-sm mx-auto text-left bg-white border border-border shadow-sm p-8 rounded-2xl">
                {STEPS.map((s, idx) => (
                  <li key={s} className={`flex items-center gap-3 text-xs font-bold uppercase tracking-widest transition-opacity duration-300 ${idx <= step ? "opacity-100" : "opacity-30"}`}>
                    {idx < step ? <Check className="h-5 w-5 text-success" /> : idx === step ? <RefreshCw className="h-5 w-5 animate-spin text-ai" /> : <div className="h-5 w-5 rounded-full border-2 border-border" />}
                    <span className={idx === step ? "text-ai" : "text-foreground"}>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              <div className="bg-white border border-border shadow-sm rounded-2xl p-8">
                <div className="flex items-center justify-between mb-4">
                  <span className="label-tech text-ai">DADOS ESTRUTURADOS COM SUCESSO</span>
                  <Badge variant="ai">DATA: {result.date}</Badge>
                </div>
                <div className="bg-input-bg border border-border rounded-xl p-6">
                  <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed text-foreground/90">{result.formatted}</pre>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setResult(null)} className="px-6 py-4 rounded-xl border-2 border-border text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:bg-secondary transition-all">EDITAR RESULTADO</button>
                <button onClick={() => { onUse(result); onClose(); }} className="px-8 py-4 rounded-xl bg-success text-success-foreground text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-success/20 hover:shadow-success/40 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                  <Check className="h-4 w-4" /> USAR NA EVOLUÇÃO
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- EVOLUTION MODAL ----------------

function EvolutionModal({ open, close, content, pId }: { open: boolean; close: () => void; content: string; pId: string }) {
  const [copied, setCopied] = useState(false);
  const [finalContent, setFinalContent] = useState(content);
  const [generating, setGenerating] = useState(false);
  const { updatePatient, patients } = usePatients();

  // Effect to load AI content when modal opens
  useEffect(() => {
    if (open) {
      const pat = patients.find(p => p.id === pId);
      if (pat) {
        setGenerating(true);
        generateEvolutionWithAI(pat.data || {})
          .then(res => setFinalContent(res))
          .catch(e => {
            console.error("Usando fallback de template local", e);
            setFinalContent(content); // Fallback to local template
          })
          .finally(() => setGenerating(false));
      } else {
        setFinalContent(content);
      }
    }
  }, [open, pId, content, patients]);

  if (!open) return null;

  async function finish() {
    await saveEvolution(pId, finalContent);
    await updatePatient(pId, { status: "EVOLUÇÃO GERADA" });
    close();
  }

  function copy() {
    navigator.clipboard.writeText(finalContent);
    setCopied(true);
    toast.success("Evolução copiada com sucesso");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-navy/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[2rem] shadow-2xl shadow-primary/20 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        <header className="px-8 py-6 border-b border-border flex items-center justify-between bg-primary text-primary-foreground">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">EVOLUÇÃO MÉDICA PRONTA</h2>
              <p className="text-xs font-bold uppercase tracking-widest opacity-80 mt-1">REVISE E COPIE PARA O PRONTUÁRIO OFICIAL</p>
            </div>
          </div>
          <button onClick={close} className="h-8 w-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"><X className="h-5 w-5 text-white"/></button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-input-bg custom-scrollbar relative">
          <div className="absolute inset-0 pointer-events-none flex justify-center items-center opacity-[0.02]">
            <Stethoscope className="w-96 h-96" />
          </div>
          <div className="bg-white border border-border shadow-sm rounded-2xl p-8 relative z-10 min-h-[300px]">
            {generating ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-12">
                <RefreshCw className="h-10 w-10 text-primary animate-spin" />
                <p className="font-bold text-sm tracking-widest text-primary uppercase">MÉDICO VIRTUAL TRABALHANDO...</p>
                <p className="text-xs text-muted-foreground max-w-xs">A IA está estruturando o texto no padrão ouro. Isso pode levar alguns segundos.</p>
              </div>
            ) : (
              <pre className="text-[13px] font-mono leading-relaxed whitespace-pre-wrap text-foreground/90">{finalContent}</pre>
            )}
          </div>
        </div>

        <footer className="px-8 py-6 border-t border-border bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center sm:text-left">
            CERTIFIQUE-SE DE CHECAR OS DADOS ANTES DE ASSINAR.
          </p>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={copy} disabled={generating} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border-2 border-border font-bold uppercase tracking-widest text-[11px] hover:bg-secondary hover:border-primary/40 disabled:opacity-50 transition-all">
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              {copied ? "COPIADO" : "COPIAR TEXTO"}
            </button>
            <button onClick={finish} disabled={generating} className="flex-1 sm:flex-none px-8 py-4 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-widest text-[11px] shadow-xl shadow-primary/20 hover:shadow-primary/40 disabled:opacity-50 transition-all">
              FINALIZAR ATENDIMENTO
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function buildEvolution({ patient, data, egfr, stage, abx, abxD, trend, previa }: any): string {
  const lines: string[] = [];
  lines.push("EVOLUÇÃO MÉDICA");
  lines.push("");
  lines.push("#LISTA DE PROBLEMAS:");
  lines.push("");
  lines.push("[ATIVOS]");
  lines.push("1. PÉ DIABÉTICO INFECTADO");
  lines.push("2. NEUROARTROPATIA DE CHARCOT");
  lines.push("3. DAOP");
  lines.push("4. HAS");
  lines.push("5. DM2");
  lines.push("");
  lines.push("[RESOLVIDOS]");
  lines.push("1. ITU TRATADA");
  lines.push("");
  lines.push("MEDICAÇÕES EM USO:");
  lines.push(`- ANTIBIÓTICO: ${abx ? `${abx.name} ${abx.dose} ${abx.via} ${abx.freq} - D${abxD}/${abx.durDays} - D0: ${formatDateBR(abx.d0)}` : "NÃO REFERIDO"}`);
  lines.push("- SINTOMÁTICOS: NÃO REFERIDO");
  lines.push("- PROFILAXIAS: NÃO REFERIDO");
  lines.push("- USO CONTÍNUO: NÃO REFERIDO");
  lines.push("- SE NECESSÁRIO: NÃO REFERIDO");
  lines.push("");
  lines.push("#ADMISSÃO / HISTÓRIA DA DOENÇA ATUAL:");
  lines.push(patient.hda || "NÃO REFERIDO.");
  lines.push("");
  lines.push("#ANTECEDENTES PATOLÓGICOS:");
  lines.push("HAS, DM2, DAOP.");
  lines.push("");
  lines.push("#MEDICAÇÕES DE USO CONTÍNUO:");
  lines.push("NÃO REFERIDO.");
  lines.push("");
  lines.push("#EVOLUÇÃO DIÁRIA:");
  lines.push(previa);
  lines.push("");
  lines.push("#EXAME FÍSICO:");
  lines.push(`ECT: ${data.exam?.ect || ""}`);
  lines.push(`ACV: ${data.exam?.acv || ""}`);
  lines.push(`AR: ${data.exam?.ar || ""}`);
  lines.push(`ABD: ${data.exam?.abd || ""}`);
  lines.push(`EXT: ${data.exam?.ext || ""}`);
  lines.push("");
  lines.push("#EXAMES COMPLEMENTARES:");
  lines.push("");
  lines.push("* LABORATÓRIO");
  lines.push(data.lab?.formatted || "NÃO REFERIDO.");
  lines.push("");
  lines.push("ANÁLISE:");
  if (trend === "rebound") lines.push("PCR COM REASCENSÃO APÓS NORMALIZAÇÃO, SUGESTIVO DE NOVO FOCO INFECCIOSO OU FALHA TERAPÊUTICA, CORRELACIONAR COM CLÍNICA.");
  if (stage) lines.push(`TFGe (CKD-EPI 2021): ${egfr} ML/MIN/1,73M² — ESTÁDIO ${stage.stage} — ${stage.label}.`);
  lines.push("");
  lines.push("* EXAMES DE IMAGEM");
  lines.push("NÃO REFERIDO.");
  lines.push("");
  lines.push("#AVALIAÇÃO DE ESPECIALIDADE:");
  lines.push("NÃO REFERIDO.");
  lines.push("");
  lines.push("#IMPRESSÃO DIAGNÓSTICA:");
  lines.push(data.conducta?.dx || "1. PÉ DIABÉTICO INFECTADO EM TRATAMENTO.\n2. DM2.\n3. HAS.\n4. DAOP.");
  lines.push("");
  lines.push("CONDUTAS:");
  lines.push(data.conducta?.condutas || "MANTER CONDUTAS.");
  lines.push("");
  lines.push("PENDÊNCIAS:");
  lines.push(data.conducta?.pendencias || "SEM PENDÊNCIAS NO MOMENTO.");
  lines.push("");
  lines.push("INTERCORRÊNCIAS:");
  lines.push(data.conducta?.intercorrencias || "SEM INTERCORRÊNCIAS.");
  return lines.join("\n").toUpperCase();
}
