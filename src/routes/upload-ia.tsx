import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  Upload,
  FileUp,
  X,
  ChevronLeft,
  ArrowRight,
  Loader2,
  Camera,
  FileText,
} from "lucide-react";
import { startClinicalExtractionJob } from "@/lib/documentExtractor";
import { toast } from "sonner";
import { storage } from "@/lib/storage";

export const Route = createFileRoute("/upload-ia")({
  component: UploadIAPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tipo: (search.tipo as string) || "admissao",
      engine: (search.engine as string) || "docling",
      patient_id: (search.patient_id as string) || undefined,
    };
  },
  head: () => ({ meta: [{ title: "Upload IA — MEDFLUXO" }] }),
});

function UploadIAPage() {
  const { tipo, engine, patient_id } = Route.useSearch();
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  // O envio virou a parte lenta e visível: o arquivo vai direto ao Storage.
  // Sem dizer em que etapa está, quem espera de pé acha que o app travou.
  const [etapa, setEtapa] = useState<"enviando" | "lendo" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Uma só validação para o seletor e para o arrastar-e-soltar. Antes o drop
  // montava um evento falso para reaproveitar o handler do input.
  const selecionarArquivo = (selected: File) => {
    if (selected.size > 20 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 20 MB.");
      return;
    }
    setFile(selected);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) selecionarArquivo(selected);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const jobId = await startClinicalExtractionJob(file, setEtapa);

      // Additional metadata for the flow
      storage.setTipo(tipo);
      storage.setJobArquivo(file.name);
      if (patient_id) {
        storage.setUploadPatientId(patient_id);
      }

      toast.success("Arquivo enviado! Iniciando leitura com IA...");
      nav({ to: "/processando/$jobId", params: { jobId } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido.";
      toast.error(message);
      setIsUploading(false);
      setEtapa(null);
    }
  };

  // As telas intermediárias de triagem foram removidas: o voltar agora leva
  // de volta à escolha única de cadastro.
  const goBackUrl = patient_id ? `/paciente/${patient_id}` : "/novo-paciente";

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="bg-background/90 border-border sticky top-0 z-20 w-full border-b backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            to={goBackUrl}
            aria-label="Voltar"
            className="touch-target border-border bg-card text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl border transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <span className="t-eyebrow text-muted-foreground">Importar documento</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${engine === "vision" ? "bg-primary/10 text-primary" : "bg-ai/10 text-ai"}`}
          >
            {engine === "vision" ? (
              <Camera className="h-7 w-7" aria-hidden="true" />
            ) : (
              <FileText className="h-7 w-7" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="t-display text-foreground">
              {engine === "vision" ? "Fotografar documento" : "Enviar documento"}
            </h1>
            <p className="t-body text-muted-foreground mt-1">
              {engine === "vision"
                ? "Fotografe o prontuário ou a evolução com o texto legível e bem iluminado."
                : "PDF, DOCX, TXT ou imagem, até 20 MB."}
            </p>
          </div>
        </div>

        <div className="bg-card border-border mt-6 rounded-3xl border p-5 sm:p-6">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            data-testid="upload-input"
            accept={
              engine === "vision" ? "image/*" : ".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,.heic,.heif"
            }
            capture={engine === "vision" ? "environment" : undefined}
          />

          {!file ? (
            // Era um <div onClick>: invisível para teclado e leitor de tela.
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dropped = e.dataTransfer.files[0];
                if (dropped) selecionarArquivo(dropped);
              }}
              data-testid="upload-dropzone"
              className="border-border hover:border-primary/60 hover:bg-primary/5 focus-visible:ring-ring flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <div className="bg-secondary text-muted-foreground mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                <Upload className="h-8 w-8" aria-hidden="true" />
              </div>
              <span className="t-title text-foreground">
                {engine === "vision" ? "Tocar para fotografar" : "Escolher arquivo"}
              </span>
              <span className="t-body text-muted-foreground mt-1 text-center">
                {engine === "vision" ? "Abre a câmera do aparelho" : "Ou arraste o arquivo para cá"}
              </span>
            </button>
          ) : (
            <div className="space-y-4">
              <div className="bg-secondary border-border flex items-center gap-4 rounded-2xl border p-4">
                <div className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                  <FileUp className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="t-title text-foreground truncate">{file.name}</p>
                  <p className="t-label text-muted-foreground font-normal">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  aria-label={`Remover ${file.name}`}
                  className="touch-target text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring inline-flex items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <button
                disabled={isUploading}
                onClick={handleUpload}
                data-testid="upload-submit"
                className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-2xl text-base font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />{" "}
                    {etapa === "lendo" ? "Lendo com IA…" : "Enviando arquivo…"}
                  </>
                ) : (
                  <>
                    Ler com IA <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Dizia "SEGURO E PRIVADO". O documento sai do aparelho e vai para um
            provedor de IA — o médico merece saber disso antes de enviar. */}
        <p className="t-body text-muted-foreground mt-6">
          O documento é enviado ao provedor de IA para leitura e não fica armazenado lá. Confira o
          que foi extraído antes de salvar na ficha.
        </p>
      </main>
    </div>
  );
}
