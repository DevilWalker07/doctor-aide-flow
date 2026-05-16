import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Upload, FileUp, X, ChevronLeft, ArrowRight, Loader2, Camera, FileText, Layers, User } from "lucide-react";
import { startClinicalExtractionJob, startBulkExtractionJob } from "@/lib/documentExtractor";
import { toast } from "sonner";
import { storage } from "@/lib/storage";

const MAX_BULK = 20;
const MAX_FILE_MB = 20;

export const Route = createFileRoute("/upload-ia")({
  component: UploadIAPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tipo: (search.tipo as string) || "admissao",
      engine: (search.engine as string) || "docling",
      patient_id: (search.patient_id as string) || undefined,
      modo: (search.modo as string) === "lote" ? "lote" : "unico",
    };
  },
  head: () => ({ meta: [{ title: "Upload IA — DOUTOR AJUDA" }] }),
});

function UploadIAPage() {
  const { tipo, engine, patient_id, modo } = Route.useSearch();
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLote = modo === "lote";

  const addFiles = (incoming: File[]) => {
    const valid: File[] = [];
    for (const f of incoming) {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${f.name} excede ${MAX_FILE_MB}MB.`);
        continue;
      }
      valid.push(f);
    }
    const merged = [...files, ...valid].slice(0, MAX_BULK);
    if (files.length + valid.length > MAX_BULK) {
      toast.error(`Máximo de ${MAX_BULK} documentos por lote.`);
    }
    setFiles(merged);
  };

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    if (isLote) {
      addFiles(selected);
    } else {
      const f = selected[0];
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`O arquivo deve ter no máximo ${MAX_FILE_MB}MB.`);
        return;
      }
      setFile(f);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUploadSingle = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const jobId = await startClinicalExtractionJob(file);
      storage.setTipo(tipo);
      storage.setJobArquivo(file.name);
      if (patient_id) storage.setUploadPatientId(patient_id);
      toast.success("Arquivo enviado! Iniciando leitura com IA...");
      nav({ to: "/processando/$jobId", params: { jobId } });
    } catch (err: any) {
      toast.error(`Erro ao iniciar extração: ${err.message}`);
      setIsUploading(false);
    }
  };

  const handleUploadBulk = async () => {
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      const bulkJobId = await startBulkExtractionJob(files);
      toast.success(`Lote de ${files.length} documentos enviado.`);
      nav({ to: "/passagem-massa/$bulkJobId", params: { bulkJobId } });
    } catch (err: any) {
      toast.error(`Erro ao iniciar lote: ${err.message}`);
      setIsUploading(false);
    }
  };

  const switchModo = (next: "unico" | "lote") => {
    nav({ to: "/upload-ia", search: { tipo, engine, patient_id, modo: next } });
  };

  const goBackUrl = patient_id
    ? `/paciente/${patient_id}`
    : (tipo === "admissao" ? "/admissao-nova" : "/paciente-internado");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="max-w-5xl mx-auto px-6 h-20 w-full flex items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <Link to={goBackUrl} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group">
          <ChevronLeft className="h-4 w-4" /> VOLTAR
        </Link>
        <span className="text-xs font-extrabold tracking-[0.2em] uppercase text-primary">
          IMPORTAR {isLote ? "PLANTÃO" : "DOCUMENTO"}
        </span>
        <div className="w-16" />
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 flex-1 w-full flex flex-col items-center">
        <div className="w-full mb-8 flex gap-2 p-1 rounded-2xl border border-border bg-white" role="tablist" aria-label="Modo de upload">
          <button
            onClick={() => switchModo("unico")}
            role="tab"
            aria-selected={!isLote}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${!isLote ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-secondary"}`}
          >
            <User className="h-3 w-3" /> Um paciente
          </button>
          <button
            onClick={() => switchModo("lote")}
            role="tab"
            aria-selected={isLote}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isLote ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-secondary"}`}
          >
            <Layers className="h-3 w-3" /> Plantão inteiro (até {MAX_BULK})
          </button>
        </div>

        <div className="text-center mb-10">
          <div className={`h-20 w-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg ${engine === 'vision' ? 'bg-primary/10 text-primary' : 'bg-ai/10 text-ai'}`}>
             {isLote ? <Layers className="h-10 w-10" /> : engine === 'vision' ? <Camera className="h-10 w-10" /> : <FileText className="h-10 w-10" />}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-4 uppercase">
            {isLote ? "PASSAGEM DE PLANTÃO" : engine === 'vision' ? "CAPTURAR FOTO" : "ENVIAR DOCUMENTO"}
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            {isLote
              ? `Arraste até ${MAX_BULK} documentos (evoluções, prescrições). A IA extrai cada paciente, ranqueia por gravidade e monta a passagem.`
              : engine === 'vision'
                ? "Tire uma foto nítida do prontuário ou evolução para nossa IA ler."
                : "Faça o upload do PDF, DOCX ou imagem do documento."}
          </p>
        </div>

        <div className="w-full bg-white border border-border rounded-[2.5rem] p-10 shadow-xl">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple={isLote}
            accept={engine === 'vision' && !isLote ? "image/*" : ".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,.heic,.heif"}
            capture={engine === 'vision' && !isLote ? "environment" : undefined}
          />

          {isLote ? (
            <BulkSection
              files={files}
              onPick={() => fileInputRef.current?.click()}
              onDrop={(dropped) => addFiles(Array.from(dropped))}
              onRemove={removeFile}
              onUpload={handleUploadBulk}
              isUploading={isUploading}
            />
          ) : !file ? (
            <DropZone
              onPick={() => fileInputRef.current?.click()}
              onDrop={(dropped) => {
                const first = dropped[0];
                if (first) {
                  if (first.size > MAX_FILE_MB * 1024 * 1024) {
                    toast.error(`O arquivo deve ter no máximo ${MAX_FILE_MB}MB.`);
                    return;
                  }
                  setFile(first);
                }
              }}
              label={engine === 'vision' ? "Selecione a foto do prontuário" : "Selecione o arquivo digital"}
            />
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
                <button onClick={() => setFile(null)} className="h-10 w-10 rounded-full hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-colors" aria-label="Remover arquivo">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <button
                disabled={isUploading}
                onClick={handleUploadSingle}
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

function DropZone({ onPick, onDrop, label }: { onPick: () => void; onDrop: (files: FileList) => void; label: string }) {
  return (
    <div
      onClick={onPick}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) onDrop(e.dataTransfer.files); }}
      className="border-2 border-dashed border-border rounded-[2rem] p-16 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
    >
      <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center text-muted-foreground mb-6 group-hover:scale-110 group-hover:bg-primary/10 group-hover:text-primary transition-all">
        <Upload className="h-10 w-10" />
      </div>
      <h3 className="font-bold text-xl mb-2">Clique ou arraste aqui</h3>
      <p className="text-sm text-muted-foreground text-center">{label}</p>
    </div>
  );
}

function BulkSection({
  files,
  onPick,
  onDrop,
  onRemove,
  onUpload,
  isUploading,
}: {
  files: File[];
  onPick: () => void;
  onDrop: (files: FileList) => void;
  onRemove: (idx: number) => void;
  onUpload: () => void;
  isUploading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div
        onClick={onPick}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) onDrop(e.dataTransfer.files); }}
        className="border-2 border-dashed border-border rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
      >
        <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center text-muted-foreground mb-4 group-hover:scale-110 group-hover:bg-primary/10 group-hover:text-primary transition-all">
          <Upload className="h-8 w-8" />
        </div>
        <h3 className="font-bold text-lg mb-1">Adicionar documentos</h3>
        <p className="text-xs text-muted-foreground text-center">PDF, DOCX, imagem ou foto. Até {MAX_BULK} arquivos.</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center gap-3 bg-secondary/40 px-4 py-3 rounded-xl border border-border">
              <FileUp className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{f.name}</p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{(f.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
              <button onClick={() => onRemove(i)} className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-colors" aria-label={`Remover ${f.name}`}>
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        <span>{files.length} de {MAX_BULK} documentos</span>
        {files.length > 0 && <button onClick={() => files.forEach((_, i) => onRemove(0))} className="hover:text-foreground">Limpar</button>}
      </div>

      <button
        disabled={isUploading || files.length === 0}
        onClick={onUpload}
        className="w-full py-5 rounded-2xl bg-primary text-primary-foreground font-extrabold uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
      >
        {isUploading ? (
          <><Loader2 className="h-5 w-5 animate-spin" /> ENVIANDO LOTE...</>
        ) : (
          <>GERAR PASSAGEM DE PLANTÃO <ArrowRight className="h-5 w-5" /></>
        )}
      </button>
    </div>
  );
}
