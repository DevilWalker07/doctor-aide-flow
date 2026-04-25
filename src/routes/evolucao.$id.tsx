import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, FlaskConical, FileText, Sparkles, Copy, X, Loader2, AlertTriangle, FileUp, ImageIcon, ClipboardPaste, Check, Stethoscope, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checklist, type ChecklistItem } from "@/components/evolucao/Checklist";
import { getPatient, savePatient, usePatients, type Patient, type PatientData } from "@/lib/store";
import { ckdEpi2021, ckdStage, hgtStats, abxDay, formatDateBR, pcrTrend, getLabAlerts } from "@/lib/medical";
import { toast } from "sonner";
import { extractLabWithAI, generateEvolutionWithAI } from "@/lib/aiService";
import { saveEvolution } from "@/lib/store";

export const Route = createFileRoute("/evolucao/$id")({
  component: EvolucaoPage,
  head: () => ({ meta: [{ title: "Evolução Clínica — DOUTOR AJUDA" }] }),
});

const TODAY = new Date().toISOString().split('T')[0];

function EvolucaoPage() {
  const { id } = useParams({ from: "/evolucao/$id" });
  const [patient, setPatient] = useState<Patient | null>(null);
  const [data, setData] = useState<PatientData>({});
  const [labOpen, setLabOpen] = useState(false);
  const [evolOpen, setEvolOpen] = useState(false);
  const [labEdit, setLabEdit] = useState(false);

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
    { id: "ident", label: "IDENTIFICAÇÃO", status: (patient?.name && patient?.age && patient?.bed) ? "done" : "pending" },
    { id: "vit", label: "SINAIS VITAIS", status: (data.vitals?.pas && data.vitals?.fc && data.vitals?.fr && data.vitals?.spo2 && data.vitals?.temp) ? "done" : "pending" },
    { id: "stat", label: "STATUS CLÍNICO", status: (data.status?.geral && data.status?.clinica && data.status?.hemo && data.status?.consc) ? "done" : "pending" },
    { id: "resp", label: "RESPIRATÓRIO", status: (data.resp?.padrao && data.resp?.suporte) ? "done" : "pending" },
    { id: "dig", label: "DIGESTIVO", status: (data.digest?.tolerancia && data.digest?.tipo && data.digest?.abdome) ? "done" : "pending" },
    { id: "diur", label: "DIURESE", status: (data.diurese?.padrao && data.diurese?.via) ? "done" : "pending" },
    { id: "lab", label: "LABORATÓRIO", status: (data.lab?.formatted || (data.lab?.raw && Object.keys(data.lab.raw).length > 0)) ? (stage?.warn ? "warn" : "done") : "pending" },
    { id: "atb", label: "ANTIBIÓTICOS", status: (data.abx && data.abx.length > 0) || data.abx === null ? "done" : "pending" },
    { id: "exam", label: "EXAME FÍSICO", status: (data.exam?.ect && data.exam?.acv && data.exam?.ar && data.exam?.abd && data.exam?.ext) ? "done" : "pending" },
    { id: "cond", label: "CONDUTAS", status: data.conducta?.condutas?.trim() ? "done" : "pending" },
    { id: "pend", label: "PENDÊNCIAS / INTERCORRÊNCIAS", status: (data.conducta?.pendencias && data.conducta?.intercorrencias) ? "done" : "pending" },
  ], [patient, data, stage]);

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

  const previa = buildPrevia(patient, data, hgt, stage, egfr, TODAY);

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <header className="bg-background/90 backdrop-blur-xl border-b border-border sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1500px] mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
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
            }} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-[11px] font-bold uppercase tracking-widest hover:bg-secondary hover:border-border transition-all"><RefreshCw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">SINCRONIZAR</span></button>
            <button onClick={() => setLabOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-ai text-ai-foreground text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-ai/20 hover:shadow-ai/40 hover:-translate-y-0.5 transition-all"><FlaskConical className="h-3.5 w-3.5" /> <span className="hidden sm:inline">IMPORTAR LAB</span></button>
            <button onClick={() => setEvolOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"><FileText className="h-3.5 w-3.5" /> <span className="hidden sm:inline">GERAR EVOLUÇÃO</span></button>
          </div>
        </div>
      </header>

      <div className="max-w-[1500px] mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[280px_1fr_360px] gap-6">
        {/* Sidebar */}
        <div><Checklist items={checklist} onNavigate={(id) => {
          const el = document.getElementById(`section-${id}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }} /></div>

        {/* Center column */}
        <div className="space-y-5">
          <SectionCard title="SINAIS VITAIS" icon="❤️" sectionId="vit">
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

          <SectionCard title="HGT — CURVA GLICÊMICA" icon="🩸" sectionId="hgt"
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
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-center">
                  <p className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-widest mb-1">MÉDIA</p>
                  <p className="text-xl font-black text-[#0F172A]">{hgt.mean}</p>
                </div>
                <div className={`border rounded-xl p-3 text-center ${hgt.peak > 180 ? "bg-[#FEF2F2] border-[#FCA5A5]" : "bg-[#F8FAFC] border-[#E2E8F0]"}`}>
                  <p className={`text-[9px] font-extrabold uppercase tracking-widest mb-1 ${hgt.peak > 180 ? "text-[#EF4444]" : "text-[#64748B]"}`}>PICO</p>
                  <p className={`text-xl font-black ${hgt.peak > 180 ? "text-[#B91C1C]" : "text-[#0F172A]"}`}>{hgt.peak}</p>
                </div>
                <div className={`border rounded-xl p-3 text-center ${hgt.nadir < 70 && hgt.nadir > 0 ? "bg-[#FFFBEB] border-[#FDE68A]" : "bg-[#F8FAFC] border-[#E2E8F0]"}`}>
                  <p className={`text-[9px] font-extrabold uppercase tracking-widest mb-1 ${hgt.nadir < 70 && hgt.nadir > 0 ? "text-[#D97706]" : "text-[#64748B]"}`}>NADIR</p>
                  <p className={`text-xl font-black ${hgt.nadir < 70 && hgt.nadir > 0 ? "text-[#92400E]" : "text-[#0F172A]"}`}>{hgt.nadir}</p>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="STATUS CLÍNICO" icon="📋" sectionId="stat">
            <Seg label="ESTADO GERAL" value={data.status?.geral} options={["BEG", "REG", "MEG"]} onChange={(v) => patch("status", { geral: v })} />
            <Seg label="CLÍNICA" value={data.status?.clinica} options={["ESTÁVEL", "INSTÁVEL"]} onChange={(v) => patch("status", { clinica: v })} />
            <Seg label="HEMODINÂMICA" value={data.status?.hemo} options={["ESTÁVEL", "INSTÁVEL", "EM USO DE DVA"]} onChange={(v) => patch("status", { hemo: v })} />
            <Seg label="CONSCIÊNCIA" value={data.status?.consc} options={["ORIENTADO", "DESORIENTADO", "REBAIXADO"]} onChange={(v) => patch("status", { consc: v })} />
            {data.status?.consc === "REBAIXADO" && (
              <SmallInput label="GLASGOW" unit="" value={data.status?.glasgow} onChange={(v) => patch("status", { glasgow: v })} />
            )}
          </SectionCard>

          <SectionCard title="RESPIRATÓRIO" icon="🫁" sectionId="resp">
            <Seg label="PADRÃO" value={data.resp?.padrao} options={["EUPNEICO", "DISPNEICO", "TAQUIPNEICO"]} onChange={(v) => patch("resp", { padrao: v })} />
            <Seg label="SUPORTE" value={data.resp?.suporte} options={["AR AMBIENTE", "CATETER O2", "MÁSCARA SIMPLES", "MÁSCARA RESERVATÓRIO", "VNI", "VM"]} onChange={(v) => patch("resp", { suporte: v })} />
            {data.resp?.suporte && data.resp.suporte !== "AR AMBIENTE" && data.resp.suporte !== "VM" && (
              <SmallInput label="FLUXO O₂" unit="L/min" value={data.resp?.o2} onChange={(v) => patch("resp", { o2: v })} />
            )}
            {data.resp?.suporte === "VM" && (
              <>
                <Seg label="MODO" value={data.resp?.modo} options={["PSV", "PCV", "VCV", "PRVC", "CPAP", "SIMV"]} onChange={(v) => patch("resp", { modo: v })} />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <SmallInput label="FiO₂" unit="%" value={data.resp?.fio2} onChange={(v) => patch("resp", { fio2: v })} />
                  <SmallInput label="PEEP" unit="cmH₂O" value={data.resp?.peep} onChange={(v) => patch("resp", { peep: v })} />
                  <SmallInput label="FR" unit="irpm" value={data.resp?.vmFr} onChange={(v) => patch("resp", { vmFr: v })} />
                </div>
              </>
            )}
          </SectionCard>

          <SectionCard title="DIGESTIVO" icon="🍽️" sectionId="dig">
            <Seg label="TOLERÂNCIA À DIETA" value={data.digest?.tolerancia} options={["BOA", "PARCIAL", "NÃO TOLERA"]} onChange={(v) => patch("digest", { tolerancia: v })} />
            <Seg label="TIPO" value={data.digest?.tipo} options={["ORAL", "SNE", "GTT", "NPT", "JEJUM"]} onChange={(v) => patch("digest", { tipo: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Toggle label="NÁUSEAS" value={!!data.digest?.nauseas} onChange={(v) => patch("digest", { nauseas: v })} />
              <Toggle label="VÔMITOS" value={!!data.digest?.vomitos} onChange={(v) => patch("digest", { vomitos: v })} />
            </div>
            {data.digest?.vomitos && (
              <Seg label="ASPECTO DO VÔMITO" value={data.digest?.vomitoAspecto} options={["ALIMENTAR", "BILIOSO", "SANGUINOLENTO", "FECALÓIDE", "AQUOSO"]} onChange={(v) => patch("digest", { vomitoAspecto: v })} />
            )}
            <Seg label="DEJEÇÕES" value={data.digest?.dejecoes} options={["PRESENTES", "AUSENTES", "DIARREICAS", "MELENA", "ENTERORRAGIA"]} onChange={(v) => patch("digest", { dejecoes: v })} />
            <Seg label="FLATOS" value={data.digest?.flatos} options={["PRESENTES", "AUSENTES"]} onChange={(v) => patch("digest", { flatos: v })} />
            <Seg label="ABDOME" value={data.digest?.abdome} options={["PLANO", "FLÁCIDO", "DISTENDIDO", "DOLOROSO", "TENSO", "GLOBOSO"]} onChange={(v) => patch("digest", { abdome: v })} />
            {data.digest?.abdome === "DOLOROSO" && (
              <Seg label="LOCAL DA DOR" value={data.digest?.dor} options={["DIFUSO", "HCD", "HCE", "EPIGÁSTRIO", "FID", "FIE", "HIPOGÁSTRIO", "FLANCO D", "FLANCO E"]} onChange={(v) => patch("digest", { dor: v })} />
            )}
          </SectionCard>

          <SectionCard title="DIURESE" icon="💧" sectionId="diur">
            <Seg label="PADRÃO" value={data.diurese?.padrao} options={["PRESENTE", "OLIGÚRIA", "ANÚRIA"]} onChange={(v) => patch("diurese", { padrao: v })} />
            <Seg label="VIA" value={data.diurese?.via} options={["ESPONTÂNEA", "SVD", "FRALDA", "CISTOSTOMIA"]} onChange={(v) => patch("diurese", { via: v })} />
            <div className="grid grid-cols-2 gap-3">
              <SmallInput label="DÉBITO" unit="mL/24h" value={data.diurese?.debito} onChange={(v) => patch("diurese", { debito: v })} />
              <SmallInput label="BALANÇO" unit="mL" value={data.diurese?.bhValor} onChange={(v) => patch("diurese", { bhValor: v })} />
            </div>
          </SectionCard>

          <SectionCard title="ANTIBIÓTICOS" icon="💊" sectionId="atb">
            <AbxManager
              abxList={data.abx || []}
              today={TODAY}
              onChange={(list) => update("abx", list)}
            />
          </SectionCard>

          <SectionCard title="LABORATÓRIO" icon="🧪" sectionId="lab"
            extra={
              <div className="flex gap-2">
                <button onClick={() => setLabEdit(!labEdit)} className="px-3 py-1.5 rounded-md border border-[#E2E8F0] text-[10px] font-bold uppercase tracking-wide hover:bg-secondary">
                  {labEdit ? "VISUALIZAR" : "EDITAR VALORES"}
                </button>
                <button onClick={() => setLabOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ai text-ai-foreground text-[11px] font-bold uppercase tracking-wide">
                  <Sparkles className="h-3 w-3" /> IMPORTAR COM IA
                </button>
              </div>
            }>
            {data.lab ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">DATA DO EXAME: {data.lab.date}</span>
                  {stage && egfr > 0 && <Badge variant={stage.warn ? "destructive" : "soft"}>TFGe {egfr} · {stage.stage}</Badge>}
                </div>

                {labEdit ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#F8FAFC] p-4 rounded-2xl border border-[#E2E8F0]">
                    {["Hb", "Ht", "VCM", "Leuco", "Plq", "Cr", "Ureia", "PCR", "Na", "K"].map(k => (
                      <div key={k}>
                        <label className="text-[9px] font-black text-[#64748B] uppercase mb-1 block">{k}</label>
                        <input
                          value={data.lab?.raw?.[k] || ""}
                          onChange={(e) => patch("lab", { raw: { ...data.lab?.raw, [k]: e.target.value } })}
                          className="w-full bg-white border border-[#E2E8F0] rounded-lg px-2 py-1 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#0F172A] rounded-2xl p-5 shadow-inner">
                    <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-white font-mono opacity-90">{data.lab.formatted || "NENHUM RESULTADO FORMATADO."}</pre>
                  </div>
                )}

                {/* Alertas */}
                {(() => {
                  const alerts = getLabAlerts(data.lab.raw || {});
                  if (alerts.length === 0 && !stage?.warn) return null;
                  return (
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-[#64748B] uppercase tracking-widest ml-1">ALERTAS CLÍNICOS</p>
                      <div className="flex flex-wrap gap-2">
                        {alerts.map(a => (
                          <div key={a} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] text-[#B91C1C] text-[10px] font-black uppercase">
                            <AlertTriangle className="h-3 w-3" /> {a}
                          </div>
                        ))}
                        {stage?.warn && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-[10px] font-black uppercase">
                            <Shield className="h-3 w-3" /> AJUSTE RENAL ({stage.stage})
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="text-center py-12 bg-[#F8FAFC] border border-dashed border-[#E2E8F0] rounded-3xl">
                <FlaskConical className="h-10 w-10 mx-auto text-[#CBD5E1] mb-3" />
                <p className="text-sm font-bold text-[#64748B]">Nenhum laboratório disponível</p>
                <button onClick={() => setLabOpen(true)} className="mt-4 px-6 py-2.5 rounded-xl bg-[#2563EB] text-white text-[11px] font-black uppercase tracking-widest hover:shadow-lg transition-all">IMPORTAR AGORA</button>
              </div>
            )}
          </SectionCard>

          <SectionCard title="EXAME FÍSICO" icon="🩺" sectionId="exam"
            extra={<button onClick={() => update("exam", DEFAULT_EXAM)} className="px-3 py-1.5 rounded-md border border-[#E2E8F0] text-[10px] font-bold uppercase tracking-wide hover:bg-secondary">EXAME FÍSICO PADRÃO</button>}>
            <div className="grid grid-cols-1 gap-4">
              {(["ect", "acv", "ar", "abd", "ext"] as const).map((k) => (
                <div key={k}>
                  <label className="text-[9px] font-black text-[#64748B] uppercase tracking-widest mb-1.5 block">
                    {k === "ect" ? "ECTOSCOPIA" : k === "acv" ? "APARELHO CARDIOVASCULAR" : k === "ar" ? "APARELHO RESPIRATÓRIO" : k === "abd" ? "ABDOME" : "EXTREMIDADES"}
                  </label>
                  <textarea
                    value={(data.exam as any)?.[k] || ""}
                    onChange={(e) => patch("exam", { [k]: e.target.value.toUpperCase() } as any)}
                    rows={2}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                  />
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="CONDUTAS, PENDÊNCIAS, INTERCORRÊNCIAS" icon="✅" sectionId="cond">
            <div className="flex flex-wrap gap-2 mb-2">
              {[
                { label: "SEM QUEIXAS", action: () => patch("digest", { nauseas: false, vomitos: false }) },
                { label: "SEM INTERCORRÊNCIAS", action: () => patch("conducta", { intercorrencias: "SEM INTERCORRÊNCIAS." }) },
                { label: "SEM PENDÊNCIAS", action: () => patch("conducta", { pendencias: "SEM PENDÊNCIAS NO MOMENTO." }) },
                { label: "DIURESE FISIOLÓGICA", action: () => patch("diurese", { padrao: "PRESENTE", via: "ESPONTÂNEA", aspecto: "FISIOLÓGICO" }) },
                { label: "DEJEÇÕES FISIOLÓGICAS", action: () => patch("digest", { dejecoes: "PRESENTES", flatos: "PRESENTES" }) },
                { label: "AR AMBIENTE", action: () => patch("resp", { padrao: "EUPNEICO", suporte: "AR AMBIENTE" }) },
                { label: "HEMODINAMICAMENTE ESTÁVEL", action: () => patch("status", { clinica: "ESTÁVEL", hemo: "ESTÁVEL" }) },
              ].map((b) => (
                <button key={b.label} onClick={b.action} className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[10px] font-black uppercase tracking-widest hover:bg-[#F8FAFC] hover:border-[#2563EB] transition-all text-[#64748B] hover:text-[#2563EB]">
                  + {b.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div>
                <label className="text-[10px] font-black text-[#0F172A] uppercase tracking-[0.2em] mb-2 block">IMPRESSÃO DIAGNÓSTICA</label>
                <textarea
                  value={data.conducta?.dx || ""}
                  onChange={(e) => patch("conducta", { dx: e.target.value.toUpperCase() })}
                  rows={3}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                  placeholder="Ex: 1. PÉ DIABÉTICO INFECTADO. 2. HAS. 3. DM2."
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-[#0F172A] uppercase tracking-[0.2em] mb-2 block">CONDUTAS</label>
                <textarea
                  value={data.conducta?.condutas || ""}
                  onChange={(e) => patch("conducta", { condutas: e.target.value.toUpperCase() })}
                  rows={4}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                  placeholder="Descreva as condutas para o plantão..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-[#EF4444] uppercase tracking-[0.2em] mb-2 block">INTERCORRÊNCIAS</label>
                  <textarea
                    value={data.conducta?.intercorrencias || ""}
                    onChange={(e) => patch("conducta", { intercorrencias: e.target.value.toUpperCase() })}
                    rows={2}
                    className="w-full bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#EF4444]/10"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-[#F59E0B] uppercase tracking-[0.2em] mb-2 block">PENDÊNCIAS</label>
                  <textarea
                    value={data.conducta?.pendencias || ""}
                    onChange={(e) => patch("conducta", { pendencias: e.target.value.toUpperCase() })}
                    rows={2}
                    className="w-full bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/10"
                  />
                </div>
              </div>
            </div>
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
            <Sparkles className="h-4 w-4 text-warning group-hover:rotate-12 transition-transform duration-300" /> EVOLUÇÃO PADRÃO-OURO
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

function SectionCard({ title, icon, extra, sectionId, children }: { title: string; icon?: string; extra?: React.ReactNode; sectionId?: string; children: React.ReactNode }) {
  return (
    <section id={sectionId ? `section-${sectionId}` : undefined} className="bg-white border border-border rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 scroll-mt-24">
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

// --------------- AbxManager ---------------
type AbxEntry = { name: string; dose: string; via: string; freq: string; d0: string; durDays: number };

const COMMON_ATB = [
  { name: "CEFTRIAXONA", dose: "1G", via: "EV", freq: "12/12h", durDays: 7 },
  { name: "CEFTRIAXONA", dose: "2G", via: "EV", freq: "1x/dia", durDays: 7 },
  { name: "CIPROFLOXACINO", dose: "400MG", via: "EV", freq: "12/12h", durDays: 7 },
  { name: "CIPROFLOXACINO", dose: "500MG", via: "VO", freq: "12/12h", durDays: 7 },
  { name: "LEVOFLOXACINO", dose: "500MG", via: "VO", freq: "1x/dia", durDays: 7 },
  { name: "LEVOFLOXACINO", dose: "750MG", via: "EV", freq: "1x/dia", durDays: 7 },
  { name: "METRONIDAZOL", dose: "500MG", via: "EV", freq: "8/8h", durDays: 7 },
  { name: "MEROPENEM", dose: "1G", via: "EV", freq: "8/8h", durDays: 10 },
  { name: "MEROPENEM", dose: "2G", via: "EV", freq: "8/8h", durDays: 10 },
  { name: "PIPERACILINA-TAZOBACTAM", dose: "4,5G", via: "EV", freq: "6/6h", durDays: 10 },
  { name: "VANCOMICINA", dose: "1G", via: "EV", freq: "12/12h", durDays: 10 },
  { name: "CLINDAMICINA", dose: "600MG", via: "EV", freq: "8/8h", durDays: 7 },
  { name: "AZITROMICINA", dose: "500MG", via: "VO", freq: "1x/dia", durDays: 5 },
  { name: "OXACILINA", dose: "2G", via: "EV", freq: "4/4h", durDays: 14 },
  { name: "AMPICILINA-SULBACTAM", dose: "3G", via: "EV", freq: "6/6h", durDays: 7 },
  { name: "AMOXICILINA-CLAVULANATO", dose: "1G", via: "VO", freq: "12/12h", durDays: 7 },
  { name: "SULFAMETOXAZOL-TRIMETOPRIM", dose: "800/160MG", via: "VO", freq: "12/12h", durDays: 7 },
  { name: "CEFEPIMA", dose: "2G", via: "EV", freq: "12/12h", durDays: 7 },
  { name: "GENTAMICINA", dose: "240MG", via: "EV", freq: "1x/dia", durDays: 7 },
  { name: "DAPTOMICINA", dose: "6MG/KG", via: "EV", freq: "1x/dia", durDays: 14 },
  { name: "LINEZOLIDA", dose: "600MG", via: "EV", freq: "12/12h", durDays: 10 },
  { name: "POLIMIXINA B", dose: "25.000UI/KG", via: "EV", freq: "12/12h", durDays: 10 },
  { name: "ERTAPENEM", dose: "1G", via: "EV", freq: "1x/dia", durDays: 7 },
];

function AbxManager({ abxList, today, onChange }: { abxList: AbxEntry[]; today: string; onChange: (list: AbxEntry[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [form, setForm] = useState<AbxEntry & { mode?: "D0" | "D1" }>({ name: "", dose: "", via: "EV", freq: "8/8h", d0: today, durDays: 7, mode: "D1" });
  const [search, setSearch] = useState("");

  function add() {
    if (!form.name.trim()) return;
    const newList = [...abxList];
    const entry = { ...form, name: form.name.toUpperCase() };
    if (editingIdx !== null) newList[editingIdx] = entry;
    else newList.push(entry);

    onChange(newList);
    setForm({ name: "", dose: "", via: "EV", freq: "8/8h", d0: today, durDays: 7, mode: "D1" });
    setSearch("");
    setAdding(false);
    setEditingIdx(null);
  }

  function startEdit(idx: number) {
    setForm({ ...abxList[idx], mode: (abxList[idx] as any).mode || "D1" });
    setEditingIdx(idx);
    setAdding(true);
  }

  function selectCommon(atb: typeof COMMON_ATB[0]) {
    setForm({ ...form, ...atb });
    setSearch("");
  }

  function remove(idx: number) {
    onChange(abxList.filter((_, i) => i !== idx));
  }

  const filtered = search.trim()
    ? COMMON_ATB.filter(a => a.name.includes(search.toUpperCase()))
    : [];

  return (
    <div className="space-y-3">
      {abxList.length === 0 && !adding && (
        <div className="text-center py-6 bg-[#F8FAFC] border border-dashed border-[#E2E8F0] rounded-2xl">
          <p className="text-xs text-[#64748B] font-medium">Nenhum antibiótico em uso</p>
        </div>
      )}

      {abxList.map((a, i) => {
        const day = abxDay(a.d0, today, (a as any).mode || "D1");
        const pct = Math.min(100, Math.round((day / a.durDays) * 100));
        const exceeded = day > a.durDays;
        const finished = day === a.durDays;

        return (
          <div key={i} className={`rounded-2xl border p-4 transition-all ${exceeded ? "border-[#FCA5A5] bg-[#FEF2F2]" : "border-[#E2E8F0] bg-white shadow-sm"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-black text-[11px] text-[#0F172A] uppercase tracking-tight truncate">
                    {a.name} {a.dose} {a.via} {a.freq}
                  </h4>
                  {exceeded && <span className="text-[8px] font-black bg-[#EF4444] text-white px-1.5 py-0.5 rounded">REVISAR CICLO</span>}
                  {finished && <span className="text-[8px] font-black bg-[#16A34A] text-white px-1.5 py-0.5 rounded">FINALIZADO</span>}
                </div>
                <p className="text-[10px] text-[#64748B] font-bold">
                  INÍCIO: {formatDateBR(a.d0)} · {a.durDays} DIAS PLANEJADOS
                </p>
                <div className="mt-3 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${exceeded ? "bg-[#EF4444]" : finished ? "bg-[#16A34A]" : "bg-[#2563EB]"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className={`text-[11px] font-black px-2.5 py-1 rounded-lg ${exceeded ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-[#EAF2FF] text-[#2563EB]"}`}>
                  D{day}/{a.durDays}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(i)} className="text-[9px] font-black text-[#64748B] hover:text-[#2563EB] uppercase tracking-widest">EDITAR</button>
                  <button onClick={() => remove(i)} className="text-[9px] font-black text-[#64748B] hover:text-[#EF4444] uppercase tracking-widest">REMOVER</button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {adding ? (
        <div className="rounded-2xl border border-[#2563EB] bg-white p-5 shadow-xl animate-in slide-in-from-top-2 duration-300">
          <h4 className="text-[10px] font-black text-[#2563EB] uppercase tracking-[0.2em] mb-4">
            {editingIdx !== null ? "EDITAR ANTIBIÓTICO" : "ADICIONAR ANTIBIÓTICO"}
          </h4>

          <div className="space-y-4">
            <div>
              <label className="text-[9px] font-black text-[#64748B] uppercase tracking-widest mb-1.5 block">NOME / BUSCA RÁPIDA</label>
              <input
                autoFocus
                value={search || form.name}
                onChange={e => { setSearch(e.target.value); setForm(f => ({ ...f, name: e.target.value })); }}
                placeholder="Ex: CEFTRIAXONA, MEROPENEM..."
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-xs font-bold uppercase focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
              />
              {filtered.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto rounded-xl border border-[#E2E8F0] bg-white divide-y divide-[#F1F5F9] shadow-lg">
                  {filtered.map((a, i) => (
                    <button key={i} onClick={() => selectCommon(a)} className="w-full text-left px-4 py-2 hover:bg-[#F8FAFC] transition-colors">
                      <p className="text-[11px] font-black text-[#0F172A]">{a.name} {a.dose}</p>
                      <p className="text-[9px] text-[#64748B] font-bold">{a.via} {a.freq} · {a.durDays}D</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-black text-[#64748B] uppercase tracking-widest mb-1.5 block">DOSE</label>
                <input value={form.dose} onChange={e => setForm(f => ({ ...f, dose: e.target.value }))} className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-2 text-xs font-bold uppercase" />
              </div>
              <div>
                <label className="text-[9px] font-black text-[#64748B] uppercase tracking-widest mb-1.5 block">DURAÇÃO (DIAS)</label>
                <input type="number" value={form.durDays} onChange={e => setForm(f => ({ ...f, durDays: Number(e.target.value) }))} className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-2 text-xs font-bold" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[9px] font-black text-[#64748B] uppercase tracking-widest mb-1.5 block">VIA</label>
                <select value={form.via} onChange={e => setForm(f => ({ ...f, via: e.target.value }))} className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs font-bold">
                  {["EV", "VO", "IM", "SC", "TÓPICO"].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black text-[#64748B] uppercase tracking-widest mb-1.5 block">POSOLOGIA</label>
                <input value={form.freq} onChange={e => setForm(f => ({ ...f, freq: e.target.value }))} className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs font-bold uppercase" />
              </div>
              <div>
                <label className="text-[9px] font-black text-[#64748B] uppercase tracking-widest mb-1.5 block">INÍCIO</label>
                <input type="date" value={form.d0} onChange={e => setForm(f => ({ ...f, d0: e.target.value }))} className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[10px] font-bold" />
              </div>
            </div>

            <div className="flex items-center gap-4 bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
              <span className="text-[9px] font-black text-[#64748B] uppercase tracking-widest">CONTAR COMO:</span>
              <div className="flex bg-white border border-[#E2E8F0] rounded-lg p-1">
                {["D0", "D1"].map(m => (
                  <button key={m} onClick={() => setForm(f => ({ ...f, mode: m as any }))} className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${form.mode === m ? "bg-[#2563EB] text-white" : "text-[#64748B]"}`}>{m}</button>
                ))}
              </div>
              <p className="ml-auto text-[10px] font-black text-[#2563EB]">D{abxDay(form.d0, today, form.mode)}/{form.durDays}</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={add} className="flex-1 py-3 rounded-xl bg-[#2563EB] text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#1D4ED8] transition-all">SALVAR ANTIBIÓTICO</button>
              <button onClick={() => { setAdding(false); setEditingIdx(null); }} className="px-6 py-3 rounded-xl border border-[#E2E8F0] text-[#64748B] text-[10px] font-black uppercase tracking-[0.2em]">CANCELAR</button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => { setAdding(true); setEditingIdx(null); }} className="w-full py-4 rounded-2xl border-2 border-dashed border-[#E2E8F0] text-[#2563EB] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#EAF2FF] hover:border-[#2563EB] transition-all">
          + ADICIONAR NOVO ANTIBIÓTICO
        </button>
      )}
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

function buildPrevia(p: Patient, d: PatientData, hgt: any, stage: any, egfr: number, today: string): string {
  const parts: string[] = [];

  // Identificação e Status Geral
  parts.push(`PACIENTE EM LEITO ${p.bed} — ${p.sector}`);
  if (d.status?.geral) {
    let statusText = `EVOLUI EM ${d.status.geral}`;
    if (d.status.clinica && d.status.hemo) {
      statusText += `, CLÍNICA E HEMODINAMICAMENTE ${d.status.hemo}`;
    }
    if (d.status.consc) {
      statusText += `. CONSCIÊNCIA: ${d.status.consc}${d.status.glasgow ? ` (GLASGOW ${d.status.glasgow})` : ""}`;
    }
    parts.push(statusText);
  }

  // Respiratório
  if (d.resp?.padrao && d.resp?.suporte) {
    let respText = `${d.resp.padrao} EM ${d.resp.suporte}`;
    if (d.resp.suporte === "VM" && d.resp.modo) {
      respText += ` (${d.resp.modo}: FIO2 ${d.resp.fio2}%, PEEP ${d.resp.peep}, FR ${d.resp.vmFr})`;
    } else if (d.resp.o2) {
      respText += ` ${d.resp.o2}L/MIN`;
    }
    parts.push(respText);
  }

  // Digestivo
  const buildDigestivo = () => {
    const dParts: string[] = [];
    if (d.digest?.tolerancia) dParts.push(`TOLERANDO DIETA ${d.digest.tipo || ""} (${d.digest.tolerancia})`);

    // Náuseas / Vômitos
    if (d.digest?.nauseas === false) dParts.push("NEGA NÁUSEAS");
    else if (d.digest?.nauseas === true) dParts.push("REFERE NÁUSEAS");

    if (d.digest?.vomitos === false) dParts.push("NEGA VÔMITOS");
    else if (d.digest?.vomitos === true) dParts.push(`REFERE VÔMITOS DE ASPECTO ${d.digest.vomitoAspecto || "NÃO REFERIDO"}`);

    if (d.digest?.dejecoes) dParts.push(`DEJEÇÕES ${d.digest.dejecoes}`);
    if (d.digest?.flatos) dParts.push(`FLATOS ${d.digest.flatos === "PRESENTES" ? "PRESENTES" : "AUSENTES"}`);

    // Abdome
    if (d.digest?.abdome) {
      let abdText = `ABDOME ${d.digest.abdome}`;
      if (d.digest.abdome === "DOLOROSO" && d.digest.dor) abdText += ` EM ${d.digest.dor}`;
      dParts.push(abdText);
    }
    return dParts.join(". ");
  };
  const dig = buildDigestivo();
  if (dig) parts.push(dig);

  // Diurese
  if (d.diurese?.padrao) {
    let diurText = `DIURESE ${d.diurese.padrao}`;
    if (d.diurese.via) diurText += ` VIA ${d.diurese.via}`;
    if (d.diurese.aspecto) diurText += ` (${d.diurese.aspecto})`;
    if (d.diurese.debito) diurText += `. DÉBITO: ${d.diurese.debito}ML/24H`;
    parts.push(diurText);
  }

  // HGT
  if (hgt.count > 0) {
    let hgtText = `CURVA HGT: ${[d.hgt?.h06, d.hgt?.h12, d.hgt?.h18, d.hgt?.h00].filter(v => v !== undefined && v !== null).join("-")} MG/DL — MÉDIA ${hgt.mean} / PICO ${hgt.peak} / NADIR ${hgt.nadir}`;
    if (hgt.peak > 180) hgtText += ". COM HIPERGLICEMIA";
    if (hgt.nadir < 70 && hgt.nadir > 0) hgtText += ". COM EPISÓDIO DE HIPOGLICEMIA";
    parts.push(hgtText);
  }

  // Antibióticos
  if (d.abx && d.abx.length > 0) {
    const abxTexts = d.abx.map(a => {
      const day = abxDay(a.d0, today);
      const status = day > a.durDays ? `D${day}/${a.durDays} (CICLO EXCEDIDO)` : day === a.durDays ? `D${day}/${a.durDays} (CICLO FINALIZADO)` : `D${day}/${a.durDays}`;
      return `${a.name} (${status})`;
    });
    parts.push(`ANTIBIÓTICOS: ${abxTexts.join(", ")}`);
  }

  // Laboratório
  if (d.lab?.formatted) {
    parts.push(`LAB ATUAL (${d.lab.date}): ${d.lab.formatted}`);
  }
  if (stage && egfr > 0) {
    parts.push(`TFGe (CKD-EPI 2021): ${egfr} ML/MIN/1,73M² — ${stage.stage}`);
  }

  // Pendências / Intercorrências
  if (d.conducta?.intercorrencias && d.conducta.intercorrencias !== "SEM INTERCORRÊNCIAS") {
    parts.push(`INTERCORRÊNCIAS: ${d.conducta.intercorrencias}`);
  }
  if (d.conducta?.pendencias && d.conducta.pendencias !== "SEM PENDÊNCIAS NO MOMENTO") {
    parts.push(`PENDÊNCIAS: ${d.conducta.pendencias}`);
  }

  return parts.join(". ").toUpperCase() + ".";
}

// ---------------- LAB MODAL ----------------

function LabModal({ onClose, onUse, patientContext }: { onClose: () => void; onUse: (lab: PatientData["lab"]) => void; patientContext: any }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<PatientData["lab"] | null>(null);
  const [uploadLabel, setUploadLabel] = useState("");

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLabel(`Lendo ${file.name}...`);
    setLoading(true);
    setStep(0);

    try {
      let extractedText = "";

      if (file.type === "application/pdf") {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let j = 1; j <= pdf.numPages; j++) {
          const page = await pdf.getPage(j);
          const content = await page.getTextContent();
          extractedText += content.items.map((item: any) => item.str).join(" ") + "\n";
        }
      } else if (file.name.endsWith(".docx")) {
        const mammoth = (await import("mammoth")).default;
        const arrayBuffer = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer });
        extractedText = res.value;
      } else if (file.type.startsWith("image/")) {
        // Imagem: envia para OpenAI Vision via base64
        const { engine, apiKey } = (() => {
          const engine = localStorage.getItem("ai_engine") || "openai";
          const apiKey = localStorage.getItem("ai_api_key") || (import.meta as any).env?.VITE_OPENAI_API_KEY || "";
          return { engine, apiKey };
        })();

        if (!apiKey) throw new Error("Configure sua chave OpenAI nas Configurações para usar importação por imagem.");

        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve((ev.target?.result as string).split(",")[1]);
          reader.readAsDataURL(file);
        });

        const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{
              role: "user",
              content: [
                { type: "text", text: "Leia esta imagem de resultado de exame laboratorial e transcreva TODOS os valores encontrados em texto simples. Inclua nome do exame e valor. Se for um print/foto de sistema hospitalar, transcreva tudo que conseguir ler." },
                { type: "image_url", image_url: { url: `data:${file.type};base64,${base64}` } }
              ]
            }],
            max_tokens: 1500,
          }),
        });
        const visionData = await visionRes.json();
        if (!visionRes.ok) throw new Error(visionData.error?.message || "Erro ao ler imagem");
        extractedText = visionData.choices[0].message.content;
      } else if (file.type === "text/plain") {
        extractedText = await file.text();
      }

      if (!extractedText.trim()) throw new Error("Nenhum texto extraído do arquivo.");

      setText(extractedText);
      setUploadLabel("");
      toast.success("Arquivo lido! Revise o texto e clique em Processar.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

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
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"><X className="h-5 w-5 text-white" /></button>
        </header>

        <div className="flex-1 overflow-y-auto bg-input-bg p-8 custom-scrollbar">
          {!result && !loading && (
            <div className="bg-white border border-border shadow-sm rounded-2xl p-8">
              <p className="text-sm font-medium text-muted-foreground leading-relaxed mb-5">
                Cole o texto do resultado abaixo, ou importe diretamente um <b>PDF</b>, <b>DOCX</b> ou <b>foto/print</b> do sistema.
              </p>

              {/* Upload de arquivo */}
              <label className="flex items-center gap-3 cursor-pointer mb-5 px-4 py-3 rounded-xl border border-dashed border-ai/40 bg-ai/5 hover:bg-ai/10 transition-all">
                <div className="h-9 w-9 rounded-lg bg-ai/20 flex items-center justify-center text-ai shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-widest text-ai">{uploadLabel || "IMPORTAR ARQUIVO OU FOTO"}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">PDF · DOCX · JPG · PNG · PRINT DE TELA</p>
                </div>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,image/*"
                  className="hidden"
                  onChange={handleFileImport}
                />
              </label>

              <textarea
                className="w-full h-40 bg-input-bg border border-border rounded-2xl p-5 text-sm focus:outline-none focus:ring-2 focus:ring-ai/40 focus:border-ai/40 leading-relaxed transition-all resize-none"
                placeholder="Ex: Hgb 12.5 ht 38 leuco 12000 plaq 250k..."
                value={text} onChange={(e) => setText(e.target.value)}
              />
              <div className="mt-4 flex justify-end">
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
                {["LENDO DADOS", "ESTRUTURANDO RESULTADOS", "FINALIZANDO"].map((s, idx) => (
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
  const [finalContent, setFinalContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const { patients } = usePatients();

  const pat = useMemo(() => patients.find(p => p.id === pId), [patients, pId]);

  useEffect(() => {
    if (open && pat) {
      setGenerating(true);
      // Tentamos a IA, mas se falhar ou demorar, o fallback local já é padrão-ouro
      generateEvolutionWithAI(pat.data || {})
        .then(res => setFinalContent(res.toUpperCase()))
        .catch(() => {
          const egfr = ckdEpi2021(parseFloat(pat.data?.lab?.raw?.["Creatinina"]?.replace(",", ".") || "0"), pat.age, pat.sex);
          const stage = ckdStage(egfr);
          const hgt = hgtStats([pat.data?.hgt?.h06, pat.data?.hgt?.h12, pat.data?.hgt?.h18, pat.data?.hgt?.h00]);
          const trend = pcrTrend(pat.data?.pcrHist || []);
          setFinalContent(buildEvolution({
            patient: pat,
            data: pat.data,
            egfr,
            stage,
            hgt,
            trend,
            previa: content
          }));
        })
        .finally(() => setGenerating(false));
    }
  }, [open, pat, content]);

  if (!open) return null;

  async function finish() {
    await saveEvolution(pId, finalContent);
    close();
  }

  function copy() {
    navigator.clipboard.writeText(finalContent);
    setCopied(true);
    toast.success("Evolução copiada com sucesso");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#0F172A]/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[2rem] shadow-2xl shadow-primary/20 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        <header className="px-8 py-6 border-b border-[#E2E8F0] flex items-center justify-between bg-[#0F172A] text-white">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">EVOLUÇÃO PADRÃO-OURO</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mt-1">SISTEMA MÉDICO INTELIGENTE · DOUTOR AJUDA</p>
            </div>
          </div>
          <button onClick={close} className="h-10 w-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
            <X className="h-6 w-6 text-white" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-[#F8FAFC] custom-scrollbar">
          <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-3xl p-10 relative">
            {generating ? (
              <div className="flex flex-col items-center justify-center h-64 text-center space-y-4 py-12">
                <RefreshCw className="h-12 w-12 text-[#2563EB] animate-spin" />
                <p className="font-black text-xs tracking-[0.2em] text-[#0F172A] uppercase">ESTRUTURANDO DADOS CLÍNICOS...</p>
              </div>
            ) : (
              <pre className="text-[12px] font-mono leading-[1.8] whitespace-pre-wrap text-[#0F172A] selection:bg-[#2563EB]/10">{finalContent}</pre>
            )}
          </div>
        </div>

        <footer className="px-10 py-8 border-t border-[#E2E8F0] bg-white flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-[#2563EB]" />
            <p className="text-[10px] font-black uppercase tracking-widest text-[#64748B]">
              VERIFIQUE OS DADOS ANTES DE COLAR NO PRONTUÁRIO OFICIAL.
            </p>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button onClick={copy} disabled={generating} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl border-2 border-[#E2E8F0] font-black uppercase tracking-widest text-[11px] text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50 transition-all">
              {copied ? <Check className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5 text-[#64748B]" />}
              {copied ? "COPIADO!" : "COPIAR EVOLUÇÃO"}
            </button>
            <button onClick={finish} disabled={generating} className="flex-1 sm:flex-none px-10 py-4 rounded-2xl bg-[#2563EB] text-white font-black uppercase tracking-widest text-[11px] shadow-xl shadow-[#2563EB]/20 hover:shadow-[#2563EB]/40 disabled:opacity-50 transition-all">
              FINALIZAR E SALVAR
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function buildEvolution({ patient, data, egfr, stage, hgt, trend, previa }: any): string {
  const lines: string[] = [];
  const todayStr = new Date().toLocaleDateString("pt-BR");

  lines.push(`EVOLUÇÃO MÉDICA — ${todayStr}`);
  lines.push("=".repeat(40));
  lines.push("");
  lines.push("# 1. LISTA DE PROBLEMAS");
  lines.push("----------------------------------------");
  if (data.conducta?.dx) {
    lines.push(data.conducta.dx.toUpperCase());
  } else {
    lines.push("1. PACIENTE EM INVESTIGAÇÃO DIAGNÓSTICA / MANUTENÇÃO CLÍNICA");
  }
  lines.push("");

  lines.push("# 2. SITUAÇÃO ATUAL (S)");
  lines.push("----------------------------------------");
  lines.push(previa.toUpperCase());
  lines.push("");

  lines.push("# 3. EXAME FÍSICO (O)");
  lines.push("----------------------------------------");
  if (data.exam) {
    lines.push(`ECT: ${data.exam.ect || "NÃO REFERIDO"}`);
    lines.push(`ACV: ${data.exam.acv || "NÃO REFERIDO"}`);
    lines.push(`AR: ${data.exam.ar || "NÃO REFERIDO"}`);
    lines.push(`ABD: ${data.exam.abd || "NÃO REFERIDO"}`);
    lines.push(`EXT: ${data.exam.ext || "NÃO REFERIDO"}`);
  } else {
    lines.push("EXAME FÍSICO NÃO REGISTRADO.");
  }
  lines.push("");

  lines.push("# 4. EXAMES COMPLEMENTARES");
  lines.push("----------------------------------------");
  if (data.lab?.formatted) {
    lines.push(`LAB (${data.lab.date}):`);
    lines.push(data.lab.formatted.toUpperCase());
    if (stage) lines.push(`TFGe: ${egfr} ML/MIN/1,73M² (${stage.stage}) - ${stage.label}`);
    if (trend === "rebound") lines.push("ALERTA: PCR EM REASCENSÃO.");
  } else {
    lines.push("AGUARDA EXAMES LABORATORIAIS.");
  }

  if (hgt && hgt.count > 0) {
    lines.push(`HGT: MÉDIA ${hgt.mean} / PICO ${hgt.peak} / NADIR ${hgt.nadir}`);
  }
  lines.push("");

  lines.push("# 5. AVALIAÇÃO E CONDUTAS (A/P)");
  lines.push("----------------------------------------");
  if (data.conducta?.condutas) {
    lines.push(data.conducta.condutas.toUpperCase());
  } else {
    lines.push("MANTER CONDUTAS ATUAIS. VIGILÂNCIA CLÍNICA.");
  }

  if (data.conducta?.pendencias && data.conducta.pendencias !== "SEM PENDÊNCIAS NO MOMENTO.") {
    lines.push("");
    lines.push("PENDÊNCIAS:");
    lines.push(data.conducta.pendencias.toUpperCase());
  }

  if (data.conducta?.intercorrencias && data.conducta.intercorrencias !== "SEM INTERCORRÊNCIAS.") {
    lines.push("");
    lines.push("INTERCORRÊNCIAS DO PLANTÃO:");
    lines.push(data.conducta.intercorrencias.toUpperCase());
  }

  lines.push("");
  lines.push("=".repeat(40));
  lines.push("EVOLUÇÃO GERADA PELO DOUTOR AJUDA AI");

  return lines.join("\n").toUpperCase();
}
