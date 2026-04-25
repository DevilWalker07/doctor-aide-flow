import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Upload, FileText, X, FileUp, ClipboardList, ChevronLeft } from "lucide-react";
import { useState } from "react";
import { addPatient } from "@/lib/store";
import { extractBulkPatientsWithAI } from "@/lib/bulkService";
import { toast } from "sonner";

export const Route = createFileRoute("/novo-paciente")({
  component: NovoPaciente,
  head: () => ({ meta: [{ title: "Novo Paciente — DOUTOR AJUDA" }] }),
});

function NovoPaciente() {
  const [mode, setMode] = useState<null | "upload" | "manual">(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const nav = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    name: "", age: "", sex: "F" as "F" | "M", bed: "", hda: "",
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    toast.info(`Lendo ${file.name}...`);

    try {
      let fileText = "";

      if (file.type === "application/pdf") {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let j = 1; j <= pdf.numPages; j++) {
          const page = await pdf.getPage(j);
          const content = await page.getTextContent();
          fileText += content.items.map((item: any) => item.str).join(" ") + "\n";
        }
      } else if (file.name.endsWith(".docx")) {
        const mammoth = (await import("mammoth")).default;
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        fileText = result.value;
      } else if (file.type === "text/plain") {
        fileText = await file.text();
      }

      if (!fileText.trim()) {
        toast.error("Nenhum texto encontrado no arquivo.");
        return;
      }

      toast.info("Enviando para o Médico Virtual (IA)...");
      const patients = await extractBulkPatientsWithAI(fileText, "CLÍNICA MÉDICA", file.name);

      if (!patients || patients.length === 0) {
        toast.error("A IA não encontrou dados de paciente no arquivo.");
        return;
      }

      const p = await addPatient({ ...patients[0], admission: today, hda: patients[0].hda || "" });
      toast.success("Paciente importado com sucesso!");
      nav({ to: "/evolucao/$id", params: { id: p.id } });
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }

  async function submit() {
    if (!form.name || !form.age || !form.bed) {
      toast.error("Preencha nome, idade e leito");
      return;
    }
    const p = await addPatient({
      name: form.name.toUpperCase(),
      age: Number(form.age),
      sex: form.sex,
      bed: form.bed.toUpperCase(),
      sector: form.sex === "F" ? "CLÍNICA MÉDICA FEMININA" : "CLÍNICA MÉDICA MASCULINA",
      admission: today,
      hda: form.hda.toUpperCase(),
    });
    toast.success("Paciente cadastrado com sucesso");
    nav({ to: "/evolucao/$id", params: { id: p.id } });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="max-w-5xl mx-auto px-6 h-20 w-full flex items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group">
          <div className="h-8 w-8 rounded-full border border-border flex items-center justify-center group-hover:bg-secondary transition-colors">
            <X className="h-4 w-4" />
          </div>
          <span className="hidden sm:inline">CANCELAR</span>
        </Link>
        <span className="label-tech text-primary">CADASTRO</span>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 flex-1 w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4">NOVO PACIENTE</h1>
          <p className="text-lg text-muted-foreground">Escolha o método de cadastro para o novo leito</p>
        </div>

        {!mode && (
          <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-3xl mx-auto">
            <button onClick={() => setMode("upload")} className="group text-left bg-white border border-border rounded-[2rem] p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-ai/10 hover:border-ai/40 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-ai/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-16 w-16 rounded-2xl bg-ai/10 flex items-center justify-center text-ai mb-6 group-hover:scale-110 transition-transform duration-500">
                <FileUp className="h-8 w-8" />
              </div>
              <h3 className="relative font-extrabold text-foreground tracking-tight text-lg mb-2">UPLOAD DE ARQUIVO</h3>
              <p className="relative text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">PDF · WORD · TXT</p>
              <p className="relative text-sm text-muted-foreground leading-relaxed">Importe o prontuário ou evolução e deixe a IA preencher os dados automaticamente.</p>
            </button>

            <button onClick={() => setMode("manual")} className="group text-left bg-white border border-border rounded-[2rem] p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/40 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform duration-500">
                <ClipboardList className="h-8 w-8" />
              </div>
              <h3 className="relative font-extrabold text-foreground tracking-tight text-lg mb-2">PREENCHIMENTO MANUAL</h3>
              <p className="relative text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">FORMULÁRIO ESTRUTURADO</p>
              <p className="relative text-sm text-muted-foreground leading-relaxed">Cadastre o paciente preenchendo os dados vitais e de identificação manualmente.</p>
            </button>
          </div>
        )}

        {mode === "upload" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white border border-border rounded-[2rem] p-8 md:p-12 shadow-sm max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <button onClick={() => setMode(null)} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="h-4 w-4" /> VOLTAR
              </button>
              <span className="label-tech text-ai">MÉTODO IA</span>
            </div>

            <h3 className="text-2xl font-extrabold tracking-tight text-foreground mb-6 text-center">UPLOAD DE ARQUIVO</h3>

            {isProcessing ? (
              <div className="border-2 border-ai/30 bg-ai/5 rounded-3xl p-12 text-center">
                <div className="h-16 w-16 rounded-full bg-ai/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <Upload className="h-8 w-8 text-ai animate-spin" />
                </div>
                <p className="font-bold text-sm tracking-widest text-ai uppercase mb-2">MÉDICO VIRTUAL LENDO O ARQUIVO...</p>
                <p className="text-xs text-muted-foreground">Extraindo dados do paciente. Aguarde.</p>
              </div>
            ) : (
              <label className="block border-2 border-dashed border-border rounded-3xl p-12 text-center hover:border-ai/50 hover:bg-ai/5 transition-all duration-300 group cursor-pointer">
                <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Upload className="h-10 w-10 text-muted-foreground group-hover:text-ai transition-colors" />
                </div>
                <p className="font-extrabold text-lg tracking-tight mb-2">ARRASTE O ARQUIVO AQUI</p>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-6">PDF · DOCX · TXT</p>
                <span className="px-8 py-3.5 rounded-xl bg-ai text-ai-foreground text-xs font-bold uppercase tracking-widest shadow-lg shadow-ai/20">
                  SELECIONAR ARQUIVO
                </span>
                <input type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={handleFile} />
              </label>
            )}
          </div>
        )}

        {mode === "manual" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white border border-border rounded-[2rem] p-8 md:p-12 shadow-sm max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <button onClick={() => setMode(null)} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="h-4 w-4" /> VOLTAR
              </button>
              <span className="label-tech text-primary">MANUAL</span>
            </div>

            <h3 className="text-2xl font-extrabold tracking-tight text-foreground mb-8">DADOS DE IDENTIFICAÇÃO</h3>

            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <Field label="NOME COMPLETO">
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Maria da Silva"
                    className="w-full bg-input-bg border border-border rounded-xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 uppercase transition-all" />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="IDADE">
                    <input value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} type="number" placeholder="Ex: 65"
                      className="w-full bg-input-bg border border-border rounded-xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all" />
                  </Field>
                  <Field label="LEITO">
                    <input value={form.bed} onChange={(e) => setForm({ ...form, bed: e.target.value })} placeholder="Ex: L05"
                      className="w-full bg-input-bg border border-border rounded-xl px-4 py-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 uppercase transition-all" />
                  </Field>
                </div>
              </div>

              <Field label="SEXO">
                <div className="flex bg-input-bg border border-border rounded-xl p-1.5 w-full md:w-1/2">
                  {(["F", "M"] as const).map((s) => (
                    <button key={s} onClick={() => setForm({ ...form, sex: s })}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold tracking-widest transition-all ${form.sex === s ? "bg-white text-primary shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}>
                      {s === "F" ? "FEMININO" : "MASCULINO"}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="HISTÓRIA DA DOENÇA ATUAL (OPCIONAL)">
                <textarea value={form.hda} onChange={(e) => setForm({ ...form, hda: e.target.value })} rows={5} placeholder="Descreva brevemente o motivo da internação..."
                  className="w-full bg-input-bg border border-border rounded-xl px-4 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 leading-relaxed transition-all" />
              </Field>

              <div className="pt-6 mt-6 border-t border-border">
                <button onClick={submit} className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-widest shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-3">
                  <FileText className="h-5 w-5" /> CADASTRAR E EVOLUIR
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-tech block mb-2 font-bold ml-1">{label}</label>
      {children}
    </div>
  );
}
