import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Upload, FileText, X, FileUp, ClipboardList } from "lucide-react";
import { useState } from "react";
import { addPatient } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/novo-paciente")({
  component: NovoPaciente,
  head: () => ({ meta: [{ title: "Novo Paciente — DOUTOR AJUDA" }] }),
});

function NovoPaciente() {
  const [mode, setMode] = useState<null | "upload" | "manual">(null);
  const nav = useNavigate();

  const [form, setForm] = useState({
    name: "", age: "", sex: "F" as "F" | "M", bed: "", hda: "",
  });

  function submit() {
    if (!form.name || !form.age || !form.bed) {
      toast.error("Preencha nome, idade e leito");
      return;
    }
    const p = addPatient({
      name: form.name.toUpperCase(),
      age: Number(form.age),
      sex: form.sex,
      bed: form.bed.toUpperCase(),
      sector: form.sex === "F" ? "CLÍNICA MÉDICA FEMININA" : "CLÍNICA MÉDICA MASCULINA",
      admission: new Date().toISOString().slice(0, 10),
      hda: form.hda.toUpperCase(),
    });
    toast.success("Paciente cadastrado");
    nav({ to: "/evolucao/$id", params: { id: p.id } });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-destructive">
          <X className="h-4 w-4" /> CANCELAR CADASTRO
        </Link>
        <span className="label-tech">NOVO PACIENTE</span>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-20">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">CADASTRO DE NOVO PACIENTE</h1>
        <p className="text-muted-foreground mt-2">Escolha como deseja iniciar o registro do paciente</p>

        {!mode && (
          <div className="grid md:grid-cols-2 gap-5 mt-10">
            <button onClick={() => setMode("upload")} className="text-left bg-card border border-border rounded-2xl p-7 hover:-translate-y-1 hover:shadow-xl hover:shadow-ai/10 hover:border-ai/40 transition-all">
              <div className="h-14 w-14 rounded-xl bg-ai/10 grid place-items-center text-ai">
                <FileUp className="h-7 w-7" />
              </div>
              <h3 className="mt-5 font-bold text-foreground uppercase tracking-tight">UPLOAD DE ARQUIVO</h3>
              <p className="text-xs text-muted-foreground mt-2 uppercase tracking-wide">PDF / WORD / TXT / IMG</p>
              <p className="text-sm text-muted-foreground mt-3">Importe o sumário de alta, prontuário ou foto do prontuário.</p>
            </button>
            <button onClick={() => setMode("manual")} className="text-left bg-card border border-border rounded-2xl p-7 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/40 transition-all">
              <div className="h-14 w-14 rounded-xl bg-primary/10 grid place-items-center text-primary">
                <ClipboardList className="h-7 w-7" />
              </div>
              <h3 className="mt-5 font-bold text-foreground uppercase tracking-tight">PREENCHIMENTO MANUAL</h3>
              <p className="text-xs text-muted-foreground mt-2 uppercase tracking-wide">CAIXAS DE MARCAR / TEXTO</p>
              <p className="text-sm text-muted-foreground mt-3">Cadastre o paciente preenchendo o formulário estruturado.</p>
            </button>
          </div>
        )}

        {mode === "upload" && (
          <div className="mt-10 bg-card border border-border rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold uppercase tracking-tight">UPLOAD DE ARQUIVO</h3>
              <button onClick={() => setMode(null)} className="label-tech hover:text-foreground">VOLTAR</button>
            </div>
            <div className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-ai/50 transition-colors">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="mt-4 font-bold uppercase tracking-tight">ARRASTE O ARQUIVO AQUI</p>
              <p className="text-xs text-muted-foreground mt-2 uppercase tracking-wide">PDF · DOCX · TXT · JPG · PNG</p>
              <button className="mt-5 px-5 py-2 rounded-lg bg-ai text-ai-foreground text-xs font-bold uppercase tracking-wide">SELECIONAR ARQUIVO</button>
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-center">FUNCIONALIDADE VISUAL — IA SERÁ CONECTADA EM ETAPA POSTERIOR</p>
          </div>
        )}

        {mode === "manual" && (
          <div className="mt-10 bg-card border border-border rounded-2xl p-8 space-y-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold uppercase tracking-tight">PREENCHIMENTO MANUAL</h3>
              <button onClick={() => setMode(null)} className="label-tech hover:text-foreground">VOLTAR</button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Field label="NOME COMPLETO">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-input-bg border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 uppercase" />
              </Field>
              <Field label="IDADE">
                <input value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} type="number"
                  className="w-full bg-input-bg border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </Field>
              <Field label="SEXO">
                <div className="flex bg-input-bg border border-border rounded-lg p-1">
                  {(["F", "M"] as const).map((s) => (
                    <button key={s} onClick={() => setForm({ ...form, sex: s })}
                      className={`flex-1 py-2 rounded-md text-xs font-bold tracking-wide ${form.sex === s ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                      {s === "F" ? "FEMININO" : "MASCULINO"}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="LEITO">
                <input value={form.bed} onChange={(e) => setForm({ ...form, bed: e.target.value })} placeholder="L05"
                  className="w-full bg-input-bg border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 uppercase" />
              </Field>
            </div>

            <Field label="HISTÓRIA DA DOENÇA ATUAL">
              <textarea value={form.hda} onChange={(e) => setForm({ ...form, hda: e.target.value })} rows={5}
                className="w-full bg-input-bg border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed" />
            </Field>

            <button onClick={submit} className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-wide hover:bg-primary/90 transition-colors">
              <FileText className="inline h-4 w-4 mr-2" /> CADASTRAR MANUALMENTE
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-tech block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
