import { useEffect, useRef } from "react";
import { Mic, MicOff, AlertCircle, RotateCcw } from "lucide-react";
import { useVoiceRecognition } from "@/hooks/useVoiceRecognition";

interface Props {
  /** Texto atual no destino — usado pra fazer append, não replace. */
  value: string;
  /** Recebe o texto atualizado (existente + transcrição nova). */
  onChange: (next: string) => void;
  /** Auto-salva o `value` com debounce 30s nesta chave de localStorage. */
  autosaveKey?: string;
  /** Label opcional acima do botão. */
  label?: string;
}

/**
 * VoiceRecorder — botão de microfone + transcrição ao vivo.
 *
 * Comportamento:
 * - Final chunks são APPEND ao `value` existente (não sobrescreve).
 * - Interim aparece em italic abaixo do botão (não no `value` ainda).
 * - Sem suporte ao Web Speech API: mostra mensagem de fallback.
 * - Auto-save em localStorage a cada 30s se `autosaveKey` for fornecido.
 */
export default function VoiceRecorder({ value, onChange, autosaveKey, label }: Props) {
  const { supported, listening, transcript, interimTranscript, error, start, stop, reset } = useVoiceRecognition();
  const lastAppliedRef = useRef("");
  const lastSavedRef = useRef("");

  // Append do `transcript` no `value` quando muda.
  useEffect(() => {
    if (!transcript || transcript === lastAppliedRef.current) return;
    const delta = transcript.slice(lastAppliedRef.current.length).trim();
    if (!delta) return;
    const separator = value && !value.endsWith("\n") ? " " : "";
    onChange(value + separator + delta);
    lastAppliedRef.current = transcript;
  }, [transcript, value, onChange]);

  // Auto-save 30s
  useEffect(() => {
    if (!autosaveKey) return;
    const timer = setInterval(() => {
      if (value && value !== lastSavedRef.current) {
        try {
          localStorage.setItem(autosaveKey, JSON.stringify({ text: value, savedAt: new Date().toISOString() }));
          lastSavedRef.current = value;
        } catch {}
      }
    }, 30_000);
    return () => clearInterval(timer);
  }, [value, autosaveKey]);

  const handleToggle = () => {
    if (listening) stop();
    else start();
  };

  const handleReset = () => {
    lastAppliedRef.current = "";
    reset();
  };

  if (!supported) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <p className="text-[11px] font-medium">
          Ditado por voz indisponível neste navegador. Use Chrome ou Edge no Android/desktop, ou Safari no iOS 14.5+.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && (
        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleToggle}
          aria-pressed={listening}
          aria-label={listening ? "Parar ditado" : "Iniciar ditado por voz"}
          className={`relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
            listening
              ? "bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse"
              : "bg-elevated border border-border text-foreground hover:bg-subtle"
          }`}
        >
          {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          {listening ? "Parar (gravando…)" : "Ditar por voz"}
        </button>
        {(transcript || value) && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:bg-secondary transition-all"
            aria-label="Limpar transcrição"
          >
            <RotateCcw className="h-3 w-3" /> Limpar transcrição
          </button>
        )}
      </div>

      {(listening || interimTranscript) && (
        <p className="text-[12px] italic text-muted-foreground bg-secondary/30 border border-dashed border-border rounded-lg px-3 py-2 min-h-[2rem]">
          {interimTranscript || (listening ? "Ouvindo…" : "")}
        </p>
      )}

      {error && (
        <p className="text-[11px] text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  );
}
