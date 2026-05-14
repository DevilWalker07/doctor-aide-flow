import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { loadPendingExtraction, clearExtractionSession, type ClinicalExtractionResult } from "@/lib/documentExtractor";
import { addPatient } from "@/lib/store";
import { useEffect, useState } from "react";
import {
  CheckCircle2, AlertCircle, RefreshCw, X, Save,
  User, Bed, Stethoscope, FlaskConical, ClipboardList, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/revisar-extracao")({
  component: RevisarExtracao,
  head: () => ({ meta: [{ title: "Revisar Extração — DOUTOR AJUDA" }] }),
});

// Editable state mirrors ClinicalExtractionResult with all string fields
interface EditableData {
  nome: string;
  idade: string;
  sexo: string;
  leito: string;
  setor: string;
  data_admissao: string;
  hda: string;
  lista_de_problemas: string;
  antibioticos: string;
  medicacoes: string;
  laboratorios: string;
  exame_fisico: string;
  condutas: string;
  pendencias: string;
  alertas: string;
}

function toEditableData(r: ClinicalExtractionResult): EditableData {
  const join = (arr: string[] | null | undefined) => (arr || []).join("\n");
  return {
    nome: r.nome || "",
    idade: r.idade !== null && r.idade !== undefined ? String(r.idade) : "",
    sexo: r.sexo || "",
    leito: r.leito || "",
    setor: r.setor || "",
    data_admissao: r.data_admissao || "",
    hda: r.hda || "",
    lista_de_problemas: join(r.lista_de_problemas),
    antibioticos: join(r.antibioticos),
    medicacoes: join(r.medicacoes),
    laboratorios: join(r.laboratorios),
    exame_fisico: r.exame_fisico || "",
    condutas: join(r.condutas),
    pendencias: join(r.pendencias),
    alertas: join(r.alertas),
  };
}

function parseLines(text: string): string[] {
  return text.split("\n").map((s) => s.trim()).filter(Boolean);
}

function RevisarExtracao() {
  const nav = useNavigate();
  const [session, setSession] = useState<ReturnType<typeof loadPendingExtraction>>(null);
  const [form, setForm] = useState<EditableData | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const s = loadPendingExtraction();
    if (!s) {
      toast.error("Nenhum dado de extração encontrado. Retornando ao início.");
      nav({ to: "/novo-paciente" });
      return;
    }
    setSession(s);
    setForm(toEditableData(s.extracted));
  }, [nav]);

  if (!session || !form) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm animate-pulse">Carregando dados da extração...</div>
      </div>
    );
  }

  function setField(key: keyof EditableData, value: string) {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  async function handleSave() {
    if (!form) return;
    if (!form.nome) { toast.error("Informe o nome do paciente."); return; }
    if (!form.leito) { toast.error("Informe o leito do paciente."); return; }

    setIsSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const sex = form.sexo?.toUpperCase().startsWith("M") ? "M" : "F";
      const abx = parseLines(form.antibioticos).map((name) => ({
        name: name.toUpperCase(), dose: "", via: "", freq: "", d0: today, durDays: 7,
      }));

      await addPatient({
        name: form.nome.toUpperCase(),
        age: Number(form.idade) || 0,
        sex,
        bed: form.leito.toUpperCase(),
        sector: (form.setor || "CLÍNICA MÉDICA").toUpperCase(),
        admission: form.data_admissao || today,
        admissionDate: form.data_admissao || today,
        hda: form.hda.toUpperCase(),
        diagnoses: parseLines(form.lista_de_problemas).map((s) => s.toUpperCase()),
        pendingIssues: parseLines(form.pendencias).map((s) => s.toUpperCase()),
        alerts: parseLines(form.alertas).map((s) => s.toUpperCase()),
        data: {
          abx,
          exam: { ect: form.exame_fisico },
          conducta: {
            condutas: form.condutas,
            pendencias: form.pendencias,
          },
          lab: form.laboratorios
            ? {
                date: today,
                raw: {},
                formatted: form.laboratorios,
              }
            : undefined,
        },
      });

      clearExtractionSession();
      toast.success("Paciente salvo com sucesso!");
      nav({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }

  function handleReprocess() {
    clearExtractionSession();
    nav({ to: "/novo-paciente" });
  }

  function handleCancel() {
    if (confirm("Descartar extração e voltar ao início?")) {
      clearExtractionSession();
      nav({ to: "/dashboard" });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-ai/10 text-ai grid place-items-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-tight text-foreground">REVISÃO DE EXTRAÇÃO</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                {session.fileName} · {session.engine}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReprocess}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" /> REPROCESSAR
            </button>
            <button
              onClick={handleCancel}
              className="h-9 w-9 rounded-xl border border-border grid place-items-center text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">

        {/* Banner */}
        <div className="bg-ai/5 border border-ai/20 rounded-2xl p-5 flex gap-4 items-start">
          <AlertCircle className="h-5 w-5 text-ai shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-foreground mb-1">Revise todos os dados antes de salvar</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              A IA pode cometer erros. Confirme nome, leito, medicações e condutas. Somente ao clicar em
              <strong> "SALVAR PACIENTE"</strong> o paciente aparecerá no dashboard.
            </p>
          </div>
        </div>

        {/* IDENTIFICAÇÃO */}
        <Section icon={<User className="h-4 w-4" />} title="IDENTIFICAÇÃO">
          <div className="grid md:grid-cols-2 gap-6">
            <Field label="NOME">
              <input value={form.nome} onChange={(e) => setField("nome", e.target.value)} className={inputCls} placeholder="Nome completo" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="IDADE">
                <input value={form.idade} onChange={(e) => setField("idade", e.target.value)} type="number" className={inputCls} placeholder="Anos" />
              </Field>
              <Field label="LEITO">
                <input value={form.leito} onChange={(e) => setField("leito", e.target.value)} className={inputCls + " uppercase"} placeholder="Ex: L08" />
              </Field>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Field label="SEXO">
              <input value={form.sexo} onChange={(e) => setField("sexo", e.target.value)} className={inputCls} placeholder="M ou F" />
            </Field>
            <Field label="SETOR">
              <input value={form.setor} onChange={(e) => setField("setor", e.target.value)} className={inputCls} />
            </Field>
            <Field label="DATA DE ADMISSÃO">
              <input value={form.data_admissao} onChange={(e) => setField("data_admissao", e.target.value)} type="date" className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* HDA */}
        <Section icon={<Stethoscope className="h-4 w-4" />} title="HISTÓRIA DA DOENÇA ATUAL">
          <Field label="HDA">
            <textarea value={form.hda} onChange={(e) => setField("hda", e.target.value)} rows={5} className={textareaCls} placeholder="Descreva o curso clínico..." />
          </Field>
        </Section>

        {/* Lista de Problemas + Antibióticos */}
        <div className="grid md:grid-cols-2 gap-8">
          <Section icon={<ClipboardList className="h-4 w-4" />} title="LISTA DE PROBLEMAS">
            <Field label="Um problema por linha">
              <textarea value={form.lista_de_problemas} onChange={(e) => setField("lista_de_problemas", e.target.value)} rows={5} className={textareaCls} placeholder="Ex: Pneumonia&#10;HAS&#10;Sepse" />
            </Field>
          </Section>
          <Section icon={<FlaskConical className="h-4 w-4" />} title="ANTIBIÓTICOS">
            <Field label="Um antibiótico por linha">
              <textarea value={form.antibioticos} onChange={(e) => setField("antibioticos", e.target.value)} rows={5} className={textareaCls} placeholder="Ex: Ceftriaxona 1g/dia EV&#10;Metronidazol 500mg 8/8h" />
            </Field>
          </Section>
        </div>

        {/* Medicações + Laboratórios */}
        <div className="grid md:grid-cols-2 gap-8">
          <Section icon={<ClipboardList className="h-4 w-4" />} title="MEDICAÇÕES">
            <Field label="Uma medicação por linha">
              <textarea value={form.medicacoes} onChange={(e) => setField("medicacoes", e.target.value)} rows={5} className={textareaCls} placeholder="Ex: Enalapril 10mg/dia VO&#10;Furosemida 40mg/dia VO" />
            </Field>
          </Section>
          <Section icon={<FlaskConical className="h-4 w-4" />} title="LABORATÓRIOS">
            <Field label="Resultados relevantes (um por linha)">
              <textarea value={form.laboratorios} onChange={(e) => setField("laboratorios", e.target.value)} rows={5} className={textareaCls} placeholder="Ex: Hb 9.2, PCR 84&#10;Creatinina 1.8" />
            </Field>
          </Section>
        </div>

        {/* Exame Físico */}
        <Section icon={<Stethoscope className="h-4 w-4" />} title="EXAME FÍSICO">
          <Field label="EXAME FÍSICO">
            <textarea value={form.exame_fisico} onChange={(e) => setField("exame_fisico", e.target.value)} rows={4} className={textareaCls} placeholder="Ex: PA 120/80 mmHg, FC 88 bpm, MV+ bilateral..." />
          </Field>
        </Section>

        {/* Condutas + Pendências */}
        <div className="grid md:grid-cols-2 gap-8">
          <Section icon={<ClipboardList className="h-4 w-4" />} title="CONDUTAS">
            <Field label="Uma conduta por linha">
              <textarea value={form.condutas} onChange={(e) => setField("condutas", e.target.value)} rows={5} className={textareaCls} placeholder="Ex: Hidratação 500ml SF 0.9%&#10;Solicitar Rx tórax" />
            </Field>
          </Section>
          <Section icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} title="PENDÊNCIAS">
            <Field label="Uma pendência por linha">
              <textarea value={form.pendencias} onChange={(e) => setField("pendencias", e.target.value)} rows={5} className={textareaCls} placeholder="Ex: Aguardar hemocultura&#10;Repetir hemograma amanhã" />
            </Field>
          </Section>
        </div>

        {/* Alertas */}
        <Section icon={<AlertCircle className="h-4 w-4 text-destructive" />} title="ALERTAS">
          <Field label="Um alerta por linha">
            <textarea value={form.alertas} onChange={(e) => setField("alertas", e.target.value)} rows={3} className={textareaCls} placeholder="Ex: Alérgico a penicilina&#10;Insuficiência renal — ajustar doses" />
          </Field>
        </Section>

        {/* Actions */}
        <div className="sticky bottom-0 bg-background/90 backdrop-blur-xl border-t border-border -mx-6 px-6 py-4 flex items-center justify-between gap-4">
          <button
            onClick={handleCancel}
            className="px-6 py-3 rounded-xl border border-border text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-all"
          >
            CANCELAR
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleReprocess}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-ai/30 text-ai text-xs font-bold uppercase tracking-widest hover:bg-ai/5 transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" /> REPROCESSAR
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 disabled:opacity-50 transition-all duration-300"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "SALVANDO..." : "SALVAR PACIENTE"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────
const inputCls = "w-full bg-secondary/40 border border-border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all";
const textareaCls = "w-full bg-secondary/40 border border-border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 leading-relaxed transition-all";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-extrabold tracking-[0.15em] uppercase text-muted-foreground block mb-2 ml-1">{label}</label>
      {children}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-border rounded-[1.5rem] p-6 md:p-8 shadow-sm">
      <div className="flex items-center gap-2.5 mb-6">
        <div className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
        <h2 className="text-[11px] font-extrabold tracking-[0.15em] uppercase text-foreground">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
