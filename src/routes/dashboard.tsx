import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Stethoscope, Plus, Settings, Map, LayoutGrid, BedDouble, ArrowLeft, AlertCircle, ChevronRight, ArrowRight, FileUp } from "lucide-react";
import { usePatients, deletePatient, addPatient, type Patient } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { extractBulkPatientsWithAI } from "@/lib/bulkService";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Plantão — Clínica Médica" }] }),
});

function statusBadge(s: Patient["status"]) {
  switch (s) {
    case "PENDENTE": return <Badge variant="warning">PENDENTE</Badge>;
    case "EVOLUÇÃO GERADA": return <Badge variant="success">EVOLUÇÃO GERADA</Badge>;
    case "ALERTA RENAL": return <Badge variant="destructive">ALERTA RENAL</Badge>;
    case "ATB D4/7": return <Badge variant="ai">ATB D4/7</Badge>;
  }
}

function Dashboard() {
  const { patients, refresh } = usePatients();
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"gestao" | "mapa">("gestao");
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const nav = useNavigate();
  
  const today = new Date().toISOString().split("T")[0];
  const shiftPatients = patients.filter((p) => p.admission === today);
  const sel = shiftPatients.find((p) => p.id === selected) || shiftPatients[0];

  const handleFileUpload = async (files: FileList) => {
    setIsProcessing(true);
    toast.info("Processando arquivos...");

    // Imports dinâmicos para evitar erro de DOMMatrix no SSR (Node.js)
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    const mammoth = (await import("mammoth")).default;

    try {
      let totalAdded = 0;

      // Processa cada arquivo individualmente para respeitar limite de tokens da IA
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        toast.info(`Processando arquivo ${i + 1}/${files.length}: ${file.name}...`);

        let fileText = "";

        if (file.type === "application/pdf") {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          for (let j = 1; j <= pdf.numPages; j++) {
            const page = await pdf.getPage(j);
            const content = await page.getTextContent();
            fileText += content.items.map((item: any) => item.str).join(" ") + "\n";
          }
        } else if (file.name.endsWith(".docx")) {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          fileText = result.value;
        } else if (file.type === "text/plain") {
          fileText = await file.text();
        }

        if (!fileText.trim()) continue;

        const newPatients = await extractBulkPatientsWithAI(fileText, "CLÍNICA MÉDICA", file.name);

        for (const p of newPatients) {
          await addPatient({ ...p, admission: today, hda: p.hda || "" });
          totalAdded++;
        }
      }

      if (totalAdded === 0) {
        toast.warning("Nenhum paciente encontrado nos arquivos.");
      } else {
        toast.success(`${totalAdded} paciente(s) adicionado(s) ao plantão!`);
      }
      refresh();
    } catch (e: any) {
      toast.error(`Falha ao processar: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1500px] mx-auto px-6 h-16 flex items-center gap-6">
          <Link to="/tipo" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-navy text-navy-foreground grid place-items-center shadow-md">
              <Stethoscope className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-tight text-foreground">DOUTOR AJUDA</div>
              <div className="label-tech text-[10px] -mt-0.5 text-primary">CLÍNICA MÉDICA</div>
            </div>
          </div>

          <nav className="ml-6 hidden md:flex items-center gap-1 bg-secondary/50 p-1 rounded-xl">
            <button onClick={() => setTab("gestao")} className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${tab === "gestao" ? "bg-white text-navy shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <LayoutGrid className="inline h-3.5 w-3.5 mr-1.5" /> GESTÃO
            </button>
            <button onClick={() => setTab("mapa")} className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${tab === "mapa" ? "bg-white text-navy shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Map className="inline h-3.5 w-3.5 mr-1.5" /> MAPA VIRTUAL
            </button>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => nav({ to: "/novo-paciente" })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300"
            >
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">NOVO PACIENTE</span>
            </button>
            <button
              onClick={() => nav({ to: "/round" })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-navy text-white text-xs font-bold uppercase tracking-widest shadow-lg hover:shadow-navy/40 hover:-translate-y-0.5 transition-all duration-300"
            >
              <Map className="h-4 w-4" /> <span className="hidden sm:inline">ROUND</span>
            </button>
            <Link to="/configuracoes" className="h-10 w-10 rounded-xl border border-border grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-border transition-all">
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1500px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8">
        <aside className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="label-tech font-bold">PLANTÃO DE HOJE · {shiftPatients.length}</h2>
            <span className="label-tech text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-md">{shiftPatients.filter(p => p.status === "EVOLUÇÃO GERADA").length} EVOLUÍDOS</span>
          </div>

          <div className="space-y-3">
            {shiftPatients.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                onDoubleClick={() => nav({ to: "/evolucao/$id", params: { id: p.id } })}
                className={`group w-full text-left rounded-2xl border p-4 transition-all duration-300 ${sel?.id === p.id ? "bg-white border-primary shadow-xl shadow-primary/10 ring-1 ring-primary/20" : "bg-card border-border hover:border-primary/40 hover:shadow-md"}`}
              >
                <div className="flex items-start gap-3">
                  <Badge variant={sel?.id === p.id ? "brand" : "navy"} size="lg" className="font-mono shadow-sm">{p.bed}</Badge>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-sm text-foreground truncate mb-0.5">{p.name}</div>
                    <div className="text-[11px] font-medium text-muted-foreground tracking-wide">{p.age} ANOS · {p.sex === "F" ? "FEM" : "MASC"}</div>
                    <div className="mt-2.5 flex items-center justify-between">
                      {statusBadge(p.status)}
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${sel?.id === p.id ? "translate-x-1 text-primary" : "opacity-0 group-hover:opacity-100"}`} />
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex flex-col gap-6">
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files); }}
            className={`bg-white border-2 border-dashed rounded-[2rem] p-8 text-center transition-all duration-300 relative overflow-hidden ${isDragging ? "border-ai bg-ai/5 scale-[1.02]" : "border-border hover:border-ai/50 hover:bg-ai/5"}`}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center space-y-4 py-4">
                <div className="h-12 w-12 rounded-full bg-ai/20 flex items-center justify-center animate-pulse mb-2">
                  <Stethoscope className="h-6 w-6 text-ai animate-spin" />
                </div>
                <p className="font-bold text-sm tracking-widest text-ai uppercase">MÉDICO VIRTUAL LENDO PRONTUÁRIOS...</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">Extraindo dados vitais e identificação. Isso pode levar alguns segundos.</p>
              </div>
            ) : (
              <>
                <div className="absolute inset-0 bg-gradient-to-br from-ai/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="h-16 w-16 rounded-2xl bg-ai/10 flex items-center justify-center mx-auto mb-4 text-ai">
                  <FileUp className="h-8 w-8" />
                </div>
                <h3 className="font-extrabold text-lg tracking-tight mb-2">IMPORTAÇÃO EM LOTE</h3>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">ARRASTE PDFs OU DOCs DE VÁRIOS PACIENTES AQUI</p>
                <label className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-ai text-ai-foreground text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-ai/20 hover:-translate-y-0.5 transition-all">
                  SELECIONAR ARQUIVOS
                  <input type="file" multiple accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => e.target.files && handleFileUpload(e.target.files)} />
                </label>
              </>
            )}
          </div>

          <div className="bg-white border border-border rounded-[2rem] min-h-[500px] p-8 md:p-10 shadow-sm relative overflow-hidden flex-1">
          {!sel ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl animate-pulse" />
                <div className="h-24 w-24 rounded-[2rem] bg-secondary/50 border border-border flex items-center justify-center relative z-10 shadow-sm">
                  <BedDouble className="h-10 w-10 text-muted-foreground/60" />
                </div>
              </div>
              <h3 className="text-2xl font-extrabold tracking-tight text-foreground mb-2">MAPA VAZIO</h3>
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                Nenhum paciente no plantão de hoje. Arraste arquivos na área acima ou crie manualmente.
              </p>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col md:flex-row items-start justify-between gap-6 pb-8 border-b border-border/50">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <Badge variant="navy" size="xl" className="font-mono text-sm px-3 shadow-sm">{sel.bed}</Badge>
                    {statusBadge(sel.status)}
                  </div>
                  <h2 className="text-3xl font-extrabold tracking-tight text-foreground leading-none">{sel.name}</h2>
                  <p className="text-sm font-medium text-muted-foreground mt-3 tracking-wide">{sel.age} ANOS · {sel.sex === "F" ? "FEMININO" : "MASCULINO"} · {sel.sector}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => nav({ to: "/evolucao/$id", params: { id: sel.id } })}
                    className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-navy text-navy-foreground text-xs font-bold uppercase tracking-widest shadow-xl shadow-navy/10 hover:shadow-navy/30 hover:-translate-y-0.5 transition-all duration-300"
                  >
                    ABRIR EVOLUÇÃO
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm("Deseja realmente apagar este paciente do plantão?")) {
                        await deletePatient(sel.id);
                        setSelected(null);
                        refresh();
                        toast.success("Paciente removido.");
                      }
                    }}
                    className="px-4 py-3.5 rounded-xl border border-destructive/20 text-destructive text-xs font-bold uppercase tracking-widest hover:bg-destructive/10 transition-all"
                  >
                    APAGAR
                  </button>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "ADMISSÃO", value: sel.admission ? sel.admission.split("-").reverse().join("/") : "—" },
                  { label: "ANTIBIÓTICO", value: sel.data?.abx?.[0]?.name || "NÃO REFERIDO" },
                  { label: "ALERGIAS", value: "NÃO REFERIDO" },
                  { label: "ÚLTIMA EVOL.", value: sel.status === "EVOLUÇÃO GERADA" ? "HOJE" : "PENDENTE" },
                ].map((m) => (
                  <div key={m.label} className="rounded-2xl bg-secondary/50 border border-border/50 p-4 transition-colors hover:bg-secondary">
                    <div className="label-tech text-[10px] mb-1.5">{m.label}</div>
                    <div className="font-bold text-sm truncate text-foreground">{m.value}</div>
                  </div>
                ))}
              </div>

              {sel.hda && (
                <div className="mt-8">
                  <div className="label-tech mb-3 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    HISTÓRIA DA DOENÇA ATUAL
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <p className="text-sm leading-relaxed text-muted-foreground">{sel.hda}</p>
                  </div>
                </div>
              )}

              {sel.status === "ALERTA RENAL" && (
                <div className="mt-8 rounded-2xl border border-destructive/20 bg-destructive/5 p-5 flex gap-4 shadow-sm">
                  <div className="h-10 w-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-extrabold text-destructive text-sm tracking-wide mb-1">ATENÇÃO RENAL</div>
                    <p className="text-sm text-destructive/80 leading-relaxed">
                      Verificar ajuste de dose de medicamentos com excreção renal. A TFGe do paciente indica necessidade de revisão.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}
