import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Upload, FileUp, X, ChevronLeft, ArrowRight, Loader2, ClipboardList, FileText, User, Bed, Stethoscope, Activity, Save } from "lucide-react";
import { startClinicalExtractionJob } from "@/lib/documentExtractor";
import { addPatient } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/admissao-nova")({
  component: AdmissaoNovaPage,
  head: () => ({ meta: [{ title: "Admissão Nova — DOUTOR AJUDA" }] }),
});

function AdmissaoNovaPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<null | "upload" | "manual">(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Form State
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    nome: "", idade: "", sexo: "F" as "F" | "M",
    leito: "", setor: "CLÍNICA MÉDICA",
    data_admissao: today,
    motivo: "", hda: "",
    comorbidades: "", alergias: "",
    medicacoes: "", exameFisico: "", condutas: "",
  });

  const handleFieldChange = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleManualSave = async () => {
    if (!form.nome || !form.leito) {
      toast.error("Preencha ao menos o nome e o leito.");
      return;
    }

    try {
      await addPatient({
        name: form.nome.toUpperCase(),
        age: Number(form.idade) || 0,
        sex: form.sexo,
        bed: form.leito.toUpperCase(),
        sector: form.setor.toUpperCase(),
        admission: form.data_admissao,
        admissionDate: form.data_admissao,
        hda: form.hda.toUpperCase(),
        diagnoses: form.motivo ? [form.motivo.toUpperCase()] : [],
        data: {
          conducta: { condutas: form.condutas },
          exam: { ect: form.exameFisico }
        }
      });
      toast.success("Paciente admitido com sucesso!");
      nav({ to: "/dashboard" });
    } catch (err: any) {
      toast.error("Erro ao salvar paciente.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > 20 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 20MB.");
      return;
    }
    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const jobId = await startClinicalExtractionJob(file);
      localStorage.setItem("doutor_ajuda_job_ativo", jobId);
      localStorage.setItem("doutor_ajuda_job_arquivo", file.name);
      nav({ to: "/processando/$jobId", params: { jobId } });
    } catch (err: any) {
      toast.error(`Erro ao iniciar extração: ${err.message}`);
      setIsUploading(false);
    }
  };

  // 1. SELECTION SCREEN
  if (!mode) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="max-w-5xl mx-auto px-6 h-20 w-full flex items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
          <Link to="/novo-paciente" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group">
            <ChevronLeft className="h-4 w-4" /> VOLTAR
          </Link>
          <span className="text-xs font-extrabold tracking-[0.2em] uppercase text-primary">ADMISSÃO NOVA</span>
          <div className="w-16" />
        </header>

        <main className="max-w-4xl mx-auto px-6 py-12 flex-1 w-full flex flex-col items-center justify-center">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-4 uppercase">ADMISSÃO DE PACIENTE</h1>
            <p className="text-muted-foreground">Escolha como deseja realizar a admissão do novo paciente.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
            <button
              onClick={() => setMode("upload")}
              className="group relative bg-white border border-border rounded-[2.5rem] p-10 text-left transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/20 hover:border-primary/40 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-8 group-hover:scale-110 transition-transform duration-500">
                <FileUp className="h-10 w-10" />
              </div>
              <h3 className="relative font-extrabold text-foreground tracking-tight text-2xl mb-4">UPLOAD DE DOCUMENTO</h3>
              <p className="relative text-sm text-muted-foreground leading-relaxed mb-4">Admitir usando documento de entrada, foto ou PDF.</p>
              <div className="relative flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-widest mt-auto">
                Importar arquivo <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <button
              onClick={() => setMode("manual")}
              className="group relative bg-white border border-border rounded-[2.5rem] p-10 text-left transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-ai/20 hover:border-ai/40 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-ai/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-20 w-20 rounded-2xl bg-ai/10 flex items-center justify-center text-ai mb-8 group-hover:scale-110 transition-transform duration-500">
                <ClipboardList className="h-10 w-10" />
              </div>
              <h3 className="relative font-extrabold text-foreground tracking-tight text-2xl mb-4 text-ai">PREENCHER MANUALMENTE</h3>
              <p className="relative text-sm text-muted-foreground leading-relaxed mb-4">Preencher os dados do paciente manualmente no formulário.</p>
              <div className="relative flex items-center gap-2 text-ai text-xs font-bold uppercase tracking-widest mt-auto">
                Abrir formulário <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </main>
      </div>
    );
  }

  // 2. MANUAL FORM SCREEN
  if (mode === "manual") {
    return (
      <div className="min-h-screen bg-background pb-32">
        <header className="max-w-5xl mx-auto px-6 h-20 w-full flex items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
          <button onClick={() => setMode(null)} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group">
            <ChevronLeft className="h-4 w-4" /> VOLTAR
          </button>
          <span className="text-xs font-extrabold tracking-[0.2em] uppercase text-primary">CADASTRO MANUAL</span>
          <div className="w-16" />
        </header>

        <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">
          <Section title="IDENTIFICAÇÃO" icon={<User className="h-5 w-5" />}>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">NOME COMPLETO</label>
                <input value={form.nome} onChange={(e) => handleFieldChange('nome', e.target.value)} className={inputCls} placeholder="Ex: João da Silva" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">IDADE</label>
                  <input type="number" value={form.idade} onChange={(e) => handleFieldChange('idade', e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">SEXO</label>
                  <div className="flex bg-secondary/50 rounded-xl p-1 h-[50px]">
                    {["F", "M"].map(s => (
                      <button 
                        key={s} 
                        onClick={() => handleFieldChange('sexo', s)}
                        className={`flex-1 rounded-lg text-xs font-bold transition-all ${form.sexo === s ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`}
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
                <input value={form.leito} onChange={(e) => handleFieldChange('leito', e.target.value.toUpperCase())} className={inputCls} placeholder="Ex: L12" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">SETOR</label>
                <input value={form.setor} onChange={(e) => handleFieldChange('setor', e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">DATA ADMISSÃO</label>
                <input type="date" value={form.data_admissao} onChange={(e) => handleFieldChange('data_admissao', e.target.value)} className={inputCls} />
              </div>
            </div>
          </Section>

          <Section title="HISTÓRIA CLÍNICA" icon={<Stethoscope className="h-5 w-5" />}>
             <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">MOTIVO / DIAGNÓSTICO</label>
                  <input value={form.motivo} onChange={(e) => handleFieldChange('motivo', e.target.value)} className={inputCls} placeholder="Ex: Pneumonia aspirativa" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">HDA</label>
                  <textarea value={form.hda} onChange={(e) => handleFieldChange('hda', e.target.value)} rows={5} className={textareaCls} placeholder="Descreva o quadro clínico..." />
                </div>
             </div>
          </Section>

          <Section title="EXAME FÍSICO E CONDUTAS" icon={<Activity className="h-5 w-5" />}>
             <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">EXAME FÍSICO INICIAL</label>
                  <textarea value={form.exameFisico} onChange={(e) => handleFieldChange('exameFisico', e.target.value)} rows={3} className={textareaCls} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest ml-1">CONDUTAS INICIAIS</label>
                  <textarea value={form.condutas} onChange={(e) => handleFieldChange('condutas', e.target.value)} rows={3} className={textareaCls} />
                </div>
             </div>
          </Section>

          <footer className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border p-6 z-40">
            <div className="max-w-4xl mx-auto flex gap-4">
              <button onClick={() => setMode(null)} className="flex-1 py-4 px-6 rounded-2xl border border-border font-bold uppercase tracking-widest text-xs text-muted-foreground hover:bg-secondary transition-all">
                CANCELAR
              </button>
              <button onClick={handleManualSave} className="flex-[2] py-4 px-8 rounded-2xl bg-primary text-primary-foreground font-extrabold uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 transition-all flex items-center justify-center gap-3">
                <Save className="h-4 w-4" /> SALVAR PACIENTE
              </button>
            </div>
          </footer>
        </main>
      </div>
    );
  }

  // 3. UPLOAD SCREEN
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="max-w-5xl mx-auto px-6 h-20 w-full flex items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <button onClick={() => setMode(null)} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group">
          <ChevronLeft className="h-4 w-4" /> VOLTAR
        </button>
        <span className="text-xs font-extrabold tracking-[0.2em] uppercase text-primary">UPLOAD ADMISSÃO</span>
        <div className="w-16" />
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 flex-1 w-full flex flex-col items-center justify-center">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-4 uppercase">UPLOAD DE DOCUMENTO</h1>
          <p className="text-muted-foreground">Faça o upload do documento de admissão para extrairmos os dados com IA.</p>
        </div>

        <div className="w-full bg-white border border-border rounded-[2rem] p-10 shadow-xl">
          <input 
            type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden"
            accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,.heic,.heif"
          />

          {!file ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dropped = e.dataTransfer.files[0];
                if (dropped) handleFileChange({ target: { files: [dropped] } } as any);
              }}
              className="border-2 border-dashed border-border rounded-3xl p-16 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
                <Upload className="h-10 w-10" />
              </div>
              <h3 className="font-bold text-xl mb-2">Selecione o arquivo</h3>
              <p className="text-sm text-muted-foreground text-center">Arraste e solte o documento aqui ou clique para selecionar.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 bg-secondary/50 p-6 rounded-2xl border border-border">
                <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <FileUp className="h-8 w-8" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
                <button onClick={() => setFile(null)} className="h-10 w-10 rounded-full hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <button
                disabled={isUploading}
                onClick={handleUpload}
                className="w-full py-5 rounded-2xl bg-primary text-primary-foreground font-bold uppercase tracking-widest shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isUploading ? <><Loader2 className="h-6 w-6 animate-spin" /> ENVIANDO...</> : <>ENVIAR PARA IA <ArrowRight className="h-5 w-5" /></>}
              </button>
            </div>
          )}
        </div>
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
        <h2 className="text-xs font-extrabold tracking-[0.25em] uppercase text-foreground">{title}</h2>
      </div>
      <div className="bg-white border border-border rounded-[3rem] p-8 md:p-12 shadow-sm space-y-10">
        {children}
      </div>
    </div>
  );
}

const inputCls = "w-full bg-secondary/40 border border-border rounded-xl px-5 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all";
const textareaCls = "w-full bg-secondary/40 border border-border rounded-2xl px-5 py-5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 leading-relaxed transition-all";
