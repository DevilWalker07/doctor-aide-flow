import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Upload, FileText, X, FileUp, ClipboardList, ChevronLeft,
  BedDouble, Stethoscope, Plus, ArrowRight,
} from "lucide-react";
import { useState } from "react";
import { addPatient } from "@/lib/store";
import { startClinicalExtractionJob } from "@/lib/documentExtractor";
import { toast } from "sonner";

export const Route = createFileRoute("/novo-paciente")({
  component: NovoPaciente,
  head: () => ({ meta: [{ title: "Novo Paciente — DOUTOR AJUDA" }] }),
});

// ─── types ──────────────────────────────────────────────────────────────────
type Situation = null | "nova-admissao" | "ja-internado";
type JaInternadoMode = null | "upload" | "manual";

// ─── main component ──────────────────────────────────────────────────────────
function NovoPaciente() {
  const [situation, setSituation] = useState<Situation>(null);
  const [jaMode, setJaMode] = useState<JaInternadoMode>(null);
  const [isUploading, setIsUploading] = useState(false);
  const nav = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  // ── Upload handler ────────────────────────────────────────────────────────
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    toast.info(`Enviando ${file.name} para análise...`);
    try {
      const jobId = await startClinicalExtractionJob(file);
      nav({ to: "/processando/$jobId", params: { jobId } });
    } catch (err: any) {
      toast.error(`Erro ao iniciar extração: ${err.message}`);
      setIsUploading(false);
    }
  }

  // ── Manual admission form state ───────────────────────────────────────────
  const [form, setForm] = useState({
    name: "", age: "", sex: "F" as "F" | "M",
    bed: "", sector: "CLÍNICA MÉDICA",
    admission: today,
    motivo: "", hda: "",
    comorbidades: "", alergias: "",
    medicacoes: "", exameFisico: "", condutas: "",
  });

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveManual() {
    if (!form.name || !form.age || !form.bed) {
      toast.error("Preencha nome, idade e leito.");
      return;
    }
    const hda = [form.motivo, form.hda].filter(Boolean).join(" — ").toUpperCase();
    await addPatient({
      name: form.name.toUpperCase(),
      age: Number(form.age),
      sex: form.sex,
      bed: form.bed.toUpperCase(),
      sector: form.sector.toUpperCase(),
      admission: form.admission || today,
      admissionDate: form.admission || today,
      hda,
      comorbidities: form.comorbidades ? form.comorbidades.split(",").map((s) => s.trim().toUpperCase()) : [],
      diagnoses: form.motivo ? [form.motivo.toUpperCase()] : [],
      alerts: form.alergias ? [`ALERGIA: ${form.alergias.toUpperCase()}`] : [],
      data: {
        conducta: {
          condutas: form.condutas,
          dx: form.motivo,
        },
        exam: { ect: form.exameFisico },
      },
    });
    toast.success("Paciente cadastrado com sucesso!");
    nav({ to: "/dashboard" });
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="max-w-5xl mx-auto px-6 h-20 w-full flex items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group"
        >
          <div className="h-8 w-8 rounded-full border border-border flex items-center justify-center group-hover:bg-secondary transition-colors">
            <X className="h-4 w-4" />
          </div>
          <span className="hidden sm:inline">CANCELAR</span>
        </Link>
        <span className="text-xs font-extrabold tracking-[0.2em] uppercase text-primary">
          NOVO PACIENTE
        </span>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 flex-1 w-full">

        {/* ── STEP 0: Triagem ──────────────────────────────────────────────── */}
        {!situation && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4">
                QUAL É A SITUAÇÃO?
              </h1>
              <p className="text-lg text-muted-foreground">
                Selecione o contexto deste paciente para iniciar o cadastro correto
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {/* Admissão Nova */}
              <button
                type="button"
                onClick={() => { console.log("CLICOU EM ADMISSÃO NOVA"); setSituation("nova-admissao"); }}
                className="group text-left bg-white border border-border rounded-[2rem] p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/40 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="relative h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform duration-500">
                  <Plus className="h-8 w-8" />
                </div>
                <h3 className="relative font-extrabold text-foreground tracking-tight text-xl mb-2">ADMISSÃO NOVA</h3>
                <p className="relative text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">PACIENTE CHEGOU AGORA</p>
                <p className="relative text-sm text-muted-foreground leading-relaxed">
                  Paciente acabou de ser admitido. Vou preencher os dados iniciais de identificação e anamnese.
                </p>
                <div className="relative mt-6 flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-widest">
                  Preencher manualmente <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              {/* Já Internado */}
              <button
                type="button"
                onClick={() => { console.log("CLICOU EM JÁ INTERNADO"); setSituation("ja-internado"); }}
                className="group text-left bg-white border border-border rounded-[2rem] p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-ai/10 hover:border-ai/40 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-ai/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="relative h-16 w-16 rounded-2xl bg-ai/10 flex items-center justify-center text-ai mb-6 group-hover:scale-110 transition-transform duration-500">
                  <BedDouble className="h-8 w-8" />
                </div>
                <h3 className="relative font-extrabold text-foreground tracking-tight text-xl mb-2">PACIENTE JÁ INTERNADO</h3>
                <p className="relative text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">TENHO DOCUMENTO ANTERIOR</p>
                <p className="relative text-sm text-muted-foreground leading-relaxed">
                  Paciente já está internado. Tenho evolução, prescrição, foto ou documento anterior para importar.
                </p>
                <div className="relative mt-6 flex items-center gap-2 text-ai text-xs font-bold uppercase tracking-widest">
                  Upload ou cadastro manual <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 1A: Admissão Nova — Formulário Completo ─────────────────── */}
        {situation === "nova-admissao" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white border border-border rounded-[2rem] p-8 md:p-12 shadow-sm max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <button onClick={() => setSituation(null)} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="h-4 w-4" /> VOLTAR
              </button>
              <span className="text-[10px] font-extrabold tracking-[0.2em] uppercase text-primary">ADMISSÃO NOVA</span>
            </div>

            <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-8">DADOS DO PACIENTE</h2>

            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <Field label="NOME COMPLETO">
                  <input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Ex: Maria da Silva" className={inputCls} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="IDADE">
                    <input value={form.age} onChange={(e) => setField("age", e.target.value)} type="number" placeholder="Ex: 65" className={inputCls} />
                  </Field>
                  <Field label="LEITO">
                    <input value={form.bed} onChange={(e) => setField("bed", e.target.value)} placeholder="Ex: L05" className={inputCls + " uppercase"} />
                  </Field>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Field label="SETOR">
                  <input value={form.sector} onChange={(e) => setField("sector", e.target.value)} placeholder="Ex: Clínica Médica" className={inputCls} />
                </Field>
                <Field label="DATA DE ADMISSÃO">
                  <input value={form.admission} onChange={(e) => setField("admission", e.target.value)} type="date" className={inputCls} />
                </Field>
              </div>

              <Field label="SEXO">
                <div className="flex bg-secondary/50 border border-border rounded-xl p-1.5 w-full md:w-1/2">
                  {(["F", "M"] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setField("sex", s)}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold tracking-widest transition-all ${form.sex === s ? "bg-white text-primary shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"}`}>
                      {s === "F" ? "FEMININO" : "MASCULINO"}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="MOTIVO DA INTERNAÇÃO / DIAGNÓSTICO PRINCIPAL">
                <input value={form.motivo} onChange={(e) => setField("motivo", e.target.value)} placeholder="Ex: Pneumonia adquirida na comunidade" className={inputCls} />
              </Field>

              <Field label="HISTÓRIA DA DOENÇA ATUAL (HDA)">
                <textarea value={form.hda} onChange={(e) => setField("hda", e.target.value)} rows={4} placeholder="Descreva o curso clínico..." className={textareaCls} />
              </Field>

              <div className="grid md:grid-cols-2 gap-6">
                <Field label="COMORBIDADES (separadas por vírgula)">
                  <input value={form.comorbidades} onChange={(e) => setField("comorbidades", e.target.value)} placeholder="Ex: HAS, DM2, FA" className={inputCls} />
                </Field>
                <Field label="ALERGIAS">
                  <input value={form.alergias} onChange={(e) => setField("alergias", e.target.value)} placeholder="Ex: Penicilina, dipirona" className={inputCls} />
                </Field>
              </div>

              <Field label="MEDICAÇÕES EM USO">
                <textarea value={form.medicacoes} onChange={(e) => setField("medicacoes", e.target.value)} rows={3} placeholder="Ex: Enalapril 10mg, Metformina 500mg..." className={textareaCls} />
              </Field>

              <Field label="EXAME FÍSICO INICIAL">
                <textarea value={form.exameFisico} onChange={(e) => setField("exameFisico", e.target.value)} rows={3} placeholder="Ex: PA 120/80, FC 88, MV+ bilateral..." className={textareaCls} />
              </Field>

              <Field label="CONDUTAS INICIAIS">
                <textarea value={form.condutas} onChange={(e) => setField("condutas", e.target.value)} rows={3} placeholder="Ex: Hidratação IV, ceftriaxona 1g/dia..." className={textareaCls} />
              </Field>

              <div className="pt-6 mt-2 border-t border-border">
                <button type="button" onClick={saveManual} className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-widest shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-3">
                  <FileText className="h-5 w-5" /> SALVAR PACIENTE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 1B: Já Internado — Escolha do método ────────────────────── */}
        {situation === "ja-internado" && !jaMode && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-extrabold tracking-tight text-foreground mb-4">PACIENTE JÁ INTERNADO</h1>
              <p className="text-lg text-muted-foreground">Como você quer importar os dados deste paciente?</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              <button
                onClick={() => setJaMode("upload")}
                className="group text-left bg-white border border-border rounded-[2rem] p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-ai/10 hover:border-ai/40 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-ai/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative h-16 w-16 rounded-2xl bg-ai/10 flex items-center justify-center text-ai mb-6 group-hover:scale-110 transition-transform duration-500">
                  <FileUp className="h-8 w-8" />
                </div>
                <h3 className="relative font-extrabold text-foreground tracking-tight text-xl mb-2">UPLOAD DE DOCUMENTO</h3>
                <p className="relative text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">PDF · DOCX · TXT · JPG · PNG</p>
                <p className="relative text-sm text-muted-foreground leading-relaxed">
                  Envie uma evolução, prescrição ou foto do prontuário. A IA extrai os dados e você revisa antes de salvar.
                </p>
              </button>

              <button
                onClick={() => setJaMode("manual")}
                className="group text-left bg-white border border-border rounded-[2rem] p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/40 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform duration-500">
                  <ClipboardList className="h-8 w-8" />
                </div>
                <h3 className="relative font-extrabold text-foreground tracking-tight text-xl mb-2">CADASTRO MANUAL</h3>
                <p className="relative text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">FORMULÁRIO ESTRUTURADO</p>
                <p className="relative text-sm text-muted-foreground leading-relaxed">
                  Preencha os dados clínicos do paciente manualmente no formulário estruturado.
                </p>
              </button>
            </div>

            <div className="mt-6 text-center">
              <button onClick={() => setSituation(null)} className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2">
                <ChevronLeft className="h-3.5 w-3.5" /> VOLTAR
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2B-upload: Upload de documento ──────────────────────────── */}
        {situation === "ja-internado" && jaMode === "upload" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white border border-border rounded-[2rem] p-8 md:p-12 shadow-sm max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <button onClick={() => setJaMode(null)} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="h-4 w-4" /> VOLTAR
              </button>
              <span className="text-[10px] font-extrabold tracking-[0.2em] uppercase text-ai">UPLOAD IA</span>
            </div>

            <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-2 text-center">UPLOAD DE DOCUMENTO</h2>
            <p className="text-xs text-center text-muted-foreground mb-8">
              A IA analisa o documento e você revisa os dados antes de salvar o paciente.
            </p>

            {isUploading ? (
              <div className="border-2 border-ai/30 bg-ai/5 rounded-3xl p-12 text-center">
                <div className="h-16 w-16 rounded-full bg-ai/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <Upload className="h-8 w-8 text-ai animate-spin" />
                </div>
                <p className="font-bold text-sm tracking-widest text-ai uppercase mb-2">ENVIANDO ARQUIVO...</p>
                <p className="text-xs text-muted-foreground">Iniciando análise da IA. Você será redirecionado em instantes.</p>
              </div>
            ) : (
              <label className="block border-2 border-dashed border-border rounded-3xl p-12 text-center hover:border-ai/50 hover:bg-ai/5 transition-all duration-300 group cursor-pointer">
                <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Upload className="h-10 w-10 text-muted-foreground group-hover:text-ai transition-colors" />
                </div>
                <p className="font-extrabold text-lg tracking-tight mb-2">ARRASTE O ARQUIVO AQUI</p>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-6">PDF · DOCX · TXT · JPG · PNG · WEBP · HEIC</p>
                <span className="px-8 py-3.5 rounded-xl bg-ai text-ai-foreground text-xs font-bold uppercase tracking-widest shadow-lg shadow-ai/20">
                  SELECIONAR ARQUIVO
                </span>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,.heic,.heif"
                  className="hidden"
                  onChange={handleFile}
                />
              </label>
            )}
          </div>
        )}

        {/* ── STEP 2B-manual: Cadastro manual (já internado) ───────────────── */}
        {situation === "ja-internado" && jaMode === "manual" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white border border-border rounded-[2rem] p-8 md:p-12 shadow-sm max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <button onClick={() => setJaMode(null)} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="h-4 w-4" /> VOLTAR
              </button>
              <span className="text-[10px] font-extrabold tracking-[0.2em] uppercase text-primary">CADASTRO MANUAL</span>
            </div>

            <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-8">DADOS DO PACIENTE</h2>

            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <Field label="NOME COMPLETO">
                  <input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Ex: João Silva" className={inputCls} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="IDADE">
                    <input value={form.age} onChange={(e) => setField("age", e.target.value)} type="number" placeholder="Ex: 67" className={inputCls} />
                  </Field>
                  <Field label="LEITO">
                    <input value={form.bed} onChange={(e) => setField("bed", e.target.value)} placeholder="Ex: L08" className={inputCls + " uppercase"} />
                  </Field>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Field label="SETOR">
                  <input value={form.sector} onChange={(e) => setField("sector", e.target.value)} placeholder="Ex: Clínica Médica" className={inputCls} />
                </Field>
                <Field label="DATA DE ADMISSÃO">
                  <input value={form.admission} onChange={(e) => setField("admission", e.target.value)} type="date" className={inputCls} />
                </Field>
              </div>

              <Field label="SEXO">
                <div className="flex bg-secondary/50 border border-border rounded-xl p-1.5 w-full md:w-1/2">
                  {(["F", "M"] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setField("sex", s)}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold tracking-widest transition-all ${form.sex === s ? "bg-white text-primary shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"}`}>
                      {s === "F" ? "FEMININO" : "MASCULINO"}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="DIAGNÓSTICO / MOTIVO DA INTERNAÇÃO">
                <input value={form.motivo} onChange={(e) => setField("motivo", e.target.value)} placeholder="Ex: Pneumonia" className={inputCls} />
              </Field>

              <Field label="HISTÓRIA DA DOENÇA ATUAL (HDA)">
                <textarea value={form.hda} onChange={(e) => setField("hda", e.target.value)} rows={4} placeholder="Descreva o curso clínico..." className={textareaCls} />
              </Field>

              <div className="grid md:grid-cols-2 gap-6">
                <Field label="COMORBIDADES">
                  <input value={form.comorbidades} onChange={(e) => setField("comorbidades", e.target.value)} placeholder="Ex: HAS, DM2" className={inputCls} />
                </Field>
                <Field label="ALERGIAS">
                  <input value={form.alergias} onChange={(e) => setField("alergias", e.target.value)} placeholder="Ex: Penicilina" className={inputCls} />
                </Field>
              </div>

              <Field label="MEDICAÇÕES EM USO">
                <textarea value={form.medicacoes} onChange={(e) => setField("medicacoes", e.target.value)} rows={3} placeholder="Ex: Ceftriaxona 1g/dia EV..." className={textareaCls} />
              </Field>

              <div className="pt-6 mt-2 border-t border-border">
                <button type="button" onClick={saveManual} className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-widest shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-3">
                  <Stethoscope className="h-5 w-5" /> SALVAR PACIENTE
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────
const inputCls = "w-full bg-secondary/40 border border-border rounded-xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all";
const textareaCls = "w-full bg-secondary/40 border border-border rounded-xl px-4 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 leading-relaxed transition-all";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-extrabold tracking-[0.15em] uppercase text-muted-foreground block mb-2 ml-1">{label}</label>
      {children}
    </div>
  );
}
