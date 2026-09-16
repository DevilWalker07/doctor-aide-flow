import { AlertCircle, Mic, Square } from "lucide-react";
import { useEffect, useRef } from "react";
import { useVoiceRecognition } from "@/hooks/useVoiceRecognition";

interface Props {
  /** Texto atual do destino — a transcrição é anexada, nunca sobrescreve. */
  value: string;
  onChange: (next: string) => void;
  /** Chave de localStorage para o rascunho automático (a cada 30 s). */
  autosaveKey?: string;
}

/**
 * Microfone com transcrição ao vivo.
 *
 * Três estados visuais inequívocos: parado, gravando e sem suporte. O que o
 * motor confirma é anexado ao fim do texto; o palpite em formação aparece em
 * itálico, para o médico ver que está sendo ouvido antes de o texto entrar.
 */
export function VoiceRecorder({ value, onChange, autosaveKey }: Props) {
  const { supported, listening, transcript, interimTranscript, error, start, stop } =
    useVoiceRecognition();
  const ultimoAplicado = useRef("");
  const ultimoSalvo = useRef("");

  // Anexa ao destino só o pedaço novo e já confirmado.
  useEffect(() => {
    if (!transcript || transcript === ultimoAplicado.current) return;
    const delta = transcript.slice(ultimoAplicado.current.length).trim();
    ultimoAplicado.current = transcript;
    if (!delta) return;
    const separador = !value || value.endsWith("\n") || value.endsWith(" ") ? "" : " ";
    onChange(value + separador + delta);
  }, [transcript, value, onChange]);

  // Rascunho automático: é o que permite restaurar depois de uma interrupção.
  useEffect(() => {
    if (!autosaveKey) return;
    const timer = setInterval(() => {
      if (!value || value === ultimoSalvo.current) return;
      try {
        localStorage.setItem(
          autosaveKey,
          JSON.stringify({ text: value, savedAt: new Date().toISOString() }),
        );
        ultimoSalvo.current = value;
      } catch {
        /* storage cheio ou bloqueado: o texto na tela continua intacto */
      }
    }, 30_000);
    return () => clearInterval(timer);
  }, [value, autosaveKey]);

  if (!supported) {
    return (
      <div
        className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-200"
        data-testid="voice-unsupported"
      >
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="t-body">
          Este navegador não faz ditado. Use o Chrome ou o Edge no Android e no computador, ou o
          Safari no iPhone (iOS 14.5 ou mais novo).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-pressed={listening}
        data-testid="voice-toggle"
        className={`inline-flex min-h-[2.75rem] items-center gap-2 rounded-2xl px-5 text-base font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none ${
          listening
            ? "animate-pulse bg-rose-600 text-white focus-visible:ring-rose-400"
            : "border-border bg-card text-foreground hover:bg-secondary focus-visible:ring-ring border"
        }`}
      >
        {listening ? (
          <Square className="h-5 w-5 fill-current" aria-hidden="true" />
        ) : (
          <Mic className="h-5 w-5" aria-hidden="true" />
        )}
        {listening ? "Gravando… toque para parar" : "Ditar anotações"}
      </button>

      {listening && (
        <p
          aria-live="polite"
          data-testid="voice-interim"
          className="border-border text-muted-foreground min-h-[2.75rem] rounded-2xl border border-dashed px-4 py-3 text-[0.9375rem] italic"
        >
          {interimTranscript || "Ouvindo…"}
        </p>
      )}

      {error && (
        <p role="alert" className="t-body text-destructive flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

export default VoiceRecorder;
