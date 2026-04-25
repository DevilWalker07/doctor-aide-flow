import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, FlaskConical, FileText, Sparkles, Copy, X, Loader2, AlertTriangle, FileUp, ImageIcon, ClipboardPaste, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checklist, type ChecklistItem } from "@/components/evolucao/Checklist";
import { getPatient, savePatient, type Patient, type PatientData } from "@/lib/store";
import { ckdEpi2021, ckdStage, hgtStats, abxDay, formatDateBR, pcrTrend } from "@/lib/medical";
import { toast } from "sonner";
import { extractLabWithAI, generateEvolutionWithAI, saveLabExam, saveEvolution, persistPatient } from "@/lib/aiService";

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
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-[1500px] mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5"/>
          </Link>
          <Badge variant="navy" size="xl" className="font-mono">{patient.bed}</Badge>
          <div className="min-w-0">
            <h1 className="font-extrabold text-base truncate">{patient.name}</h1>
            <p className="text-xs text-muted-foreground">{patient.age}A · {patient.sex === "F" ? "FEMININO" : "MASCULINO"} · {patient.sector}</p>
          </div>

          <div className="flex items-center gap-1.5 ml-2 flex-wrap">
            {stage && <Badge variant={stage.warn ? "destructive" : "soft"}>TFGe {egfr} · {stage.stage}</Badge>}
            {abx && <Badge variant="ai">ATB D{abxD}/{abx.durDays}</Badge>}
            {trend === "rebound" && <Badge variant="destructive">PCR REASCENDENTE</Badge>}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-bold uppercase tracking-wide hover:bg-secondary"><RefreshCw className="h-3.5 w-3.5"/> SINCRONIZAR</button>
            <button onClick={() => setLabOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-ai text-ai-foreground text-xs font-bold uppercase tracking-wide hover:opacity-90"><FlaskConical className="h-3.5 w-3.5"/> IMPORTAR LAB</button>
            <button onClick={() => setEvolOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wide hover:bg-primary/90"><FileText className="h-3.5 w-3.5"/> GERAR EVOLUÇÃO</button>
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
          <div className="bg-card border border-border rounded-2xl p-5 sticky top-24">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest">PRÉVIA DA EVOLUÇÃO</h3>
              <Badge variant="soft">AO VIVO</Badge>
            </div>
            <div className="rounded-lg bg-input-bg border border-border p-4 max-h-[60vh] overflow-y-auto">
              <p className="text-xs leading-relaxed whitespace-pre-wrap">{previa}</p>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(previa); toast.success("Prévia copiada"); }}
              className="w-full mt-3 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-xs font-bold uppercase tracking-wide hover:bg-secondary">
              <Copy className="h-3.5 w-3.5"/> COPIAR PRÉVIA
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-30">
        <div className="max-w-[1500px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            CHECKLIST: <b className="text-foreground">{checklist.filter(c => c.status === "done").length}/{checklist.length}</b> COMPLETO
          </div>
          <button onClick={() => setEvolOpen(true)} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-navy text-navy-foreground font-bold uppercase tracking-wide hover:opacity-90 shadow-lg shadow-navy/20">
            <Sparkles className="h-4 w-4"/> EVOLUÇÃO PADRÃO-OURO
          </button>
        </div>
      </div>

      {labOpen && <LabModal onClose={() => setLabOpen(false)} onUse={(lab) => {
        update("lab", lab);
        toast.success("Laboratório importado e formatado");
        setLabOpen(false);
      }} />}

      {evolOpen && <EvolutionModal patient={patient} data={data} egfr={egfr} stage={stage} abx={abx} abxD={abxD} hgt={hgt} trend={trend} previa={previa} onClose={() => {
        setEvolOpen(false);
        if (patient) savePatient({ ...patient, status: "EVOLUÇÃO GERADA", data });
        toast.success("Evolução gerada");
      }} />}
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
    <section className="bg-card border border-border rounded-2xl overflow-hidden">
      <header className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-secondary/30">
        <h3 className="text-xs font-bold uppercase tracking-widest">{icon && <span className="mr-2">{icon}</span>}{title}</h3>
        <div className="flex items-center gap-2">{extra}</div>
      </header>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  );
}

function SmallInput({ label, unit, value, onChange }: { label: string; unit: string; value?: number | string; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="label-tech block mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? (undefined as any) : Number(e.target.value))}
          className="w-full bg-input-bg border border-border rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 pr-10"
        />
        {unit && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wide text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function Seg({ label, value, options, onChange }: { label: string; value?: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label-tech block mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 bg-input-bg border border-border rounded-lg p-1">
        {options.map((o) => (
          <button key={o} onClick={() => onChange(o)}
            className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wide transition-colors ${value === o ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between bg-input-bg border border-border rounded-lg px-3 py-2">
      <span className="label-tech">{label}</span>
      <div className="flex bg-card border border-border rounded-md p-0.5">
        <button onClick={() => onChange(false)} className={`px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase ${!value ? "bg-secondary" : ""}`}>NÃO</button>
        <button onClick={() => onChange(true)} className={`px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase ${value ? "bg-primary text-primary-foreground" : ""}`}>SIM</button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" | "danger" }) {
  const cls = tone === "danger" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-lg bg-input-bg border border-border p-3 text-center">
      <div className="label-tech">{label}</div>
      <div className={`text-2xl font-extrabold mt-1 ${cls}`}>{value}</div>
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

function LabModal({ onClose, onUse, patient }: { onClose: () => void; onUse: (lab: PatientData["lab"]) => void; patient: Patient }) {
  const [tab, setTab] = useState<"text" | "pdf" | "img">("text");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<PatientData["lab"] | null>(null);
  const [aiPayload, setAiPayload] = useState<any>(null);

  const STEPS = ["LENDO EXAME...", "IDENTIFICANDO DATA...", "EXTRAINDO VALORES...", "FORMATANDO NO PADRÃO DR. LUAN..."];

  async function process() {
    if (tab !== "text") {
      toast.info("Upload de PDF/imagem em etapa futura — use COLAR TEXTO");
      return;
    }
    if (!text.trim()) {
      toast.error("Cole o texto do laboratório");
      return;
    }
    setLoading(true);
    setStep(0);
    const stepInterval = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 600);
    try {
      const ai = await extractLabWithAI(text, { age: patient.age, sex: patient.sex === "F" ? "FEMININO" : "MASCULINO" });
      clearInterval(stepInterval);
      setStep(STEPS.length);
      const v = ai.valores;
      const dateBR = ai.data_exame ? ai.data_exame.split("-").reverse().join("/") : "";
      const raw: Record<string, string> = {};
      if (v.hb != null) raw["Hb"] = String(v.hb).replace(".", ",");
      if (v.ht != null) raw["Ht"] = String(v.ht).replace(".", ",");
      if (v.leucocitos != null) raw["Leuco"] = String(v.leucocitos);
      if (v.segmentados_percent != null) raw["Seg"] = `${v.segmentados_percent}%`;
      if (v.bastoes_percent != null) raw["Bastoes"] = `${v.bastoes_percent}%`;
      if (v.plaquetas != null) raw["Plaquetas"] = String(v.plaquetas);
      if (v.creatinina != null) raw["Creatinina"] = String(v.creatinina).replace(".", ",");
      if (v.ureia != null) raw["Ureia"] = String(v.ureia);
      if (v.sodio != null) raw["Na"] = String(v.sodio);
      if (v.potassio != null) raw["K"] = String(v.potassio).replace(".", ",");
      if (v.pcr != null) raw["PCR"] = String(v.pcr);
      const formatted = [ai.texto_formatado, ai.eas_formatado].filter(Boolean).join("\n\n");
      setResult({ date: dateBR, raw, formatted });
      setAiPayload(ai);
      setLoading(false);
      toast.success("Laboratório extraído com IA");
    } catch (e: any) {
      clearInterval(stepInterval);
      setLoading(false);
      console.error(e);
      toast.error(e?.message || "Falha na IA — usando fallback local");
      // Fallback mockado conforme PRD
      setResult({
        date: "24/04/2026",
        raw: { Hb: "11,2", Ht: "34,1", Leuco: "12.800", Seg: "80%", Bastoes: "5%", Plaquetas: "178.000", Creatinina: "1,1", Ureia: "53", Na: "138", K: "4,2", PCR: "53" },
        formatted: "LAB ATUAL (24/04/2026): HB 11,2 / HT 34,1 / LEUCO 12.800 (80% SEG / 5% BAST) / PLQ 178.000 / CR 1,1 / UR 53 / NA 138 / K 4,2 / PCR 53\n\nEAS (24/04/2026): 38 PIÓCITOS/CAMPO / NITRITO NEGATIVO",
      });
    }
  }

  async function handleUse() {
    if (!result) return;
    onUse(result);
    if (aiPayload) {
      try { await saveLabExam(patient.id, aiPayload); } catch (e) { console.warn(e); }
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-card rounded-2xl shadow-2xl overflow-hidden">
        <header className="px-6 py-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-ai to-ai/80 text-ai-foreground">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-white/20 grid place-items-center"><Sparkles className="h-5 w-5"/></div>
            <div>
              <h3 className="font-extrabold uppercase tracking-tight">IMPORTAR LABORATÓRIO COM IA</h3>
              <p className="text-xs opacity-80">DR. LUAN · PADRÃO DE FORMATAÇÃO</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-white/10 grid place-items-center"><X className="h-4 w-4"/></button>
        </header>

        {!result && !loading && (
          <>
            <div className="px-6 pt-5 flex gap-1 border-b border-border">
              {[
                { id: "text", label: "COLAR TEXTO", icon: ClipboardPaste },
                { id: "pdf", label: "ENVIAR PDF", icon: FileUp },
                { id: "img", label: "FOTO / PRINT", icon: ImageIcon },
              ].map((t) => (
                <button key={t.id} onClick={() => setTab(t.id as any)}
                  className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wide border-b-2 -mb-px ${tab === t.id ? "border-ai text-ai" : "border-transparent text-muted-foreground"}`}>
                  <t.icon className="inline h-3.5 w-3.5 mr-1.5"/>{t.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {tab === "text" && (
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="Cole aqui o resultado do laboratório..."
                  className="w-full bg-input-bg border border-border rounded-lg px-4 py-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ai/30"/>
              )}
              {tab !== "text" && (
                <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
                  {tab === "pdf" ? <FileUp className="h-10 w-10 mx-auto text-muted-foreground"/> : <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground"/>}
                  <p className="mt-3 font-bold uppercase tracking-tight text-sm">{tab === "pdf" ? "ARRASTE O PDF AQUI" : "ENVIE FOTO OU PRINT"}</p>
                  <p className="text-[11px] text-muted-foreground mt-2 uppercase tracking-wide">UI VISUAL · CONEXÃO REAL EM ETAPA POSTERIOR</p>
                </div>
              )}

              <button onClick={process} className="w-full mt-5 py-3 rounded-xl bg-ai text-ai-foreground font-bold uppercase tracking-wide hover:opacity-90">
                <Sparkles className="inline h-4 w-4 mr-2"/> PROCESSAR LABORATÓRIO
              </button>
            </div>
          </>
        )}

        {loading && (
          <div className="p-12 text-center">
            <Loader2 className="h-10 w-10 mx-auto text-ai animate-spin"/>
            <ul className="mt-6 space-y-2 max-w-xs mx-auto">
              {STEPS.map((s, i) => (
                <li key={s} className={`flex items-center gap-2 text-xs uppercase tracking-wide transition-opacity ${i <= step ? "opacity-100" : "opacity-30"}`}>
                  {i < step ? <Check className="h-3.5 w-3.5 text-success"/> : i === step ? <Loader2 className="h-3.5 w-3.5 animate-spin text-ai"/> : <Circle className="h-3.5 w-3.5"/>}
                  <span className="font-bold">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result && (
          <div className="p-6 space-y-4">
            <div className="rounded-xl border border-ai/30 bg-ai/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="label-tech text-ai">DATA EXTRAÍDA</span>
                <Badge variant="ai">{result.date}</Badge>
              </div>
              <pre className="whitespace-pre-wrap text-xs font-mono leading-relaxed">{result.formatted}</pre>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={handleUse} className="py-3 rounded-lg bg-success text-success-foreground text-xs font-bold uppercase tracking-wide">USAR NA EVOLUÇÃO</button>
              <button onClick={() => setResult(null)} className="py-3 rounded-lg border border-border text-xs font-bold uppercase tracking-wide hover:bg-secondary">EDITAR VALORES</button>
              <button onClick={onClose} className="py-3 rounded-lg border border-border text-xs font-bold uppercase tracking-wide hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive">DESCARTAR</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Circle({ className }: { className?: string }) { return <div className={`h-3.5 w-3.5 rounded-full border ${className || ""}`}/>; }

// ---------------- EVOLUTION MODAL ----------------

function EvolutionModal({ patient, data, egfr, stage, abx, abxD, hgt, trend, previa, onClose }: any) {
  const text = useMemo(() => buildEvolution({ patient, data, egfr, stage, abx, abxD, hgt, trend, previa }), [patient, data, egfr, stage, abx, abxD, hgt, trend, previa]);
  const [copied, setCopied] = useState(false);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-card rounded-2xl shadow-2xl overflow-hidden">
        <header className="px-6 py-4 border-b border-border flex items-center justify-between bg-navy text-navy-foreground">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-warning"/>
            <h3 className="font-extrabold uppercase tracking-tight">EVOLUÇÃO PADRÃO-OURO</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-white/10 grid place-items-center"><X className="h-4 w-4"/></button>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <pre className="whitespace-pre-wrap text-xs font-mono leading-relaxed bg-input-bg border border-border rounded-lg p-5">{text}</pre>
        </div>
        <footer className="px-6 py-4 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-border text-xs font-bold uppercase tracking-wide hover:bg-secondary">FECHAR</button>
          <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); toast.success("Evolução copiada"); setTimeout(() => setCopied(false), 1500); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wide hover:bg-primary/90">
            {copied ? <Check className="h-4 w-4"/> : <Copy className="h-4 w-4"/>} {copied ? "COPIADO" : "COPIAR EVOLUÇÃO"}
          </button>
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
