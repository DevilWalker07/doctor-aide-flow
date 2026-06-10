import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { ChevronLeft, Upload, FileText, Copy, Check, Loader2, X, Image as ImageIcon, FileType } from "lucide-react";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";

export const Route = createFileRoute("/lab-rapido")({
  component: LabRapidoPage,
  head: () => ({ meta: [{ title: "Extrair laboratório — Plantonista" }] }),
});

interface LabResult {
  id: string;
  source: string; // nome do arquivo ou "Texto colado"
  texto_formatado: string | null;
  eas_formatado?: string | null;
  alertas?: string[];
  raw?: any;
  status: "ok" | "error" | "processing";
  error?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip "data:...;base64,"
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractOne(payload: {
  inputText?: string;
  fileBase64?: string;
  fileType?: string;
  fileName?: string;
}): Promise<any> {
  return invokeEdgeFunction<any>("lab-extractor", payload, { timeoutMs: 180_000 });
}

/**
 * Constrói o texto_formatado a partir do objeto `valores` quando a IA
 * falha em montá-lo. Usa o mesmo padrão Dr. Luan (-LAB: HB X | HT X | …).
 *
 * Fallback de segurança: se algum extractor antigo ou alguma situação
 * de borda fizer a IA retornar valores mas não preencher texto_formatado,
 * a UI ainda mostra algo útil em vez de "(sem dados extraídos)".
 */
function buildTextoFormatadoFromValores(raw: any): string | null {
  const v = raw?.valores;
  if (!v || typeof v !== "object") return null;

  const fmt = (n: any): string | null => {
    if (n === null || n === undefined || n === "") return null;
    return String(n);
  };

  const parts: string[] = [];
  const push = (key: string, val: string | null) => {
    if (val !== null) parts.push(`${key} ${val}`);
  };

  const hb = fmt(v.hb);
  const ht = fmt(v.ht);
  const vcm = fmt(v.vcm);
  const hcm = fmt(v.hcm);
  const leuco = fmt(v.leucocitos);
  const seg = fmt(v.segmentados_percent);
  const bast = fmt(v.bastoes_percent);
  const lnf = fmt(v.linfocitos_percent);
  const plq = fmt(v.plaquetas);

  push("HB", hb);
  push("HT", ht);

  // VCM/HCM se anemia (HB <13) ou se vieram do laudo
  const hbNum = hb ? parseFloat(hb.replace(",", ".")) : null;
  const anemia = hbNum !== null && hbNum < 13;
  if (vcm && (anemia || !hb)) push("VCM", vcm);
  if (hcm && (anemia || !hb)) push("HCM", hcm);

  if (v.hemacias) parts.push(`HEMACIAS ${v.hemacias}`);

  if (leuco) {
    const leucoNum = parseFloat(leuco.replace(/[^\d.]/g, ""));
    const leucocitose = leucoNum > 11000;
    const leucopenia = leucoNum < 4000;
    if ((leucocitose || leucopenia) && (seg || bast || lnf)) {
      const diff: string[] = [];
      if (seg) diff.push(`${seg}% SEG`);
      if (bast) diff.push(`${bast}% BAST`);
      if (lnf) diff.push(`${lnf}% LNF`);
      parts.push(`LEUCO ${leuco} (às custas de ${diff.join(" / ")})`);
    } else {
      parts.push(`LEUCO ${leuco}`);
    }
  }

  push("PLQ", plq);
  push("CR", fmt(v.creatinina));
  push("UR", fmt(v.ureia));
  push("NA", fmt(v.sodio));
  push("K", fmt(v.potassio));
  push("PCR", fmt(v.pcr));
  push("LACTATO", fmt(v.lactato));
  push("TGO", fmt(v.tgo));
  push("TGP", fmt(v.tgp));
  push("INR", fmt(v.inr));
  push("GLI", fmt(v.glicemia));

  if (parts.length === 0) return null;

  const data = raw?.data_exame;
  const prefix = data ? `-LAB (${data}):` : "-LAB:";
  return `${prefix} ${parts.join(" | ")}`;
}

function LabRapidoPage() {
  const nav = useNavigate();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<LabResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles).filter(f =>
      f.type.startsWith("image/") || f.type === "application/pdf"
    );
    if (arr.length === 0) {
      toast.error("Selecione imagens ou PDFs.");
      return;
    }
    setFiles((prev) => [...prev, ...arr]);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const onPaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imgs: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f && (f.type.startsWith("image/") || f.type === "application/pdf")) imgs.push(f);
      }
    }
    if (imgs.length) addFiles(imgs);
  };

  const process = async () => {
    if (!text.trim() && files.length === 0) {
      toast.error("Cole texto ou anexe arquivo.");
      return;
    }
    setProcessing(true);
    setResults([]);

    const items: Array<{ id: string; source: string; payload: any }> = [];
    if (text.trim()) {
      items.push({
        id: `txt-${Date.now()}`,
        source: "Texto colado",
        payload: { inputText: text.trim() },
      });
    }
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const b64 = await fileToBase64(f);
      items.push({
        id: `f-${i}-${f.name}`,
        source: f.name,
        payload: { fileBase64: b64, fileType: f.type, fileName: f.name },
      });
    }

    // Inicia placeholders
    setResults(items.map(it => ({
      id: it.id, source: it.source, texto_formatado: null, status: "processing",
    })));

    // Processa em paralelo (até 4 simultâneos)
    const CONCURRENCY = 4;
    const queue = [...items];
    const results: LabResult[] = [];

    async function worker() {
      while (queue.length) {
        const it = queue.shift();
        if (!it) break;
        try {
          const data = await extractOne(it.payload);
          // Fallback: se a IA não montou texto_formatado mas tem valores, montamos aqui
          const textoFormatado =
            data.texto_formatado ?? buildTextoFormatadoFromValores(data);
          const r: LabResult = {
            id: it.id,
            source: it.source,
            texto_formatado: textoFormatado,
            eas_formatado: data.eas_formatado ?? null,
            alertas: data.alertas ?? [],
            raw: data,
            status: "ok",
          };
          results.push(r);
          setResults((prev) => prev.map(p => p.id === it.id ? r : p));
        } catch (e: any) {
          const r: LabResult = {
            id: it.id,
            source: it.source,
            texto_formatado: null,
            status: "error",
            error: e.message || "Erro desconhecido",
          };
          results.push(r);
          setResults((prev) => prev.map(p => p.id === it.id ? r : p));
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => worker()));
    setProcessing(false);
    toast.success(`${results.filter(r => r.status === "ok").length}/${items.length} processados`);
  };

  const copyAll = () => {
    const text = results
      .filter(r => r.status === "ok" && r.texto_formatado)
      .map(r => {
        let s = r.texto_formatado!;
        if (r.eas_formatado) s += `\n${r.eas_formatado}`;
        return s;
      })
      .join("\n\n");
    if (!text) {
      toast.error("Nada pra copiar.");
      return;
    }
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const reset = () => {
    setText("");
    setFiles([]);
    setResults([]);
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <button
            onClick={() => nav({ to: "/" })}
            className="inline-flex items-center gap-1.5 h-9 px-2 -ml-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-subtle transition-colors text-sm"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-4 w-4" /> Início
          </button>
          <h1 className="text-[15px] font-semibold tracking-tight">Extrair laboratório</h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <p className="text-sm text-muted-foreground">
          Cole o texto do laudo, ou envie foto/PDF (vários ao mesmo tempo).
          A IA extrai e formata no padrão <code className="px-1 py-0.5 rounded bg-subtle text-[12px]">-LAB (dd/mm/aa): HB X | HT X | …</code>
        </p>

        {/* Texto */}
        <div>
          <label className="text-[13px] font-medium mb-1.5 block">Texto colado</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={onPaste}
            rows={6}
            placeholder="Cole aqui o texto do laudo ou parte da prescrição… Você também pode colar uma imagem (Ctrl+V) que ela vai pra área de anexos."
            className="w-full p-3 rounded-md border border-input bg-elevated text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y font-mono"
          />
        </div>

        {/* Drop zone */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[13px] font-medium">Arquivos ({files.length})</label>
            <button
              onClick={() => inputRef.current?.click()}
              className="text-[12px] text-primary hover:underline"
            >
              Adicionar
            </button>
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className="border border-dashed border-border rounded-md p-6 text-center bg-subtle/50 hover:bg-subtle cursor-pointer transition-colors"
          >
            <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-[13px] text-muted-foreground">
              Toque pra escolher, ou arraste imagens/PDFs aqui
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Aceita múltiplos arquivos. JPG, PNG, PDF.
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {files.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-md bg-elevated border border-border text-[13px]"
                >
                  {f.type.startsWith("image/") ? (
                    <ImageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <FileType className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {(f.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    onClick={() => removeFile(i)}
                    className="p-1 -mr-1 rounded hover:bg-subtle text-muted-foreground"
                    aria-label="Remover"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 sticky bottom-4 z-10">
          <button
            onClick={process}
            disabled={processing || (!text.trim() && files.length === 0)}
            className="flex-1 h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Processando…
              </>
            ) : (
              <>Extrair {files.length + (text.trim() ? 1 : 0) > 1 ? `(${files.length + (text.trim() ? 1 : 0)})` : ""}</>
            )}
          </button>
          {results.length > 0 && (
            <button
              onClick={reset}
              disabled={processing}
              className="h-11 px-4 rounded-md border border-border bg-elevated text-sm font-medium hover:bg-subtle transition-colors disabled:opacity-50"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Resultados */}
        {results.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Resultados ({results.length})</h2>
              <button
                onClick={copyAll}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-elevated text-[13px] font-medium hover:bg-subtle"
              >
                <Copy className="h-3.5 w-3.5" /> Copiar todos
              </button>
            </div>

            {results.map((r) => (
              <ResultCard key={r.id} result={r} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ResultCard({ result }: { result: LabResult }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (!result.texto_formatado) return;
    let t = result.texto_formatado;
    if (result.eas_formatado) t += `\n${result.eas_formatado}`;
    navigator.clipboard.writeText(t);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="card-elevated p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground min-w-0">
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{result.source}</span>
        </div>
        {result.status === "ok" && (
          <button
            onClick={copy}
            className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline shrink-0"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
        )}
      </div>

      {result.status === "processing" && (
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Extraindo…
        </div>
      )}

      {result.status === "error" && (
        <div className="text-[13px] text-destructive">
          Erro: {result.error}
        </div>
      )}

      {result.status === "ok" && (
        <>
          <pre className="text-[13px] font-mono whitespace-pre-wrap break-words bg-subtle rounded-md p-3 mt-2">
            {result.texto_formatado || "(sem dados extraídos)"}
            {result.eas_formatado ? `\n${result.eas_formatado}` : ""}
          </pre>
          {result.alertas && result.alertas.length > 0 && (
            <div className="mt-2 text-[12px] text-amber-700 dark:text-amber-400">
              ⚠ {result.alertas.join(" · ")}
            </div>
          )}
        </>
      )}
    </div>
  );
}
