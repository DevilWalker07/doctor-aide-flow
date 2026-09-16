import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Ditado em pt-BR sobre a Web Speech API.
 *
 * `transcript` é o texto que o motor já confirmou; `interimTranscript` é o
 * palpite que ainda está se formando. Quem consome mostra o palpite na tela
 * e só escreve no destino o que foi confirmado.
 *
 * Limitações que o componente precisa tratar:
 * - Sem SpeechRecognition (Firefox, Safari iOS antigo) → `supported` é false.
 * - Chrome no desktop exige https.
 * - O áudio vai para os servidores do fabricante do navegador, sem opt-out
 *   por JS. Por isso o ditado é opcional e fica recolhido por padrão.
 */

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0?: { transcript?: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Códigos do motor traduzidos para algo que um médico com pressa entenda. */
function mensagemDeErro(codigo: string): string {
  switch (codigo) {
    case "not-allowed":
    case "service-not-allowed":
      return "Permissão de microfone negada. Libere o microfone nas configurações do navegador.";
    case "audio-capture":
      return "Nenhum microfone encontrado neste aparelho.";
    case "network":
      return "Sem conexão para transcrever. Verifique a internet e tente de novo.";
    case "language-not-supported":
      return "Este navegador não transcreve português do Brasil.";
    default:
      return "Não consegui ouvir agora. Tente novamente.";
  }
}

export interface UseVoiceRecognition {
  supported: boolean;
  listening: boolean;
  /** Texto já confirmado pelo motor. */
  transcript: string;
  /** Palpite atual, ainda não confirmado. */
  interimTranscript: string;
  /** Mensagem pronta para exibir, já em linguagem humana. */
  error: string | null;
  start: () => void;
  stop: () => void;
  /** Limpa transcrição, palpite e erro. */
  reset: () => void;
}

export function useVoiceRecognition(): UseVoiceRecognition {
  const [supported] = useState(() => Boolean(getCtor()));
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  // Um único motor durante a vida do hook.
  useEffect(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const texto = result[0]?.transcript ?? "";
        if (result.isFinal) final += texto;
        else interim += texto;
      }
      if (final) setTranscript((prev) => (prev ? `${prev} ${final.trim()}` : final.trim()));
      setInterimTranscript(interim);
    };

    rec.onerror = (e) => {
      const codigo = e?.error ?? "unknown";
      // Pausa do usuário ou parada manual não são falhas.
      if (codigo === "no-speech" || codigo === "aborted") return;
      setError(mensagemDeErro(codigo));
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      setInterimTranscript("");
    };

    recRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {
        /* motor já encerrado */
      }
      recRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    if (!recRef.current || listening) return;
    setError(null);
    try {
      recRef.current.start();
      setListening(true);
    } catch (e) {
      // O Chrome lança InvalidStateError se já estiver ouvindo.
      if (e instanceof Error && e.name !== "InvalidStateError") {
        setError("Não consegui iniciar o ditado. Tente novamente.");
      }
    }
  }, [listening]);

  const stop = useCallback(() => {
    if (!recRef.current || !listening) return;
    try {
      recRef.current.stop();
    } catch {
      /* já parado */
    }
  }, [listening]);

  const reset = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  return { supported, listening, transcript, interimTranscript, error, start, stop, reset };
}
