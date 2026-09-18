import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiClient";
import { supabase } from "@/lib/supabase";
import { storage } from "@/lib/storage";
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

/**
 * Dia seguinte a uma data DD/MM/AAAA. É para quem a passagem vai — o
 * cabeçalho do modelo traz essa data, e digitá-la à mão de madrugada é
 * exatamente o tipo de erro que ninguém confere.
 * Data que não dá para ler vira `undefined`: o cabeçalho sai sem a linha,
 * nunca com uma data inventada.
 */
function diaSeguinte(dataBr: string): string | undefined {
  const m = dataBr.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return undefined;
  const [, dd, mm, aaaa] = m;
  const d = new Date(Number(aaaa), Number(mm) - 1, Number(dd));
  if (
    d.getFullYear() !== Number(aaaa) ||
    d.getMonth() !== Number(mm) - 1 ||
    d.getDate() !== Number(dd)
  ) {
    return undefined;
  }
  d.setDate(d.getDate() + 1);
  return format(d, "dd/MM/yyyy");
}

/**
 * Levanta o erro com o motivo que o SERVIDOR deu, não com um resumo meu.
 *
 * A tela dizia só "Não foi possível preparar o envio." e jogava fora o corpo
 * da resposta — onde estava a causa: armazenamento não configurado (503),
 * falha ao autorizar com a mensagem do Supabase (500), limite de requisições
 * (429). Sem isso, o médico vê uma conclusão e nenhuma evidência, e eu fico
 * chutando de longe. Mesma regra do resto do app: dizer O QUÊ falhou.
 */
async function falharComMotivo(res: Response, acao: string): Promise<never> {
  const corpo = (await res.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
    details?: string[];
  };
  const detalhes = Array.isArray(corpo.details) ? ` (${corpo.details.join("; ")})` : "";
  const motivo = corpo.message || corpo.error || `HTTP ${res.status}`;
  throw new Error(`Falha ao ${acao}: ${motivo}${detalhes} [${res.status}]`);
}

function PassagemPlantaoPage() {
  const nav = useNavigate();
  const [setor, setSetor] = useState<"CMF" | "CMM" | "CMF/CMM">("CMF/CMM");
  // Vão para o cabeçalho do mapa, como no modelo do hospital. Ficam guardados
  // porque não mudam de um plantão para o outro.
  const [hospital, setHospital] = useState(() => storage.getHospitalPadrao() ?? "");
  const [periodo, setPeriodo] = useState<"diurno" | "noturno">("diurno");
  const [data, setData] = useState(format(new Date(), "dd/MM/yyyy"));
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [progresso, setProgresso] = useState<string | null>(null);
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
      toast.error("Adicione pelo menos um arquivo.");
      return;
    }

    setIsGenerating(true);
    setDownloadUrl(null);
    setStats(null);
    setWarnings([]);
    setProgresso("Enviando arquivos…");

    try {
      // Os arquivos vão direto ao Storage. Quinze arquivos não cabem no corpo
      // de uma função serverless, e mandá-los pelo servidor os faria trafegar
      // duas vezes.
      //
      // Uma autorização por arquivo, e nada mais. Existia antes uma chamada
      // extra só para descobrir o modo, com `file_name: "passagem"`: ela
      // emitia um token de envio que ninguém usava e dobrava o número de
      // requisições contra o limitador. O modo vem na resposta da primeira.
      const caminhos: string[] = [];
      let bucket: string | undefined;

      for (let i = 0; i < readyFiles.length; i++) {
        setProgresso(`Enviando arquivo ${i + 1} de ${readyFiles.length}…`);
        const f = readyFiles[i];

        const destino = await apiFetch("/api/extract/preparar-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_name: f.file.name }),
        });
        if (!destino.ok) await falharComMotivo(destino, "preparar o envio");

        const plano = (await destino.json()) as {
          modo: "storage" | "multipart";
          bucket?: string;
          storage_path?: string;
          token?: string;
        };

        // Sem Supabase (contêiner local) o arquivo vai pelo próprio servidor.
        if (plano.modo === "multipart") {
          await gerarPorMultipart();
          return;
        }
        if (!plano.storage_path || !plano.token || !(bucket ??= plano.bucket)) {
          throw new Error(
            "O servidor autorizou o envio sem dizer para onde. Tente novamente; se repetir, me avise.",
          );
        }

        // Envia com a autorização emitida pelo servidor. Sem login não há
        // sessão do Supabase aqui, e o RLS barraria o envio direto.
        const { error } = await supabase.storage
          .from(bucket)
          .uploadToSignedUrl(plano.storage_path, plano.token, f.file, {
            contentType: f.file.type || undefined,
          });
        if (error) throw new Error(`Falha ao enviar ${f.file.name}: ${error.message}`);
        caminhos.push(plano.storage_path);
      }

      setProgresso("Lendo os arquivos…");
      const inicio = await apiFetch("/api/passagem-plantao/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storage_paths: caminhos,
          setor,
          data,
          hospital: hospital.trim() || undefined,
          periodo,
          passagem_para: diaSeguinte(data),
        }),
      });
      if (!inicio.ok) await falharComMotivo(inicio, "iniciar a leitura dos arquivos");
      const { job_id } = (await inicio.json()) as { job_id: string };

      // Acompanhamento real: o médico vê em que lote está, não uma barra que
      // não sabe de nada.
      const limite = Date.now() + 10 * 60_000;
      for (;;) {
        if (Date.now() > limite)
          throw new Error("A passagem demorou demais. Tente com menos arquivos.");
        await new Promise((r) => setTimeout(r, 2500));
        const res = await apiFetch(`/api/passagem-plantao/job/${job_id}`);
        if (!res.ok) throw new Error("Perdi o acompanhamento do processamento.");
        const job = (await res.json()) as {
          status: string;
          stage: string;
          error: string | null;
          warnings: string[];
          contagem: { pacientes: number; alertas: number } | null;
          docx: { nome: string; url: string } | null;
        };

        setProgresso(job.stage);
        if (job.status === "error") throw new Error(job.error ?? "Falha ao montar a passagem.");
        if (job.status === "done" && job.docx) {
          setWarnings(job.warnings ?? []);
          setStats({
            pacientes: job.contagem?.pacientes ?? 0,
            alertas: job.contagem?.alertas ?? 0,
          });
          setDownloadUrl(job.docx.url);
          setDownloadName(job.docx.nome);
          toast.success(
            `Mapa pronto — ${job.contagem?.pacientes ?? 0} leitos, ${job.contagem?.alertas ?? 0} alertas.`,
          );
          return;
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar o mapa.");
    } finally {
      setIsGenerating(false);
      setProgresso(null);
    }
  };

  /** Modo local (`npm run dev:all` sem Supabase): o DOCX volta na resposta. */
  const gerarPorMultipart = async () => {
    const formData = new FormData();
    formData.append("setor", setor);
    formData.append("data", data);
    if (hospital.trim()) formData.append("hospital", hospital.trim());
    formData.append("periodo", periodo);
    const proxima = diaSeguinte(data);
    if (proxima) formData.append("passagem_para", proxima);
    readyFiles.forEach((f) => formData.append("files", f.file));

    const res = await apiFetch("/api/passagem-plantao/gerar", { method: "POST", body: formData });
    if (!res.ok) await falharComMotivo(res, "gerar o mapa");

    const pacientes = Number(res.headers.get("X-Pacientes-Count") || 0);
    const alertas = Number(res.headers.get("X-Alertas-Count") || 0);
    const avisos = res.headers.get("X-File-Warnings");
    if (avisos) {
      let texto = avisos;
      try {
        texto = decodeURIComponent(avisos);
      } catch {
        /* já legível */
      }
      setWarnings(
        texto
          .split(";")
          .map((t) => t.trim())
          .filter(Boolean),
      );
    }
    setStats({ pacientes, alertas });
    setDownloadUrl(URL.createObjectURL(await res.blob()));
    setDownloadName(`MAPA_PASSAGEM_${setor.replace("/", "-")}_${data.replace(/\//g, "_")}.docx`);
    toast.success(`Mapa pronto — ${pacientes} leitos, ${alertas} alertas.`);
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
              <label htmlFor="passagem-data" className="t-label text-muted-foreground">
                Data do plantão
              </label>
              <input
                id="passagem-data"
                type="text"
                value={data}
                onChange={(e) => setData(e.target.value)}
                placeholder="DD/MM/AAAA"
                data-testid="handoff-data"
                className="bg-card border-border text-foreground focus:ring-ring min-h-[2.75rem] w-40 rounded-xl border px-3 text-base focus:ring-2 focus:outline-none"
              />
            </div>

            {/* Período */}
            <div className="flex flex-col gap-1.5">
              <label className="t-label text-muted-foreground">Período</label>
              <div className="flex gap-2">
                {(["diurno", "noturno"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriodo(p)}
                    aria-pressed={periodo === p}
                    data-testid={`handoff-periodo-${p}`}
                    className={`t-label focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center rounded-xl border px-4 transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                      periodo === p
                        ? "bg-navy text-navy-foreground border-navy"
                        : "bg-card text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    {p === "diurno" ? "Diurno" : "Noturno"}
                  </button>
                ))}
              </div>
            </div>

            {/* Hospital */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="passagem-hospital" className="t-label text-muted-foreground">
                Hospital
              </label>
              <input
                id="passagem-hospital"
                type="text"
                value={hospital}
                onChange={(e) => setHospital(e.target.value)}
                onBlur={() => storage.setHospitalPadrao(hospital)}
                placeholder="Nome do hospital"
                data-testid="handoff-hospital"
                className="bg-card border-border text-foreground focus:ring-ring min-h-[2.75rem] w-64 rounded-xl border px-3 text-base focus:ring-2 focus:outline-none"
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
                {/* Em que passo está, não uma barra que não sabe de nada. Com 15
                    arquivos são três lotes, e saber disso é a diferença entre
                    esperar e achar que travou. */}
                {progresso ?? `Processando ${readyFiles.length} leitos…`}
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
