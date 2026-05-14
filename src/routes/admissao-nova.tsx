import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Upload, FileUp, X, ChevronLeft, ArrowRight, Loader2 } from "lucide-react";
import { startClinicalExtractionJob } from "@/lib/documentExtractor";
import { toast } from "sonner";

export const Route = createFileRoute("/admissao-nova")({
  component: AdmissaoNovaPage,
  head: () => ({ meta: [{ title: "Admissão Nova — DOUTOR AJUDA" }] }),
});

function AdmissaoNovaPage() {
  const nav = useNavigate();
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="max-w-5xl mx-auto px-6 h-20 w-full flex items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <Link to="/novo-paciente" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group">
          <ChevronLeft className="h-4 w-4" /> VOLTAR
        </Link>
        <span className="text-xs font-extrabold tracking-[0.2em] uppercase text-primary">ADMISSÃO NOVA</span>
        <div className="w-16" />
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 flex-1 w-full flex flex-col items-center justify-center">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-4 uppercase">ADMISSÃO NOVA</h1>
          <p className="text-muted-foreground">Faça o upload do documento de admissão para extrairmos os dados com IA.</p>
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
              className="border-2 border-dashed border-border rounded-3xl p-16 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
                <Upload className="h-10 w-10" />
              </div>
              <h3 className="font-bold text-xl mb-2">Selecione o arquivo</h3>
              <p className="text-sm text-muted-foreground text-center">Arraste e solte o documento aqui ou clique para selecionar.</p>
              <p className="mt-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">PDF, DOCX, TXT, Imagens (Máx 20MB)</p>
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
                className="w-full py-5 rounded-2xl bg-primary text-primary-foreground font-bold uppercase tracking-widest shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-3"
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
