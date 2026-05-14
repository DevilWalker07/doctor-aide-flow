import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Upload, FileUp, X, ChevronLeft, ArrowRight, Loader2, ClipboardList, FileText } from "lucide-react";
import { startClinicalExtractionJob } from "@/lib/documentExtractor";
import { toast } from "sonner";

export const Route = createFileRoute("/paciente-internado")({
  component: PacienteInternadoPage,
  head: () => ({ meta: [{ title: "Paciente Internado — DOUTOR AJUDA" }] }),
});

function PacienteInternadoPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<null | "upload" | "manual">(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > 20 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 20MB.");
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif"
    ];

    if (!allowedTypes.includes(selected.type) && 
        !selected.name.endsWith(".docx") && 
        !selected.name.endsWith(".heic") && 
        !selected.name.endsWith(".heif")) {
      toast.error("Formato de arquivo não suportado.");
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

  if (!mode) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="max-w-5xl mx-auto px-6 h-20 w-full flex items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
          <Link to="/novo-paciente" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group">
            <ChevronLeft className="h-4 w-4" /> VOLTAR
          </Link>
          <span className="text-xs font-extrabold tracking-[0.2em] uppercase text-primary">PACIENTE INTERNADO</span>
          <div className="w-16" />
        </header>

        <main className="max-w-4xl mx-auto px-6 py-12 flex-1 w-full flex flex-col items-center justify-center">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-4 uppercase">PACIENTE JÁ INTERNADO</h1>
            <p className="text-muted-foreground">Como você deseja realizar o cadastro?</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
            <button
              onClick={() => setMode("upload")}
              className="group relative bg-white border border-border rounded-[2.5rem] p-10 text-left transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-ai/20 hover:border-ai/40 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-ai/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-20 w-20 rounded-2xl bg-ai/10 flex items-center justify-center text-ai mb-8 group-hover:scale-110 transition-transform duration-500">
                <FileUp className="h-10 w-10" />
              </div>
              <h3 className="relative font-extrabold text-foreground tracking-tight text-2xl mb-4 text-ai">UPLOAD DE DOCUMENTO</h3>
              <p className="relative text-sm text-muted-foreground leading-relaxed mb-4">Extração automática de dados a partir de fotos, PDF ou Word.</p>
              <div className="relative flex items-center gap-2 text-ai text-xs font-bold uppercase tracking-widest mt-auto">
                Importar arquivo <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <button
              onClick={() => setMode("manual")}
              className="group relative bg-white border border-border rounded-[2.5rem] p-10 text-left transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/20 hover:border-primary/40 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-8 group-hover:scale-110 transition-transform duration-500">
                <ClipboardList className="h-10 w-10" />
              </div>
              <h3 className="relative font-extrabold text-foreground tracking-tight text-2xl mb-4">PREENCHER MANUALMENTE</h3>
              <p className="relative text-sm text-muted-foreground leading-relaxed mb-4">Inserir dados clínicos manualmente no formulário estruturado.</p>
              <div className="relative flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-widest mt-auto">
                Preencher formulário <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (mode === "manual") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="max-w-5xl mx-auto px-6 h-20 w-full flex items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
          <button onClick={() => setMode(null)} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group">
            <ChevronLeft className="h-4 w-4" /> VOLTAR
          </button>
          <span className="text-xs font-extrabold tracking-[0.2em] uppercase text-primary">CADASTRO MANUAL</span>
          <div className="w-16" />
        </header>
        <main className="max-w-4xl mx-auto px-6 py-12 flex-1 w-full flex flex-col items-center justify-center">
          <div className="text-center p-20 bg-white border border-border rounded-[3rem] shadow-xl">
             <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
                <FileText className="h-10 w-10 text-muted-foreground" />
             </div>
             <h2 className="text-2xl font-bold mb-4">Formulário Manual</h2>
             <p className="text-muted-foreground">Esta funcionalidade estará disponível em breve na Fase 2.</p>
             <button onClick={() => setMode(null)} className="mt-8 px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-widest">VOLTAR</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="max-w-5xl mx-auto px-6 h-20 w-full flex items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <button onClick={() => setMode(null)} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group">
          <ChevronLeft className="h-4 w-4" /> VOLTAR
        </button>
        <span className="text-xs font-extrabold tracking-[0.2em] uppercase text-primary">UPLOAD DE DOCUMENTO</span>
        <div className="w-16" />
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 flex-1 w-full flex flex-col items-center justify-center">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-4 uppercase">UPLOAD DE DOCUMENTO</h1>
          <p className="text-muted-foreground">Envie o prontuário ou evolução para extração dos dados.</p>
        </div>

        <div className="w-full bg-white border border-border rounded-[2rem] p-10 shadow-xl">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
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
              className="border-2 border-dashed border-border rounded-3xl p-16 flex flex-col items-center justify-center cursor-pointer hover:border-ai/50 hover:bg-ai/5 transition-all group"
            >
              <div className="h-20 w-20 rounded-full bg-ai/10 flex items-center justify-center text-ai mb-6 group-hover:scale-110 transition-transform">
                <Upload className="h-10 w-10" />
              </div>
              <h3 className="font-bold text-xl mb-2">Selecione o arquivo</h3>
              <p className="text-sm text-muted-foreground text-center">Arraste e solte o documento aqui ou clique para selecionar.</p>
              <p className="mt-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">PDF, DOCX, TXT, Imagens (Máx 20MB)</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 bg-secondary/50 p-6 rounded-2xl border border-border">
                <div className="h-16 w-16 rounded-xl bg-ai/10 flex items-center justify-center text-ai">
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
                className="w-full py-5 rounded-2xl bg-ai text-ai-foreground font-bold uppercase tracking-widest shadow-xl shadow-ai/20 hover:shadow-ai/40 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-3"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" /> ENVIANDO...
                  </>
                ) : (
                  <>
                    ENVIAR PARA IA <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
