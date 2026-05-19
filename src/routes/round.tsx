import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { motorLuanService } from "@/lib/motorLuanService";
import {
  Stethoscope, Users, FileText, FlaskConical, Clock, Settings as SettingsIcon,
  AlertTriangle, Shield, Brain, Sparkles, Copy, ChevronRight,
  Map as MapIcon, Mic, ArrowLeft, X, Printer, Download, Share2,
  Search, FileOutput, Plus, Upload, ImageIcon, ClipboardPaste, Check, Loader2, Info
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { plantaoImportService, type ImportedPatient } from "@/lib/plantaoImportService";

export const Route = createFileRoute("/round")({
  component: RoundInteligente,
  head: () => ({ meta: [{ title: "Round Inteligente — DOUTOR AJUDA" }] }),
});

const TODAY = new Date().toLocaleDateString("pt-BR");

function RoundInteligente() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState(0);
  const [showMapa, setShowMapa] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [showRelatorios, setShowRelatorios] = useState(false);
  const [search, setSearch] = useState("");
  const [generatedRelatorio, setGeneratedRelatorio] = useState<string | null>(null);

  // Novos estados para importação
  const [showImport, setShowImport] = useState(false);
  const [importTab, setImportTab] = useState(0);
  const [importText, setImportText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState(0);
  const [importedPatients, setImportedPatients] = useState<ImportedPatient[]>([]);
  const [mapaGerado, setMapaGerado] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);

  const patients = mapaGerado ? importedPatients : [];
  const patient = patients.find(p => p.id === selectedId) || null;

  const steps = [
    "LENDO EVOLUÇÕES DE ONTEM...",
    "IDENTIFICANDO LEITOS E PACIENTES...",
    "EXTRAINDO DIAGNÓSTICOS E PENDÊNCIAS...",
    "ANALISANDO LABORATÓRIO E ANTIBIÓTICOS...",
    "GERANDO MAPA DE PASSAGEM...",
    "MONTANDO ALERTAS CRÍTICOS..."
  ];

  async function handleProcess() {
    setIsProcessing(true);
    setProcessStep(0);
    
    // Simula as etapas do loading
    for (let i = 1; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 600));
      setProcessStep(i);
    }

    const result = await plantaoImportService.processarTextoEvolucoes(importText);
    setImportedPatients(result);
    setIsProcessing(false);
    setIsReviewing(true);
  }

  function confirmImport() {
    setMapaGerado(true);
    setIsReviewing(false);
    setShowImport(false);
    setSelectedId(importedPatients[0]?.id || null);
    toast.success("Mapa de passagem gerado com sucesso!");
  }

  const filteredPatients = useMemo(() => {
    if (!search.trim()) return patients;
    const s = search.toLowerCase();
    return patients.filter(p => 
      p.nome.toLowerCase().includes(s) || 
      p.leito.toLowerCase().includes(s) ||
      p.diagnosticos.toLowerCase().includes(s)
    );
  }, [search, patients]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado com sucesso!");
  };

  const handleGerarRelatorio = (tipo: "transferencia" | "alta" | "obito") => {
    if (!patient) return;
    const text = motorLuanService.gerarRelatorio(tipo, patient as any);
    setGeneratedRelatorio(text);
  };

  return (
    <div className="h-[100dvh] flex overflow-hidden bg-subtle">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
          .print-card { border: 1px solid #eee !important; margin-bottom: 20px !important; page-break-inside: avoid; }
        }
        .print-only { display: none; }
      `}</style>

      {/* ===== SIDEBAR ICONS (REMOVIDO / INTEGRADO) ===== */}

      {/* ===== PATIENT LIST (CENSO) — desktop only ===== */}
      <aside className="hidden md:flex w-80 bg-elevated border-r border-border flex-col shrink-0 overflow-hidden no-print">
        <div className="px-6 pt-6 pb-4 border-b border-border bg-subtle">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">CENSO ATUAL</h2>
            <Badge variant="soft">{patients.length} LEITOS</Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="BUSCAR LEITO OU NOME..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-elevated border border-border rounded-xl pl-10 pr-4 py-2.5 text-[11px] font-bold uppercase focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-subtle/50">
          {!mapaGerado ? (
            <div className="py-20 text-center px-6">
              <Info className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
              <p className="text-[10px] font-black text-muted-foreground uppercase leading-relaxed">
                Aguardando importação para carregar censo
              </p>
            </div>
          ) : (
            patients.map(p => (
              <button key={p.id} onClick={() => setSelectedId(p.id)}
                className={`w-full text-left p-4 rounded-2xl transition-all border ${selectedId === p.id ? "bg-elevated border-primary shadow-md ring-1 ring-primary/10" : "bg-elevated/60 border-transparent hover:bg-elevated hover:border-border"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-foreground">{p.leito}</span>
                    <span className="h-2 w-2 rounded-full bg-success" />
                  </div>
                  <ChevronRight className={`h-3 w-3 transition-transform ${selectedId === p.id ? "text-primary translate-x-1" : "text-muted-foreground/60"}`} />
                </div>
                <p className="text-[11px] font-bold text-foreground truncate mb-1 uppercase">{p.nome.split(" ").slice(0, 2).join(" ")}</p>
                <p className="text-[9px] text-muted-foreground font-bold truncate uppercase">{p.diagnosticos}</p>
                {p.alertas.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.alertas.slice(0, 2).map(t => (
                      <span key={t} className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20">{t}</span>
                    ))}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="bg-elevated border-b border-border px-4 md:px-8 py-3 md:py-0 md:h-16 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 shrink-0 no-print shadow-sm z-10">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <Link to="/dashboard" className="h-10 w-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-subtle transition-all shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <h1 className="text-sm font-black text-foreground tracking-widest uppercase truncate">DOUTOR AJUDA</h1>
              <Badge variant="navy">ROUND {TODAY}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-3 flex-wrap">
            <button
              onClick={() => setShowImport(true)}
              className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-5 h-10 md:py-2.5 rounded-xl bg-ai text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-md shadow-purple-500/20"
            >
              <FileOutput className="h-4 w-4" />
              <span className="hidden sm:inline">IMPORTAR EVOLUÇÕES DE ONTEM</span>
              <span className="sm:hidden">IMPORTAR</span>
            </button>
            <button
              onClick={() => setShowMapa(true)}
              disabled={!mapaGerado}
              className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-5 h-10 md:py-2.5 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
            >
              <MapIcon className="h-4 w-4" />
              <span className="hidden sm:inline">MAPA ROUND</span>
              <span className="sm:hidden">MAPA</span>
            </button>
            <button
              onClick={() => setShowBriefing(true)}
              disabled={!mapaGerado}
              className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-5 h-10 md:py-2.5 rounded-xl border-2 border-border text-foreground text-[10px] font-black uppercase tracking-widest hover:bg-subtle transition-all disabled:opacity-50"
            >
              <Mic className="h-4 w-4" /> BRIEFING
            </button>
          </div>
        </header>

        {/* Censo mobile: select de paciente — md:hidden */}
        {mapaGerado && patients.length > 0 && (
          <div className="md:hidden bg-elevated border-b border-border px-4 py-2 shrink-0 no-print">
            <label className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0">Paciente</span>
              <select
                value={selectedId ?? ""}
                onChange={(e) => setSelectedId(e.target.value)}
                className="flex-1 h-10 px-3 rounded-md border border-border bg-elevated text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">— Escolher leito —</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.leito} · {p.nome.split(" ").slice(0, 2).join(" ")}
                  </option>
                ))}
              </select>
              <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{patients.length}</span>
            </label>
          </div>
        )}

        {/* Patient Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 no-print custom-scrollbar">
          {!mapaGerado ? (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-6">
              <div className="h-24 w-24 rounded-[2.5rem] bg-elevated shadow-2xl flex items-center justify-center text-ai mb-4">
                <FileOutput className="h-10 w-10" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-foreground mb-2 uppercase tracking-tight">Importe as evoluções de ontem</h2>
                <p className="text-sm text-muted-foreground leading-relaxed font-bold">
                  PARA GERAR O MAPA DE PASSAGEM INTELIGENTE, PRECISAMOS PROCESSAR AS EVOLUÇÕES DO DIA ANTERIOR. VOCÊ PODE COLAR O TEXTO OU ENVIAR ARQUIVOS.
                </p>
              </div>
              <button 
                onClick={() => setShowImport(true)}
                className="px-10 py-4 rounded-2xl bg-ai text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-purple-500/30 hover:scale-105 active:scale-95 transition-all"
              >
                COMEÇAR IMPORTAÇÃO
              </button>
            </div>
          ) : patient ? (
            <>
              {/* Painel de Alertas Críticos do Mapa */}
              <div className="flex gap-3 mb-8 overflow-x-auto pb-2 no-scrollbar">
                {patients.map(p => p.alertas.map(a => (
                  <div key={`${p.id}-${a}`} className="flex items-center gap-3 bg-elevated border border-destructive/30 rounded-2xl p-4 shrink-0 shadow-sm shadow-red-100">
                    <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive font-black text-xs border border-destructive/30/30">
                      {p.leito}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-destructive uppercase tracking-widest">{a}</p>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">{p.nome.split(" ")[0]}</p>
                    </div>
                  </div>
                ))).flat()}
              </div>

              <div className="flex items-start justify-between mb-8">
                <div>
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-4xl font-black text-foreground tracking-tighter">{patient.leito}</span>
                    <span className="text-2xl font-black text-foreground uppercase tracking-tight">{patient.nome}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-bold uppercase tracking-widest">
                    <span>{patient.idade} ANOS</span>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                    <span className="text-primary">{patient.diagnosticos}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="ai" size="xl">MOTOR LUAN — IA SIMULADA</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-8">
                <div className="space-y-8">
                  <Card title="RESUMO DO QUADRO ATUAL" icon={<Sparkles className="h-5 w-5 text-primary" />} accent>
                    <p className="text-[13px] leading-[1.8] text-foreground font-bold uppercase">{patient.quadro}</p>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card title="ANTIBIÓTICOS" icon={<FlaskConical className="h-5 w-5 text-primary" />}>
                      <div className="p-4 bg-subtle border border-primary/30 rounded-2xl">
                        <p className="text-xs font-black text-foreground uppercase tracking-tight">{patient.antibioticos}</p>
                      </div>
                    </Card>
                    <Card title="DISPOSITIVOS" icon={<Shield className="h-5 w-5 text-success" />}>
                      <div className="p-4 bg-success/10 border border-success/30 rounded-2xl">
                        <p className="text-xs font-black text-success uppercase tracking-tight">{patient.dispositivos}</p>
                      </div>
                    </Card>
                  </div>

                  <Card title="LABORATÓRIO IMPORTANTE" icon={<Info className="h-5 w-5 text-primary" />}>
                    <div className="bg-navy rounded-2xl p-6 shadow-inner">
                      <p className="text-xs font-mono leading-relaxed text-white opacity-90 uppercase">{patient.laboratorio}</p>
                    </div>
                  </Card>
                </div>

                <div className="space-y-8">
                  <div className="bg-elevated rounded-[2.5rem] p-8 border border-border shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center text-warning">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">PENDÊNCIAS CRÍTICAS</h3>
                    </div>
                    <p className="text-xs font-bold leading-relaxed text-foreground uppercase">{patient.pendencias}</p>
                  </div>

                  <Card title="INTERCORRÊNCIAS" icon={<Clock className="h-5 w-5 text-muted-foreground" />}>
                    <p className="text-xs font-bold leading-relaxed text-muted-foreground uppercase">{patient.intercorrencias}</p>
                  </Card>

                  <div className="rounded-[2.5rem] border-2 border-destructive/30 bg-destructive/10 p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <Shield className="h-5 w-5 text-destructive" />
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-destructive">ALERTAS DO ROUND</h3>
                    </div>
                    <div className="space-y-4">
                      {patient.alertas.map((a, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="h-1.5 w-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                          <p className="text-xs font-black text-destructive uppercase leading-tight">{a}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </main>

      {/* ===== MODALS ===== */}
      {/* ===== MODAL DE IMPORTAÇÃO ===== */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-6 no-print">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-md" onClick={() => !isProcessing && setShowImport(false)} />
          <div className="relative w-full max-w-4xl bg-elevated rounded-t-2xl md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-[95vh] md:h-auto md:max-h-[90vh] animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-300">
            <header className="px-10 py-8 border-b border-border flex items-center justify-between bg-subtle">
              <div>
                <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Importar Evoluções de Ontem</h3>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-1">MOTOR LUAN — INTELIGÊNCIA CLÍNICA</p>
              </div>
              <button onClick={() => setShowImport(false)} className="h-12 w-12 rounded-2xl border border-border flex items-center justify-center text-muted-foreground hover:bg-elevated transition-all">
                <X className="h-6 w-6" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto">
              {isProcessing ? (
                <div className="h-full flex flex-col items-center justify-center p-20 text-center">
                  <div className="relative mb-10">
                    <Loader2 className="h-24 w-24 text-ai animate-spin opacity-20" />
                    <Sparkles className="h-10 w-10 text-ai absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                  <h4 className="text-lg font-black text-foreground uppercase tracking-widest mb-4 animate-pulse">
                    {steps[processStep]}
                  </h4>
                  <div className="w-64 h-1.5 bg-subtle rounded-full overflow-hidden">
                    <div className="h-full bg-ai transition-all duration-500" style={{ width: `${((processStep + 1) / steps.length) * 100}%` }} />
                  </div>
                </div>
              ) : isReviewing ? (
                <div className="p-10 space-y-8">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-foreground uppercase tracking-widest">{importedPatients.length} Pacientes Identificados</h4>
                    <Badge variant="soft">REVISÃO NECESSÁRIA</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {importedPatients.map(p => (
                      <div key={p.id} className="p-5 rounded-2xl border border-border bg-subtle hover:border-ai/30 transition-all">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black text-foreground">{p.leito} — {p.nome}</span>
                          <button className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                        </div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase truncate">{p.diagnosticos}</p>
                        <div className="flex flex-wrap gap-1 mt-3">
                          {p.alertas.map(a => (
                            <span key={a} className="text-[8px] font-black uppercase px-2 py-0.5 rounded-md bg-elevated border border-border text-destructive">{a}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-10">
                  <div className="flex gap-4 mb-8">
                    {["COLAR TEXTO", "ENVIAR ARQUIVOS", "FOTO / PRINT"].map((t, i) => (
                      <button key={t} onClick={() => setImportTab(i)}
                        className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border-2 ${importTab === i ? "bg-ai text-white border-ai shadow-lg shadow-purple-500/20" : "bg-elevated text-muted-foreground border-border hover:border-ai/30 hover:text-ai"}`}>
                        {i === 0 ? <ClipboardPaste className="h-4 w-4 mx-auto mb-2" /> : i === 1 ? <Upload className="h-4 w-4 mx-auto mb-2" /> : <ImageIcon className="h-4 w-4 mx-auto mb-2" />}
                        {t}
                      </button>
                    ))}
                  </div>

                  {importTab === 0 ? (
                    <div className="space-y-4">
                      <textarea 
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder="COLE AQUI TODAS AS EVOLUÇÕES DE ONTEM, UMA APÓS A OUTRA, COM LEITO/NOME/EVOLUÇÃO/LABS/PENDÊNCIAS..."
                        className="w-full h-80 bg-subtle border-2 border-border rounded-[2rem] p-8 text-xs font-bold uppercase placeholder:text-muted-foreground/60 focus:outline-none focus:border-ai transition-all custom-scrollbar"
                      />
                    </div>
                  ) : (
                    <div className="h-80 border-4 border-dashed border-border rounded-[3rem] flex flex-col items-center justify-center text-muted-foreground bg-subtle">
                      <Upload className="h-12 w-12 mb-4 opacity-20" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Apenas simulado nesta etapa</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <footer className="px-10 py-8 border-t border-border bg-elevated flex justify-end gap-4">
              {!isReviewing ? (
                <button 
                  onClick={handleProcess}
                  disabled={!importText.trim() || isProcessing}
                  className="px-10 py-4 rounded-2xl bg-ai text-white font-black uppercase tracking-widest text-[11px] shadow-xl shadow-purple-500/20 disabled:opacity-50"
                >
                  PROCESSAR EVOLUÇÕES
                </button>
              ) : (
                <>
                  <button onClick={() => setIsReviewing(false)} className="px-8 py-4 rounded-2xl border-2 border-border text-foreground font-black uppercase tracking-widest text-[11px]">VOLTAR</button>
                  <button onClick={confirmImport} className="px-10 py-4 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-[11px] shadow-xl shadow-blue-500/20">USAR PARA GERAR MAPA</button>
                </>
              )}
            </footer>
          </div>
        </div>
      )}

      {/* ===== MODAL DE MAPA ===== */}
      {showMapa && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-6 no-print">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-md" onClick={() => setShowMapa(false)} />
          <div className="relative w-full max-w-5xl bg-elevated rounded-t-2xl md:rounded-[3rem] shadow-2xl flex flex-col h-[95vh] md:h-auto md:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-300">
            <header className="px-10 py-8 border-b border-border flex items-center justify-between bg-subtle">
              <div>
                <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Mapa de Passagem de Plantão</h3>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-1">CLÍNICA MÉDICA FEMININA (CMF) — {TODAY}</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => window.print()} className="h-12 px-6 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all">
                  <Printer className="h-5 w-5" /> IMPRIMIR MAPA
                </button>
                <button onClick={() => setShowMapa(false)} className="h-12 w-12 rounded-2xl border border-border flex items-center justify-center text-muted-foreground hover:bg-elevated transition-all">
                  <X className="h-6 w-6" />
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-10">
              <div className="bg-subtle border-2 border-border rounded-[2rem] p-10 font-mono text-[11px] leading-relaxed text-foreground whitespace-pre-wrap select-all">
                {plantaoImportService.gerarTextoMapa(patients, "CLÍNICA MÉDICA FEMININA")}
              </div>
            </div>
            <footer className="px-10 py-8 border-t border-border bg-elevated flex justify-end gap-3">
              <button onClick={() => copyToClipboard(plantaoImportService.gerarTextoMapa(patients, "CLÍNICA MÉDICA FEMININA"))}
                className="px-8 py-4 rounded-2xl border-2 border-border text-foreground font-black uppercase tracking-widest text-[11px] flex items-center gap-2 hover:bg-subtle transition-all">
                <Copy className="h-4 w-4" /> COPIAR TEXTO
              </button>
              <button onClick={() => setShowMapa(false)} className="px-10 py-4 rounded-2xl bg-navy text-white font-black uppercase tracking-widest text-[11px]">FECHAR</button>
            </footer>
          </div>
        </div>
      )}

      {/* ===== MODAL DE BRIEFING ===== */}
      {showBriefing && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-6 no-print">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-md" onClick={() => setShowBriefing(false)} />
          <div className="relative w-full max-w-2xl bg-elevated rounded-t-2xl md:rounded-[3rem] shadow-2xl overflow-hidden max-h-[95vh] md:max-h-[90vh] animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-300">
            <header className="px-10 py-8 border-b border-border flex items-center justify-between bg-subtle">
              <div>
                <h3 className="text-lg font-black text-foreground uppercase tracking-tight">Briefing de Plantão</h3>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-1">ROTEIRO PARA ROUND COLETIVO</p>
              </div>
              <button onClick={() => setShowBriefing(false)} className="h-10 w-10 rounded-2xl border border-border flex items-center justify-center text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="p-10">
              <div className="bg-navy rounded-2xl p-8 text-white/90 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                {plantaoImportService.gerarBriefing(patients, "CLÍNICA MÉDICA FEMININA")}
              </div>
            </div>
            <footer className="px-10 py-8 border-t border-border flex justify-end gap-3">
              <button onClick={() => copyToClipboard(plantaoImportService.gerarBriefing(patients, "CLÍNICA MÉDICA FEMININA"))}
                className="px-8 py-4 rounded-2xl border-2 border-border text-foreground font-black uppercase tracking-widest text-[11px] flex items-center gap-2"><Copy className="h-4 w-4" /> COPIAR BRIEFING</button>
              <button onClick={() => setShowBriefing(false)} className="px-8 py-4 rounded-2xl bg-navy text-white font-black uppercase tracking-widest text-[11px]">FECHAR</button>
            </footer>
          </div>
        </div>
      )}

      {/* ===== PRINT LAYOUT (HIDDEN) ===== */}
      <div className="print-only p-12">
        <h1 className="text-3xl font-black mb-2 uppercase tracking-tighter">MAPA DE PASSAGEM DE PLANTÃO</h1>
        <p className="text-xs font-bold text-muted-foreground mb-8 uppercase tracking-[0.3em]">HNAS ASSIST — CLÍNICA MÉDICA FEMININA — {TODAY}</p>
        
        <div className="space-y-8">
          {patients.map(p => (
            <div key={p.id} className="pb-8 border-b-2 border-dashed border-border last:border-0 page-break-inside-avoid">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black text-foreground uppercase tracking-tight">{p.leito} — {p.nome} ({p.idade}A)</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 text-[11px] font-bold uppercase leading-relaxed text-foreground">
                <p><span className="text-muted-foreground">DIAGNÓSTICOS:</span> {p.diagnosticos}</p>
                <p><span className="text-muted-foreground">ATB:</span> {p.antibioticos}</p>
                <p><span className="text-muted-foreground">QUADRO:</span> {p.quadro}</p>
                <p><span className="text-muted-foreground">PENDÊNCIAS:</span> {p.pendencias}</p>
                {p.alertas.length > 0 && <p className="text-destructive"><span className="text-muted-foreground">ALERTAS:</span> {p.alertas.join("; ")}</p>}
              </div>
            </div>
          ))}
        </div>
        
        <footer className="mt-12 pt-8 border-t border-border text-center">
          <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-[0.5em]">GERADO PELO SISTEMA DOUTOR AJUDA — MOTOR LUAN IA</p>
        </footer>
      </div>
    </div>
  );
}

function Card({ title, icon, accent, badge, children }: {
  title: string; icon: React.ReactNode; accent?: boolean; badge?: string; children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl md:rounded-[2.5rem] border p-4 md:p-8 shadow-sm transition-all duration-300 hover:shadow-md ${accent ? "bg-primary/5 border-primary/30" : "bg-elevated border-border"}`}>
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${accent ? "bg-elevated text-primary" : "bg-subtle text-muted-foreground"}`}>
            {icon}
          </div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">{title}</h3>
        </div>
        {badge && <span className="text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-ai/10 text-ai border border-ai/10">{badge}</span>}
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}
