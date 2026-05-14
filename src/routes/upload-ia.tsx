import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Upload, FileUp, X, ChevronLeft, ArrowRight, Loader2, Camera, FileText } from "lucide-react";
import { startClinicalExtractionJob } from "@/lib/documentExtractor";
import { toast } from "sonner";

export const Route = createFileRoute("/upload-ia")({
  component: UploadIAPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tipo: (search.tipo as string) || "admissao",
      engine: (search.engine as string) || "docling",
      patient_id: (search.patient_id as string) || undefined,
    };
  },
  head: () => ({ meta: [{ title: "Upload IA — DOUTOR AJUDA" }] }),
});

function UploadIAPage() {
  const { tipo, engine, patient_id } = Route.useSearch();
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
    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const jobId = await startClinicalExtractionJob(file);
      localStorage.setItem("doutor_ajuda_job_ativo", jobId);
      localStorage.setItem("doutor_ajuda_job_arquivo", file.name);
      localStorage.setItem("doutor_ajuda_tipo_upload", tipo);
      if (patient_id) {
        localStorage.setItem("doutor_ajuda_job_patient_id", patient_id);
      }
      
      toast.success("Arquivo enviado! Iniciando leitura com IA...");
      nav({ to: "/processando/$jobId", params: { jobId } });
    } catch (err: any) {
      toast.error(`Erro ao iniciar extração: ${err.message}`);
      setIsUploading(false);
    }
  };

  const goBackUrl = patient_id 
    ? `/paciente/${patient_id}`
    : (tipo === "admissao" ? "/admissao-nova" : "/paciente-internado");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="max-w-5xl mx-auto px-6 h-20 w-full flex items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <Link
          to={goBackUrl}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ChevronLeft className="h-4 w-4" /> VOLTAR
        </Link>
        <span className="text-xs font-extrabold tracking-[0.2em] uppercase text-primary">
          IMPORTAR DOCUMENTO
        </span>
        <div className="w-16" />
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 flex-1 w-full flex flex-col items-center justify-center">
        <div className="text-center mb-12">
          <div className={`h-20 w-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg ${engine === 'vision' ? 'bg-primary/10 text-primary' : 'bg-ai/10 text-ai'}`}>
             {engine === 'vision' ? <Camera className="h-10 w-10" /> : <FileText className="h-10 w-10" />}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-4 uppercase">
            {engine === 'vision' ? "CAPTURAR FOTO" : "ENVIAR DOCUMENTO"}
          </h1>
          <p className="text-muted-foreground">
            {engine === 'vision' 
              ? "Tire uma foto nítida do prontuário ou evolução para nossa IA ler."
              : "Faça o upload do PDF, DOCX ou imagem do documento."}
          </p>
        </div>

        <div className="w-full bg-white border border-border rounded-[2.5rem] p-10 shadow-xl relative overflow-hidden">
          <input 
            type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden"
            accept={engine === 'vision' ? "image/*" : ".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,.heic,.heif"}
            capture={engine === 'vision' ? "environment" : undefined}
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
              className="border-2 border-dashed border-border rounded-[2rem] p-16 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center text-muted-foreground mb-6 group-hover:scale-110 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                <Upload className="h-10 w-10" />
              </div>
              <h3 className="font-bold text-xl mb-2">Clique ou arraste aqui</h3>
              <p className="text-sm text-muted-foreground text-center">
                {engine === 'vision' ? "Selecione a foto do prontuário" : "Selecione o arquivo digital"}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 bg-secondary/50 p-6 rounded-2xl border border-border">
                <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <FileUp className="h-8 w-8" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground truncate">{file.name}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
                <button onClick={() => setFile(null)} className="h-10 w-10 rounded-full hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <button
                disabled={isUploading}
                onClick={handleUpload}
                className="w-full py-5 rounded-2xl bg-primary text-primary-foreground font-extrabold uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isUploading ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> ENVIANDO...</>
                ) : (
                  <>PROCESSAR COM IA <ArrowRight className="h-5 w-5" /></>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="mt-12 text-center">
           <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
              SEGURO E PRIVADO · PROCESSAMENTO EM TEMPO REAL
           </p>
        </div>
      </main>
    </div>
  );
}
