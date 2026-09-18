import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ChevronLeft,
  ClipboardPaste,
  Copy,
  FileType,
  FlaskConical,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  ScanLine,
  Sparkles,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { organizarLaboratorio, organizarLaudoImagem } from "@/lib/ai/aiService";
import {
  arquivosDe,
  classificar,
  pdfParaBase64,
  reduzirImagem,
  type Anexo,
} from "@/lib/anexosLaboratorio";
import type { LabExtractionResult, LaudoImagemResult } from "@/lib/types/lab";

export const Route = createFileRoute("/resumo-exames")({
  component: ResumoExamesPage,
  head: () => ({ meta: [{ title: "Resumo de Exames — MEDFLUXO" }] }),
});

type Modo = "laboratorio" | "imagem";

function ResumoExamesPage() {
  const [modo, setModo] = useState<Modo>("laboratorio");
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<LabExtractionResult | null>(null);
  const [laudo, setLaudo] = useState<LaudoImagemResult | null>(null);
  // Foto do papel, print da tela, PDF. É como o resultado chega no plantão —
  // o caminho só-texto deixava isso de fora.
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const trocarModo = (novo: Modo) => {
    if (novo === modo) return;
    setModo(novo);
    // O resultado do outro modo não se aplica a este: manter na tela daria a
    // impressão de que o resumo corresponde ao texto atual.
    setResultado(null);
    setLaudo(null);
    setAnexos([]);
  };

  const adicionar = (files: File[]) => {
    const novos = files.map(classificar).filter((a): a is Anexo => a !== null);
    if (novos.length === 0) {
      toast.error("Só imagem ou PDF.");
      return;
    }
    setAnexos((atual) => [...atual, ...novos].slice(0, 6));
  };

  const organizar = async () => {
    const temTexto = texto.trim().length >= 10;
    if (modo === "laboratorio" && !temTexto && anexos.length === 0) {
      toast.error("Cole o texto dos exames, anexe uma foto ou envie o PDF.");
      return;
    }
    if (modo === "imagem" && !temTexto) {
      toast.error("Cole o texto do laudo de imagem.");
      return;
    }

    setLoading(true);
    try {
      if (modo === "laboratorio") {
        setLaudo(null);
        const imagens = [];
        let pdfBase64: string | undefined;
        for (const a of anexos) {
          if (a.tipo === "imagem") imagens.push(await reduzirImagem(a.arquivo));
          else pdfBase64 = await pdfParaBase64(a.arquivo);
        }
        setResultado(
          await organizarLaboratorio({
            inputText: temTexto ? texto : undefined,
            imagens: imagens.length ? imagens : undefined,
            pdfBase64,
          }),
        );
      } else {
        setResultado(null);
        setLaudo(await organizarLaudoImagem(texto));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao organizar.");
    } finally {
      setLoading(false);
    }
  };

  const colar = async () => {
    try {
      setTexto(await navigator.clipboard.readText());
    } catch {
      toast.error("Não foi possível ler a área de transferência.");
    }
  };

  const copiar = () => {
    const linhas =
      modo === "laboratorio"
        ? [
            resultado?.texto_formatado,
            resultado?.eas_formatado,
            ...(resultado?.alertas ?? []).map((a) => `⚠ ${a}`),
          ]
        : [
            laudo?.texto_formatado,
            laudo?.conclusao ? `CONCLUSÃO: ${laudo.conclusao}` : null,
            ...(laudo?.alertas ?? []).map((a) => `⚠ ${a}`),
          ];
    const texto = linhas.filter(Boolean).join("\n");
    if (!texto) return;
    navigator.clipboard.writeText(texto);
    toast.success("Copiado para o prontuário.");
  };

  const valores = Object.entries(resultado?.valores ?? {}).filter(([, v]) => v != null && v !== "");

  return (
    <div className="bg-background min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center gap-3 px-4 pt-5 sm:px-6">
        <Link
          to="/"
          aria-label="Voltar para a central"
          className="touch-target border-border bg-card text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl border transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <h1 className="t-title text-foreground flex items-center gap-2">
            <FlaskConical
              className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-300"
              aria-hidden="true"
            />
            Exames para o prontuário
          </h1>
          <p className="t-label text-muted-foreground font-normal">
            Laboratório e laudos na linha que você escreve na evolução
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl grid-cols-1 gap-5 px-4 py-6 sm:px-6 lg:grid-cols-2">
        <section
          aria-labelledby="resumo-entrada"
          className="border-border bg-card space-y-3 rounded-3xl border p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id="resumo-entrada" className="t-title text-foreground">
              {modo === "laboratorio" ? "Texto dos exames" : "Texto do laudo"}
            </h2>
            <button
              type="button"
              onClick={colar}
              className="t-label text-primary focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-xl px-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              <ClipboardPaste className="h-4 w-4" aria-hidden="true" /> Colar
            </button>
          </div>
          <div
            role="radiogroup"
            aria-label="Tipo de exame"
            className="bg-secondary flex gap-1.5 rounded-2xl p-1.5"
          >
            {(
              [
                { id: "laboratorio", label: "Laboratório", icon: FlaskConical },
                { id: "imagem", label: "Imagem", icon: ScanLine },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={modo === m.id}
                onClick={() => trocarModo(m.id)}
                data-testid={`resumo-modo-${m.id}`}
                className={`focus-visible:ring-ring inline-flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 rounded-xl text-base font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                  modo === m.id
                    ? "bg-card text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <m.icon className="h-4 w-4" aria-hidden="true" /> {m.label}
              </button>
            ))}
          </div>

          <label htmlFor="resumo-input" className="sr-only">
            {modo === "laboratorio" ? "Cole a lista de exames" : "Cole o laudo de imagem"}
          </label>
          <textarea
            id="resumo-input"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={14}
            placeholder={
              modo === "laboratorio"
                ? "Cole a lista de exames ou o print transcrito.\nEx.: Hb 9,2  Ht 28  Leuco 14.400  Cr 1,8  K 5,6  PCR 87"
                : "Cole o laudo do radiologista, com achados e conclusão."
            }
            data-testid="resumo-input"
            onPaste={(e) => {
              // Ctrl+V de um print vira anexo em vez de colar nada. É assim
              // que chega o resultado copiado da tela do laboratório.
              if (modo !== "laboratorio") return;
              const arquivos = arquivosDe(e.clipboardData?.items ?? null);
              if (arquivos.length) {
                e.preventDefault();
                adicionar(arquivos);
                toast.success("Print anexado.");
              }
            }}
            onDragOver={(e) => modo === "laboratorio" && e.preventDefault()}
            onDrop={(e) => {
              if (modo !== "laboratorio") return;
              const arquivos = arquivosDe(e.dataTransfer?.files ?? null);
              if (arquivos.length) {
                e.preventDefault();
                adicionar(arquivos);
              }
            }}
            className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-2xl border p-4 font-mono text-base focus:ring-2 focus:outline-none"
          />

          {modo === "laboratorio" && (
            <div className="space-y-2">
              <input
                type="file"
                ref={inputArquivo}
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                data-testid="resumo-arquivo-input"
                onChange={(e) => {
                  adicionar(arquivosDe(e.target.files));
                  e.target.value = "";
                }}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => inputArquivo.current?.click()}
                  data-testid="resumo-anexar"
                  className="t-label border-border bg-background text-foreground hover:border-primary hover:text-primary focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center gap-2 rounded-xl border px-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Paperclip className="h-4 w-4" aria-hidden="true" /> Anexar foto ou PDF
                </button>
                <span className="t-label text-muted-foreground self-center font-normal">
                  ou cole um print aqui (Ctrl+V), ou arraste o arquivo
                </span>
              </div>

              {anexos.length > 0 && (
                <ul className="space-y-1.5" data-testid="resumo-anexos">
                  {anexos.map((a, i) => (
                    <li
                      key={`${a.nome}-${i}`}
                      className="border-border bg-background flex items-center gap-2 rounded-xl border px-3 py-2"
                    >
                      {a.tipo === "pdf" ? (
                        <FileType
                          className="text-muted-foreground h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                      ) : (
                        <ImageIcon
                          className="text-muted-foreground h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <span className="t-label text-foreground min-w-0 flex-1 truncate font-normal">
                        {a.nome}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAnexos((atual) => atual.filter((_, j) => j !== i))}
                        aria-label={`Remover ${a.nome}`}
                        className="touch-target text-muted-foreground hover:text-destructive focus-visible:ring-ring inline-flex items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={organizar}
            disabled={loading}
            data-testid="resumo-submit"
            className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-2xl text-base font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            )}
            {loading
              ? "Organizando…"
              : modo === "laboratorio"
                ? "Organizar para o prontuário"
                : "Organizar o laudo"}
          </button>
        </section>

        <section
          aria-labelledby="resumo-saida"
          className="border-border bg-card space-y-4 rounded-3xl border p-5"
          data-testid="resumo-resultado"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id="resumo-saida" className="t-title text-foreground">
              Resumo
            </h2>
            {(resultado || laudo) && (
              <button
                type="button"
                onClick={copiar}
                className="t-label text-primary focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-xl px-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                <Copy className="h-4 w-4" aria-hidden="true" /> Copiar
              </button>
            )}
          </div>
          {!resultado && !laudo ? (
            <p className="t-body text-muted-foreground">
              {modo === "laboratorio"
                ? "O resumo aparece aqui: a linha compacta no padrão da evolução, os valores extraídos e os alertas."
                : "O laudo organizado aparece aqui: achados, conclusão do radiologista e a linha pronta para a evolução."}
            </p>
          ) : laudo ? (
            <>
              <pre className="bg-background border-border text-foreground rounded-2xl border p-4 font-mono text-[0.8125rem] whitespace-pre-wrap">
                {laudo.texto_formatado || "—"}
              </pre>

              {(laudo.achados ?? []).length > 0 && (
                <div>
                  <p className="t-eyebrow text-muted-foreground">Achados</p>
                  <ul className="mt-2 space-y-1.5">
                    {laudo.achados!.map((a, i) => (
                      <li key={i} className="t-body text-foreground flex gap-2">
                        <span className="text-muted-foreground shrink-0" aria-hidden="true">
                          •
                        </span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {laudo.conclusao && (
                <div className="bg-secondary border-border rounded-2xl border p-4">
                  <p className="t-eyebrow text-muted-foreground">Conclusão do radiologista</p>
                  <p className="t-body text-foreground mt-1">{laudo.conclusao}</p>
                </div>
              )}

              {laudo.comparacao && (
                <p className="t-body text-muted-foreground">Comparação: {laudo.comparacao}</p>
              )}

              {(laudo.alertas ?? []).length > 0 && (
                <ul className="space-y-2">
                  {laudo.alertas!.map((a, i) => (
                    <li
                      key={i}
                      className="t-body text-foreground flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2"
                    >
                      <AlertTriangle
                        className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
                        aria-hidden="true"
                      />
                      {a}
                    </li>
                  ))}
                </ul>
              )}

              {/* Trecho ambíguo vira aviso para conferir, não palpite. */}
              {(laudo.achados_incertos ?? []).length > 0 && (
                <div className="bg-secondary border-border rounded-2xl border p-4">
                  <p className="t-eyebrow text-muted-foreground">Confira no laudo original</p>
                  <ul className="mt-2 space-y-1">
                    {laudo.achados_incertos!.map((a, i) => (
                      <li key={i} className="t-body text-muted-foreground">
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : resultado ? (
            <>
              <pre className="bg-background border-border text-foreground rounded-2xl border p-4 font-mono text-[0.8125rem] whitespace-pre-wrap">
                {resultado.texto_formatado || "—"}
              </pre>
              {resultado.eas_formatado && (
                <pre className="bg-background border-border text-muted-foreground rounded-2xl border p-4 font-mono text-[0.8125rem] whitespace-pre-wrap">
                  {resultado.eas_formatado}
                </pre>
              )}
              {valores.length > 0 && (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {valores.map(([k, v]) => (
                    <li key={k} className="bg-background border-border rounded-xl border px-3 py-2">
                      <div className="t-eyebrow text-muted-foreground">{k}</div>
                      <div className="t-title text-foreground">{String(v)}</div>
                    </li>
                  ))}
                </ul>
              )}
              {(resultado.alertas ?? []).length > 0 && (
                <ul className="space-y-2">
                  {resultado.alertas!.map((a, i) => (
                    <li
                      key={i}
                      className="t-body text-foreground flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2"
                    >
                      <AlertTriangle
                        className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
                        aria-hidden="true"
                      />
                      {a}
                    </li>
                  ))}
                </ul>
              )}
              {(resultado.campos_nao_encontrados ?? []).length > 0 && (
                <p className="t-body text-muted-foreground">
                  Não encontrados: {resultado.campos_nao_encontrados!.join(", ")}
                </p>
              )}
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
