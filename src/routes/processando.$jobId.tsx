import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  X,
  RefreshCw,
  ClipboardList,
} from "lucide-react";
import { getClinicalExtractionJob } from "@/lib/documentExtractor";
import { storage } from "@/lib/storage";
import { toast } from "sonner";

export const Route = createFileRoute("/processando/$jobId")({
  component: ProcessandoRoute,
  head: () => ({ meta: [{ title: "Processando Documento — MEDFLUXO" }] }),
});

const STEPS = [
  { id: "queued", label: "Arquivo recebido", stages: ["Arquivo recebido"] },
  {
    id: "prep",
    label: "Preparando imagem / documento",
    stages: [
      "Preparando imagem",
      "Lendo documento",
      "Lendo PDF",
      "Lendo texto",
      "Processando páginas",
    ],
  },
  {
    id: "ai",
    label: "Lendo com IA",
    stages: ["Lendo com IA", "Lendo com OpenAI Vision", "Lendo com IA (OpenAI)"],
  },
  { id: "org", label: "Organizando dados clínicos", stages: ["Organizando dados clínicos"] },
  { id: "done", label: "Pronto para revisão", stages: ["Pronto para revisão"] },
];

function ProcessandoRoute() {
  const params = Route.useParams();
  const nav = useNavigate();

  // Safari resistance: use storage job_id if it exists and differs from URL
  const [jobId] = useState(() => {
    const activeJob = storage.getJobAtivo();
    return activeJob && activeJob !== params.jobId ? activeJob : params.jobId;
  });

  const [fileName] = useState(() => storage.getJobArquivo() || "Documento");
  const [status, setStatus] = useState<"queued" | "processing" | "done" | "error">("queued");
  const [currentStage, setCurrentStage] = useState<string>("Arquivo recebido");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const pollingRef = useRef<boolean>(true);
  const inFlightRef = useRef(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + 300_000; // 5 minutes timeout
    pollingRef.current = true;
    finishedRef.current = false;

    const timerInterval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    const scheduleNext = (ms: number) => {
      if (timeoutId) clearTimeout(timeoutId);
      if (pollingRef.current && !finishedRef.current) timeoutId = setTimeout(poll, ms);
    };

    const poll = async () => {
      if (!pollingRef.current || finishedRef.current || inFlightRef.current) return;

      if (Date.now() > deadline) {
        finishedRef.current = true;
        setStatus("error");
        setErrorMsg("Tempo limite atingido. Verifique sua conexão.");
        return;
      }

      inFlightRef.current = true;
      try {
        const job = await getClinicalExtractionJob(jobId);

        setStatus(job.status);
        setCurrentStage(job.stage);

        if (job.status === "done" && job.result) {
          finishedRef.current = true;
          storage.setExtracaoResultado(JSON.stringify(job.result));
          storage.clearJobAtivo();

          const storedPatientId = storage.getUploadPatientId();
          if (storedPatientId) {
            storage.clearUploadPatientId();
            nav({ to: "/revisar-extracao", search: { patient_id: storedPatientId } as any });
          } else {
            nav({ to: "/revisar-extracao", search: { patient_id: undefined } });
          }

          toast.success("Processamento concluído!");
          return;
        }

        if (job.status === "error") {
          finishedRef.current = true;
          setStatus("error");
          setErrorMsg(job.error || "Erro desconhecido no servidor.");
          return;
        }

        scheduleNext(3000);
      } catch (err: any) {
        console.error("Polling error:", err);
        if (err?.message?.includes("não encontrado")) {
          finishedRef.current = true;
          setStatus("error");
          setErrorMsg(err.message);
          return;
        }
        scheduleNext(5000);
      } finally {
        inFlightRef.current = false;
      }
    };

    poll();

    // Visibility change listener for Safari/Mobile resistance
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !finishedRef.current && !inFlightRef.current) {
        scheduleNext(0);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      pollingRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
      clearInterval(timerInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, nav]);

  // Map stage to step index
  const getCurrentStepIndex = () => {
    if (status === "done") return 4;
    if (status === "error") return -1;

    const index = STEPS.findIndex((step) =>
      step.stages.some((s) => currentStage.toLowerCase().includes(s.toLowerCase())),
    );
    return index === -1 ? 0 : index;
  };

  const getDynamicMessage = () => {
    if (elapsed < 15) return "Extraindo texto e lendo com IA...";
    if (elapsed < 45) return "Documento grande. Organizando dados clínicos.";
    if (elapsed < 90) return "A análise está demorando mais que o normal.";
    return "O servidor está levando mais tempo para estruturar este documento.";
  };

  const currentStepIndex = getCurrentStepIndex();

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
      <div className="bg-card border-border w-full max-w-lg rounded-3xl border p-6 sm:p-8">
        <div className="text-center">
          <h1 className="t-eyebrow text-ai">Lendo documento</h1>
          <div className="bg-secondary border-border mx-auto mt-3 flex w-fit max-w-full items-center gap-2 rounded-2xl border px-4 py-2.5">
            <FileText className="text-ai h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="t-body text-foreground truncate">{fileName}</span>
          </div>
          <p className="t-label text-muted-foreground mt-3 font-normal">{elapsed}s decorridos</p>
        </div>

        {status === "error" ? (
          <div className="mt-8">
            <div className="bg-destructive/10 text-destructive mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full">
              <AlertCircle className="h-8 w-8" aria-hidden="true" />
            </div>
            <h2 className="t-display text-foreground text-center">Não consegui ler</h2>
            <p role="alert" className="t-body text-destructive mt-4 text-center">
              {errorMsg}
            </p>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* O rótulo era "Tentar Novamente", mas levava a outra tela.
                  Agora diz para onde vai. */}
              <button
                onClick={() =>
                  nav({
                    to: "/upload-ia",
                    search: { tipo: storage.getTipo(), engine: "docling", patient_id: undefined },
                  })
                }
                className="bg-secondary text-foreground hover:bg-border focus-visible:ring-ring inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-2xl text-base font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <RefreshCw className="h-5 w-5" aria-hidden="true" /> Enviar outro arquivo
              </button>
              <button
                onClick={() => nav({ to: "/cadastro-manual", search: {} as never })}
                className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-2xl text-base font-bold transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
              >
                <ClipboardList className="h-5 w-5" aria-hidden="true" /> Preencher à mão
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <ol className="space-y-4" aria-live="polite">
              {STEPS.map((step, index) => {
                const concluido = index < currentStepIndex || status === "done";
                const atual = index === currentStepIndex && status !== "done";

                return (
                  <li key={step.id} className="flex items-center gap-4">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        concluido
                          ? "bg-success border-success text-success-foreground"
                          : atual
                            ? "border-ai bg-ai/10 text-ai"
                            : "border-border text-muted-foreground"
                      }`}
                    >
                      {concluido ? (
                        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                      ) : atual ? (
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`t-body ${concluido ? "text-foreground" : atual ? "text-ai font-bold" : "text-muted-foreground"}`}
                      >
                        {step.label}
                        <span className="sr-only">
                          {concluido ? " — concluído" : atual ? " — em andamento" : " — aguardando"}
                        </span>
                      </p>
                      {atual && (
                        <p className="t-label text-muted-foreground font-normal">
                          {getDynamicMessage()}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="border-border border-t pt-6">
              {elapsed > 90 ? (
                <div className="space-y-3">
                  <p className="t-body text-muted-foreground text-center">
                    Documentos longos podem levar até 3 minutos. Dá para esperar ou preencher à mão
                    — o processamento continua em segundo plano.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => window.location.reload()}
                      className="bg-ai focus-visible:ring-ring inline-flex min-h-[3rem] flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold text-white focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <RefreshCw className="h-5 w-5" aria-hidden="true" /> Continuar esperando
                    </button>
                    <button
                      onClick={() => nav({ to: "/cadastro-manual", search: {} as never })}
                      className="bg-secondary text-foreground focus-visible:ring-ring inline-flex min-h-[3rem] flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <ClipboardList className="h-5 w-5" aria-hidden="true" /> Preencher à mão
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="t-body text-muted-foreground text-center">
                    Pode sair desta tela ou bloquear o celular. O resultado fica salvo.
                  </p>
                  <button
                    onClick={() => {
                      pollingRef.current = false;
                      nav({ to: "/dashboard" });
                    }}
                    className="border-border text-muted-foreground hover:bg-secondary focus-visible:ring-ring mt-4 inline-flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-2xl border text-base font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <X className="h-5 w-5" aria-hidden="true" /> Cancelar leitura
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
