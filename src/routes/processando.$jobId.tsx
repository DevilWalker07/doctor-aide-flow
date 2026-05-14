import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, FileText, ArrowLeft } from "lucide-react";
import { getClinicalExtractionJob, saveExtractionResult } from "@/lib/documentExtractor";
import { toast } from "sonner";

export const Route = createFileRoute("/processando/$jobId")({
  component: ProcessandoRoute,
  head: () => ({ meta: [{ title: "Processando Documento — DOUTOR AJUDA" }] }),
});

const STEPS = [
  "Arquivo recebido",
  "Identificando tipo de arquivo...",
  "Preparando imagem...",
  "Lendo texto do arquivo...",
  "Extraindo texto do DOCX...",
  "Extraindo texto do PDF...",
  "Lendo com IA (OpenAI Vision)...",
  "Lendo com IA...",
  "Pronto para revisão",
];

function ProcessandoRoute() {
  const { jobId } = Route.useParams();
  const nav = useNavigate();
  const [status, setStatus] = useState<"queued" | "processing" | "done" | "error">("queued");
  const [currentStage, setCurrentStage] = useState<string>("Arquivo recebido");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const deadline = Date.now() + 180_000; // 3 minutes timeout

    const poll = async () => {
      if (Date.now() > deadline) {
        setStatus("error");
        setErrorMsg("Tempo limite atingido. O documento pode ser muito grande ou a rede está instável.");
        return;
      }

      try {
        const job = await getClinicalExtractionJob(jobId);
        setStatus(job.status);
        setCurrentStage(job.stage);

        if (job.status === "done" && job.result) {
          saveExtractionResult(job.result, job.result.fileName || "Documento");
          toast.success("Dados extraídos com sucesso!");
          nav({ to: "/revisar-extracao" });
          return;
        }

        if (job.status === "error") {
          setErrorMsg(job.error || "Erro desconhecido no processamento.");
          return;
        }

        // Keep polling if not done or error
        timeoutId = setTimeout(poll, 3000);
      } catch (err: any) {
        console.error("Polling error:", err);
        // Do not fail immediately on network errors, might be intermittent
        timeoutId = setTimeout(poll, 5000);
      }
    };

    poll();

    return () => clearTimeout(timeoutId);
  }, [jobId, nav]);

  // Determine which steps to show as complete
  const stepIndex = STEPS.findIndex((s) => s.includes(currentStage.replace("...", "")));
  const progressPercent = status === "done" ? 100 : Math.max(10, Math.min(90, (stepIndex / STEPS.length) * 100));

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-border rounded-[2rem] p-8 md:p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-ai/5 to-transparent opacity-100" />
        
        <div className="relative z-10 flex flex-col items-center text-center">
          {status === "error" ? (
            <>
              <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6 text-destructive">
                <AlertCircle className="h-10 w-10" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-4">Erro na Extração</h2>
              <p className="text-muted-foreground mb-8 text-sm">{errorMsg}</p>
              <button
                onClick={() => nav({ to: "/novo-paciente" })}
                className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-primary/20 hover:-translate-y-1 transition-all"
              >
                <ArrowLeft className="h-5 w-5" /> Tentar Novamente
              </button>
            </>
          ) : (
            <>
              <div className="h-24 w-24 rounded-full bg-ai/10 flex items-center justify-center mb-6 relative">
                <div className="absolute inset-0 border-4 border-ai/20 rounded-full animate-ping" />
                <FileText className="h-10 w-10 text-ai" />
                <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow-sm border border-border">
                  <Loader2 className="h-6 w-6 text-ai animate-spin" />
                </div>
              </div>

              <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-2">Processando</h2>
              <p className="text-xs font-bold text-ai uppercase tracking-widest mb-8">{currentStage}</p>

              <div className="w-full space-y-4">
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-ai h-full rounded-full transition-all duration-500 ease-out" 
                    style={{ width: `${progressPercent}%` }} 
                  />
                </div>

                <div className="text-left mt-8 space-y-4">
                  {[
                    "Arquivo recebido", 
                    "Preparando e lendo arquivo", 
                    "Extraindo com IA", 
                    "Organizando dados clínicos",
                  ].map((label, i) => {
                    // Logic to visually simulate the checklist progress based on current stage
                    let isCompleted = false;
                    let isCurrent = false;

                    if (status === "done") {
                      isCompleted = true;
                    } else if (i === 0 && progressPercent >= 10) {
                      isCompleted = true;
                    } else if (i === 1) {
                      if (progressPercent > 20) isCurrent = true;
                      if (currentStage.includes("Lendo com IA")) { isCompleted = true; isCurrent = false; }
                    } else if (i === 2) {
                      if (currentStage.includes("Lendo com IA")) isCurrent = true;
                      if (progressPercent > 80) { isCompleted = true; isCurrent = false; }
                    } else if (i === 3) {
                      if (progressPercent >= 80) isCurrent = true;
                    }

                    return (
                      <div key={label} className="flex items-center gap-3">
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                        ) : isCurrent ? (
                          <Loader2 className="h-5 w-5 text-ai animate-spin shrink-0" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-muted shrink-0" />
                        )}
                        <span className={`text-sm font-medium ${isCompleted ? "text-foreground" : isCurrent ? "text-ai font-bold" : "text-muted-foreground"}`}>
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
