import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Loader2, CheckCircle2, AlertCircle, FileText, X, RefreshCw, ClipboardList } from "lucide-react";
import { getClinicalExtractionJob } from "@/lib/documentExtractor";
import { toast } from "sonner";

export const Route = createFileRoute("/processando/$jobId")({
  component: ProcessandoRoute,
  head: () => ({ meta: [{ title: "Processando Documento — DOUTOR AJUDA" }] }),
});

const STEPS = [
  { id: "queued", label: "Arquivo recebido", stages: ["Arquivo recebido"] },
  { id: "prep", label: "Preparando imagem / documento", stages: ["Preparando imagem", "Lendo documento", "Lendo PDF", "Lendo texto", "Processando páginas"] },
  { id: "ai", label: "Lendo com IA", stages: ["Lendo com IA", "Lendo com OpenAI Vision", "Lendo com IA (OpenAI)"] },
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

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const deadline = Date.now() + 300_000; // 5 minutes timeout
    pollingRef.current = true;

    const timerInterval = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);

    const poll = async () => {
      if (!pollingRef.current) return;
      
      if (Date.now() > deadline) {
        setStatus("error");
        setErrorMsg("Tempo limite atingido. Verifique sua conexão.");
        return;
      }

      try {
        const job = await getClinicalExtractionJob(jobId);
        
        // If status changed or job finished, update state
        if (job.status !== status) {
          setStatus(job.status);
        }
        if (job.stage !== currentStage) {
          setCurrentStage(job.stage);
        }

        if (job.status === "done" && job.result) {
          storage.setExtracaoResultado(JSON.stringify(job.result));
          storage.clearJobAtivo();
          
          const storedPatientId = storage.getUploadPatientId();
          if (storedPatientId) {
             storage.clearUploadPatientId();
             nav({ to: "/revisar-extracao", search: { patient_id: storedPatientId } as any });
          } else {
             nav({ to: "/revisar-extracao" });
          }
          
          toast.success("Processamento concluído!");
          return;
        }

        if (job.status === "error") {
          setStatus("error");
          setErrorMsg(job.error || "Erro desconhecido no servidor.");
          return;
        }

        // Only schedule next poll if we're still processing
        if (pollingRef.current && job.status !== "done" && job.status !== "error") {
          timeoutId = setTimeout(poll, 3000);
        }
      } catch (err: any) {
        console.error("Polling error:", err);
        if (pollingRef.current) {
          timeoutId = setTimeout(poll, 5000);
        }
      }
    };

    poll();

    // Visibility change listener for Safari/Mobile resistance
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && status !== "done" && status !== "error") {
        pollingRef.current = true;
        poll();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      pollingRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
      clearInterval(timerInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [jobId, nav]); // Removed status from dependencies to avoid re-triggering poll loop on every status change

  // Map stage to step index
  const getCurrentStepIndex = () => {
    if (status === "done") return 4;
    if (status === "error") return -1;
    
    const index = STEPS.findIndex(step => 
      step.stages.some(s => currentStage.toLowerCase().includes(s.toLowerCase()))
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-ai/5 rounded-full blur-[120px]" />

      <div className="max-w-xl w-full bg-white border border-border rounded-[2.5rem] p-10 md:p-14 shadow-2xl relative z-10">
        <div className="text-center mb-10">
          <h1 className="text-xs font-extrabold tracking-[0.3em] uppercase text-ai mb-4">PROCESSANDO DOCUMENTO</h1>
          <div className="flex items-center justify-center gap-3 bg-secondary/50 py-3 px-6 rounded-2xl border border-border w-fit mx-auto mb-4">
            <FileText className="h-5 w-5 text-ai" />
            <span className="font-bold text-sm truncate max-w-[200px]">{fileName}</span>
          </div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest animate-pulse">
            Tempo decorrido: {elapsed}s
          </p>
        </div>

        {status === "error" ? (
          <div className="animate-in fade-in zoom-in duration-300">
            <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6 text-destructive">
              <AlertCircle className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-extrabold text-foreground mb-4 text-center">Falha no Processamento</h2>
            <div className="bg-destructive/5 border border-destructive/10 rounded-2xl p-6 mb-8">
              <p className="text-sm text-destructive font-medium text-center leading-relaxed">
                {errorMsg}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => nav({ to: "/paciente-internado" })}
                className="py-4 rounded-xl bg-secondary text-foreground font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-border transition-colors"
              >
                <RefreshCw className="h-4 w-4" /> Tentar Novamente
              </button>
              <button
                onClick={() => nav({ to: "/cadastro-manual" })}
                className="py-4 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
              >
                <ClipboardList className="h-4 w-4" /> Preencher Manual
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="space-y-6">
              {STEPS.map((step, index) => {
                const isCompleted = index < currentStepIndex || status === "done";
                const isCurrent = index === currentStepIndex && status !== "done";
                
                return (
                  <div key={step.id} className="flex items-center gap-4 group">
                    <div className={`
                      h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-500
                      ${isCompleted ? "bg-green-500 border-green-500 text-white" : 
                        isCurrent ? "border-ai bg-ai/10 text-ai" : "border-border text-muted-foreground"}
                    `}>
                      {isCompleted ? (
                        <CheckCircle2 className="h-6 w-6 animate-in zoom-in duration-300" />
                      ) : isCurrent ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-current" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-bold tracking-tight ${isCompleted ? "text-foreground" : isCurrent ? "text-ai" : "text-muted-foreground"}`}>
                        {step.label}
                      </p>
                      {isCurrent && (
                        <p className="text-[10px] uppercase tracking-widest font-extrabold text-ai/60 mt-1">
                          {getDynamicMessage()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-8 border-t border-border mt-10">
              {elapsed > 90 ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => window.location.reload()}
                      className="flex-1 py-4 rounded-xl bg-ai text-white font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-ai/20 flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Aguardar mais
                    </button>
                    <button
                      onClick={() => nav({ to: "/cadastro-manual" })}
                      className="flex-1 py-4 rounded-xl bg-secondary text-foreground font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
                    >
                      <ClipboardList className="h-3.5 w-3.5" /> Digitar Manual
                    </button>
                  </div>
                  <p className="text-[9px] text-center text-muted-foreground font-bold uppercase tracking-widest px-4">
                    Documentos complexos podem levar até 3 minutos.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-ai/5 rounded-2xl p-4 mb-8">
                    <p className="text-[11px] font-bold text-ai uppercase tracking-widest text-center">
                      Você pode minimizar o app. O resultado será salvo.
                    </p>
                  </div>
                  
                  <button
                    onClick={() => {
                      pollingRef.current = false;
                      nav({ to: "/dashboard" });
                    }}
                    className="w-full py-4 rounded-xl border border-border text-muted-foreground font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-secondary transition-colors"
                  >
                    <X className="h-4 w-4" /> Cancelar Processamento
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
