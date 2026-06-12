import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Web Speech API wrapper para ditado pt-BR.
 *
 * Pinga `start()` → começa a escutar; eventos `interimResults=true` deixam
 * a transcrição acumular em tempo real. `transcript` é o texto FINAL
 * (confirmado pelo motor), `interimTranscript` é o palpite atual.
 *
 * Limitações:
 * - Não funciona em Safari iOS < 14.5 (sem SpeechRecognition).
 * - Em Chrome desktop, requer https://.
 * - O motor envia áudio pros servidores do Google (sem opt-out via JS).
 *   Pra anotação clínica isso é aceitável (texto livre, sem PII estruturada),
 *   mas o `supported` flag permite ao componente sinalizar fallback.
 */

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export interface UseVoiceRecognition {
  supported: boolean;
  listening: boolean;
  /** Texto consolidado pelo motor (final). */
  transcript: string;
  /** Palpite atual sendo formado, não confirmado. */
  interimTranscript: string;
  /** Última mensagem de erro do motor. */
  error: string | null;
  start: () => void;
  stop: () => void;
  /** Limpa transcript + interim. */
  reset: () => void;
}

export function useVoiceRecognition(): UseVoiceRecognition {
  const [supported] = useState(() => Boolean(getCtor()));
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  // Mantém o motor único durante a vida do hook.
  useEffect(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event: any) => {
      let interim = "";
      let final = "";
      // eslint-disable-next-line no-plusplus
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript || "";
        if (result.isFinal) final += text;
        else interim += text;
      }
      if (final) {
        setTranscript((prev) => (prev ? prev + " " + final.trim() : final.trim()));
      }
      setInterimTranscript(interim);
    };

    rec.onerror = (e: any) => {
      const code = e?.error || "unknown";
      // "no-speech" e "aborted" são silenciosos — usuário pausou ou parou.
      if (code === "no-speech" || code === "aborted") return;
      setError(code === "not-allowed" ? "Permissão de microfone negada." : `Erro: ${code}`);
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      setInterimTranscript("");
    };

    recRef.current = rec;
    return () => {
      try { rec.abort(); } catch {}
      recRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    if (!recRef.current || listening) return;
    setError(null);
    try {
      recRef.current.start();
      setListening(true);
    } catch (e: any) {
      // Chrome lança InvalidStateError se já estiver rodando — ignora.
      if (e?.name !== "InvalidStateError") setError(e?.message || "Falha ao iniciar.");
    }
  }, [listening]);

  const stop = useCallback(() => {
    if (!recRef.current || !listening) return;
    try { recRef.current.stop(); } catch {}
  }, [listening]);

  const reset = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  return { supported, listening, transcript, interimTranscript, error, start, stop, reset };
}
