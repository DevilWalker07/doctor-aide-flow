import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiClient";
import {
  ChevronLeft,
  Upload,
  FileText,
  X,
  Loader2,
  Download,
  AlertTriangle,
  CheckCircle2,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/passagem-plantao")({
  component: PassagemPlantaoPage,
  head: () => ({ meta: [{ title: "Passagem de Plantão IA — MEDFLUXO" }] }),
});

type FileStatus = "idle" | "ready" | "error";

interface UploadedFile {
  id: string;
  file: File;
  status: FileStatus;
  errorMsg?: string;
}

const ALLOWED_EXTS = [".docx", ".txt", ".pdf"];

function isAllowed(file: File) {
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  return ALLOWED_EXTS.includes(ext);
}

function PassagemPlantaoPage() {
  const nav = useNavigate();
  const [setor, setSetor] = useState<"CMF" | "CMM" | "CMF/CMM">("CMF/CMM");
  const [data, setData] = useState(format(new Date(), "dd/MM/yyyy"));
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string>("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [stats, setStats] = useState<{ pacientes: number; alertas: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!downloadUrl) return;
    return () => URL.revokeObjectURL(downloadUrl);
  }, [downloadUrl]);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const newEntries: UploadedFile[] = arr.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      status: isAllowed(f) ? "ready" : "error",
      errorMsg: !isAllowed(f) ? `Formato não suportado (use DOCX, TXT ou PDF)` : undefined,
    }));
    setFiles((prev) => {
      const existing = new Set(prev.map((x) => x.file.name));
      const unique = newEntries.filter((e) => !existing.has(e.file.name));
      if (unique.length < newEntries.length) {
        toast.warning("Alguns arquivos duplicados foram ignorados.");
      }
      return [...prev, ...unique];
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleRemove = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setDownloadUrl(null);
    setStats(null);
  };

  const handleClearAll = () => {
    setFiles([]);
    setDownloadUrl(null);
    setStats(null);
    setWarnings([]);
  };

  const readyFiles = files.filter((f) => f.status === "ready");

  const handleGenerate = async () => {
    if (readyFiles.length === 0) {
      toast.error("Adicione pelo menos um arquivo DOCX.");
      return;
    }

    setIsGenerating(true);
    setDownloadUrl(null);
    setStats(null);
    setWarnings([]);

    try {
      const formData = new FormData();
      formData.append("setor", setor);
      formData.append("data", data);
      readyFiles.forEach((f) => formData.append("files", f.file));

      const res = await apiFetch("/api/passagem-plantao/gerar", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        const detalhes = Array.isArray(errJson.details) ? ` (${errJson.details.join("; ")})` : "";
        throw new Error((errJson.message || errJson.error || `HTTP ${res.status}`) + detalhes);
      }

      const pacientesCount = Number(res.headers.get("X-Pacientes-Count") || 0);
      const alertasCount = Number(res.headers.get("X-Alertas-Count") || 0);
      const warningsHeader = res.headers.get("X-File-Warnings");

      if (warningsHeader) {
        let decoded = warningsHeader;
        try {
          decoded = decodeURIComponent(warningsHeader);
        } catch {
          /* header já legível */
        }
        setWarnings(
          decoded
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean),
        );
      }

      setStats({ pacientes: pacientesCount, alertas: alertasCount });

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const filename = `MAPA_PASSAGEM_${setor.replace("/", "-")}_${data.replace(/\//g, "_")}.docx`;

      setDownloadUrl(url);
      setDownloadName(filename);
      toast.success(`Mapa gerado! ${pacientesCount} pacientes, ${alertasCount} alertas.`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar o mapa.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="bg-card border-border sticky top-0 z-30 border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => nav({ to: "/dashboard" })}
              aria-label="Voltar ao plantão"
              className="touch-target border-border text-muted-foreground hover:bg-secondary focus-visible:ring-ring inline-flex items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="t-title text-foreground">Passagem de plantão</h1>
              <p className="t-label text-muted-foreground font-normal">
                Gerar mapa consolidado a partir dos DOCX dos leitos
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
        {/* Config row */}
        <div className="bg-card border-border rounded-3xl border p-5">
          <h2 className="t-title text-foreground mb-4">Configuração do plantão</h2>
          <div className="flex flex-wrap gap-6">
            {/* Setor */}
            <div className="flex flex-col gap-1.5">
              <label className="t-label text-muted-foreground">Setor</label>
              <div className="flex gap-2">
                {(["CMF", "CMM", "CMF/CMM"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSetor(s)}
                    aria-pressed={setor === s}
                    className={`t-label focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center rounded-xl border px-4 transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                      setor === s
                        ? "bg-navy text-navy-foreground border-navy"
                        : "bg-card text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Data */}
            <div className="flex flex-col gap-1.5">
              <label className="t-label text-muted-foreground">Data do Plantão</label>
              <input
                type="text"
                value={data}
                onChange={(e) => setData(e.target.value)}
                placeholder="DD/MM/YYYY"
                className="bg-card border-border text-foreground focus:ring-ring min-h-[2.75rem] w-40 rounded-xl border px-3 text-base focus:ring-2 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
            isDragging
              ? "border-navy bg-navy/5"
              : "border-border hover:border-navy/40 hover:bg-secondary/30"
          }`}
        >
          <Upload className={`h-8 w-8 ${isDragging ? "text-navy" : "text-muted-foreground"}`} />
          <p className="text-sm font-bold text-foreground">
            {isDragging
              ? "Solte os arquivos aqui"
              : "Arraste os DOCX dos leitos ou clique para selecionar"}
          </p>
          <p className="text-xs text-muted-foreground">
            Suporte a DOCX, TXT e PDF — até 30 arquivos — 20MB cada
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".docx,.txt,.pdf"
            className="hidden"
            data-testid="handoff-files"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="bg-card border-border overflow-hidden rounded-3xl border">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
              <span className="t-label text-muted-foreground">
                {readyFiles.length} arquivo{readyFiles.length !== 1 ? "s" : ""} prontos
                {files.length - readyFiles.length > 0 && (
                  <span className="text-destructive ml-2">
                    · {files.length - readyFiles.length} com erro
                  </span>
                )}
              </span>
              <button
                onClick={handleClearAll}
                className="t-label text-muted-foreground hover:text-destructive focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-xl px-2 transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <Trash2 className="h-3 w-3" /> Limpar tudo
              </button>
            </div>
            <ul className="divide-y divide-border max-h-72 overflow-y-auto">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-5 py-3">
                  <FileText
                    className={`h-4 w-4 flex-shrink-0 ${f.status === "error" ? "text-destructive" : "text-navy"}`}
                  />
                  <span className="flex-1 text-xs font-medium truncate">{f.file.name}</span>
                  <span className="t-label text-muted-foreground font-normal">
                    {(f.file.size / 1024).toFixed(0)} KB
                  </span>
                  {f.status === "error" && (
                    <span className="t-label text-destructive font-normal">{f.errorMsg}</span>
                  )}
                  {f.status === "ready" && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                  )}
                  <button
                    onClick={() => handleRemove(f.id)}
                    className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="t-body text-foreground mb-1">Arquivos com problema (ignorados):</p>
              <ul className="space-y-0.5">
                {warnings.map((w, i) => (
                  <li key={i} className="text-xs text-amber-700">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Generate / Download */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || readyFiles.length === 0}
            data-testid="handoff-generate"
            className="bg-navy text-navy-foreground focus-visible:ring-ring inline-flex min-h-[3rem] flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                Processando {readyFiles.length} leito{readyFiles.length !== 1 ? "s" : ""}…
              </>
            ) : (
              <>
                <FileText className="h-5 w-5" aria-hidden="true" />
                Gerar mapa ({readyFiles.length} leito
                {readyFiles.length !== 1 ? "s" : ""})
              </>
            )}
          </button>

          {downloadUrl && (
            <a
              href={downloadUrl}
              download={downloadName}
              data-testid="handoff-download"
              className="focus-visible:ring-ring inline-flex min-h-[3rem] flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-bold text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
            >
              <Download className="h-5 w-5" aria-hidden="true" />
              Baixar DOCX
              {stats && (
                <span className="t-label ml-1 font-normal text-emerald-50">
                  ({stats.pacientes} pac · {stats.alertas} alertas)
                </span>
              )}
            </a>
          )}
        </div>

        {/* How to use */}
        {files.length === 0 && (
          <div className="bg-card border-border rounded-3xl border p-5">
            <h3 className="t-title text-foreground mb-3">Como usar</h3>
            <ol className="space-y-2">
              {[
                "Selecione o setor (CMF, CMM ou ambos) e a data do plantão",
                "Arraste ou selecione os arquivos DOCX de cada leito (evoluções/prescrições do dia)",
                'Clique em "Gerar Mapa de Passagem"',
                "Aguarde o processamento — a IA extrai e consolida todos os leitos",
                "Baixe o DOCX gerado com o mapa completo + tabela de alertas críticos",
              ].map((step, i) => (
                <li key={i} className="t-body text-muted-foreground flex gap-3">
                  <span className="bg-navy text-navy-foreground t-label mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="mt-4 pt-4 border-t border-navy/10">
              <p className="t-eyebrow text-muted-foreground mb-2">
                Protocolos aplicados automaticamente
              </p>
              <ul className="grid grid-cols-2 gap-1">
                {[
                  "Cockcroft-Gault (Cr nova)",
                  "Suspensão metformina no internamento",
                  "Proteção antiparkinsonianos",
                  "Alerta alfa-bloqueador em idosos",
                  "Correção hiponatremia (máx 10 mEq/24h)",
                  "Alerta candidiase sem antifúngico",
                ].map((p, i) => (
                  <li key={i} className="t-body text-muted-foreground flex gap-1.5">
                    <span className="text-navy">•</span> {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
