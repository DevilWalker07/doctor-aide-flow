import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
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
  head: () => ({ meta: [{ title: "Passagem de Plantão IA — DOUTOR AJUDA" }] }),
});

type FileStatus = "idle" | "ready" | "error";

interface UploadedFile {
  id: string;
  file: File;
  status: FileStatus;
  errorMsg?: string;
}

const ALLOWED_EXTS = [".docx", ".doc", ".txt", ".pdf"];

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

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const newEntries: UploadedFile[] = arr.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      status: isAllowed(f) ? "ready" : "error",
      errorMsg: !isAllowed(f) ? `Formato não suportado (use DOCX, DOC, TXT ou PDF)` : undefined,
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
    [addFiles]
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

      const res = await fetch("/api/passagem-plantao/gerar", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const pacientesCount = Number(res.headers.get("X-Pacientes-Count") || 0);
      const alertasCount = Number(res.headers.get("X-Alertas-Count") || 0);
      const warningsHeader = res.headers.get("X-File-Warnings");

      if (warningsHeader) {
        setWarnings(warningsHeader.split(";").map((s) => s.trim()).filter(Boolean));
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
      <header className="bg-white border-b border-border sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => nav({ to: "/dashboard" })}
              className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-black text-foreground uppercase tracking-tight">
                PASSAGEM DE PLANTÃO IA
              </h1>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                Gerar mapa consolidado a partir dos DOCX dos leitos
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* Config row */}
        <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
          <h2 className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mb-4">
            Configuração do Plantão
          </h2>
          <div className="flex flex-wrap gap-6">
            {/* Setor */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Setor
              </label>
              <div className="flex gap-2">
                {(["CMF", "CMM", "CMF/CMM"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSetor(s)}
                    className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all ${
                      setor === s
                        ? "bg-[#1F4E79] text-white border-[#1F4E79] shadow-md"
                        : "bg-white text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Data */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Data do Plantão
              </label>
              <input
                type="text"
                value={data}
                onChange={(e) => setData(e.target.value)}
                placeholder="DD/MM/YYYY"
                className="h-10 px-3 rounded-xl border border-border text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79]/20 w-36"
              />
            </div>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
            isDragging
              ? "border-[#1F4E79] bg-[#1F4E79]/5"
              : "border-border hover:border-[#1F4E79]/40 hover:bg-secondary/30"
          }`}
        >
          <Upload className={`h-8 w-8 ${isDragging ? "text-[#1F4E79]" : "text-muted-foreground"}`} />
          <p className="text-sm font-bold text-foreground">
            {isDragging ? "Solte os arquivos aqui" : "Arraste os DOCX dos leitos ou clique para selecionar"}
          </p>
          <p className="text-xs text-muted-foreground">
            Suporte a DOCX, DOC, TXT — até 30 arquivos — 20MB cada
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".docx,.doc,.txt,.pdf"
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                {readyFiles.length} arquivo{readyFiles.length !== 1 ? "s" : ""} prontos
                {files.length - readyFiles.length > 0 && (
                  <span className="text-destructive ml-2">
                    · {files.length - readyFiles.length} com erro
                  </span>
                )}
              </span>
              <button
                onClick={handleClearAll}
                className="text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:text-destructive flex items-center gap-1 transition-colors"
              >
                <Trash2 className="h-3 w-3" /> Limpar tudo
              </button>
            </div>
            <ul className="divide-y divide-border max-h-72 overflow-y-auto">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-5 py-3">
                  <FileText className={`h-4 w-4 flex-shrink-0 ${f.status === "error" ? "text-destructive" : "text-[#1F4E79]"}`} />
                  <span className="flex-1 text-xs font-medium truncate">{f.file.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {(f.file.size / 1024).toFixed(0)} KB
                  </span>
                  {f.status === "error" && (
                    <span className="text-[10px] text-destructive font-medium">{f.errorMsg}</span>
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
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">
                Arquivos com problema (ignorados):
              </p>
              <ul className="space-y-0.5">
                {warnings.map((w, i) => (
                  <li key={i} className="text-xs text-amber-700">{w}</li>
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
            className="flex-1 h-14 rounded-2xl bg-[#1F4E79] text-white text-[11px] font-black uppercase tracking-widest shadow-xl shadow-[#1F4E79]/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando {readyFiles.length} leito{readyFiles.length !== 1 ? "s" : ""}…
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Gerar Mapa de Passagem ({readyFiles.length} leito{readyFiles.length !== 1 ? "s" : ""})
              </>
            )}
          </button>

          {downloadUrl && (
            <a
              href={downloadUrl}
              download={downloadName}
              className="flex-1 h-14 rounded-2xl bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest shadow-xl shadow-emerald-600/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              Baixar DOCX
              {stats && (
                <span className="ml-1 font-normal normal-case tracking-normal text-emerald-100 text-[10px]">
                  ({stats.pacientes} pac · {stats.alertas} alertas)
                </span>
              )}
            </a>
          )}
        </div>

        {/* How to use */}
        {files.length === 0 && (
          <div className="bg-[#1F4E79]/5 border border-[#1F4E79]/10 rounded-2xl p-6">
            <h3 className="text-[11px] font-black text-[#1F4E79] uppercase tracking-widest mb-3">
              Como usar
            </h3>
            <ol className="space-y-2">
              {[
                "Selecione o setor (CMF, CMM ou ambos) e a data do plantão",
                "Arraste ou selecione os arquivos DOCX de cada leito (evoluções/prescrições do dia)",
                'Clique em "Gerar Mapa de Passagem"',
                "Aguarde o processamento — a IA extrai e consolida todos os leitos",
                "Baixe o DOCX gerado com o mapa completo + tabela de alertas críticos",
              ].map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="h-5 w-5 rounded-full bg-[#1F4E79] text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="mt-4 pt-4 border-t border-[#1F4E79]/10">
              <p className="text-[10px] font-black text-[#1F4E79] uppercase tracking-widest mb-2">
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
                  <li key={i} className="text-[11px] text-muted-foreground flex gap-1.5">
                    <span className="text-[#1F4E79]">•</span> {p}
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
