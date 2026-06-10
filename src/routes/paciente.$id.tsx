import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { 
  ChevronLeft, User, Activity, Pill, AlertTriangle, 
  Calendar, Building2, ClipboardList, FileText, 
  Plus, CheckCircle2, FileUp, Edit3, ArrowRight,
  TrendingUp, Clock, Info, Check, X
} from "lucide-react";
import { differenceInDays, parseISO, isValid, format, addDays, startOfDay } from "date-fns";
import { toast } from "sonner";
import { getPatientById, updatePatient, getEvolutionsByPatient } from "@/lib/db";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { computeGravidade, GRAVIDADE_STYLES } from "@/lib/gravidade";
import { useSpecialistConsult } from "@/components/specialists/useSpecialistConsult";
import SpecialistCard from "@/components/specialists/SpecialistCard";
import SpecialistDrawer from "@/components/specialists/SpecialistDrawer";
import { hasConsultForPatient } from "@/lib/specialists/client";
import ShiftBadge from "@/components/ShiftBadge";
import ThemeToggle from "@/components/ThemeToggle";
import ATBAlertBanner from "@/components/atb/ATBAlertBanner";
import ClinicalWatchdog from "@/components/watchdog/ClinicalWatchdog";
import type { PrescriptionItem } from "@/lib/clinical-protocols/types";

export const Route = createFileRoute("/paciente/$id")({
  component: PacienteDetailPage,
  head: () => ({ meta: [{ title: "Prontuário do Paciente — PLANTONISTA" }] }),
});

function PacienteDetailPage() {
  const { id } = useParams({ from: "/paciente/$id" });
  const nav = useNavigate();
  const { userId } = useSupabaseUser();
  const [paciente, setPaciente] = useState<any>(null);
  const [evolutions, setEvolutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalEvolucao, setModalEvolucao] = useState<any>(null);
  const [atbToFinalize, setAtbToFinalize] = useState<{ index: number; atb: any } | null>(null);

  const finalizeAtb = async (status: "finalizado" | "suspenso", dataFim: string) => {
    if (!atbToFinalize || !paciente) return;
    try {
      // Atualiza no objeto local
      const newAbx = [...paciente.data.abx];
      newAbx[atbToFinalize.index] = { ...newAbx[atbToFinalize.index], status, data_fim: dataFim };
      const newPaciente = { ...paciente, data: { ...paciente.data, abx: newAbx } };
      setPaciente(newPaciente);

      // Mapeia pro formato do DB (campos data_inicio, nome, etc)
      const dbAntibiotics = newAbx.map((a: any) => ({
        nome: a.name,
        dose: a.dose,
        via: a.via,
        frequencia: a.freq,
        data_inicio: a.d0,
        ...(a.data_fim ? { data_fim: a.data_fim } : {}),
        ...(a.status ? { status: a.status } : {}),
      }));

      // Persiste: Supabase primeiro, fallback localStorage
      if (userId && !id.startsWith("temp_")) {
        try {
          await updatePatient(id, { antibiotics: dbAntibiotics as any }, userId);
        } catch (e) {
          console.warn("Falha ao salvar no Supabase, salvo só local", e);
        }
      }
      // Atualiza localStorage também
      try {
        const local = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
        const idx = local.findIndex((p: any) => p.id === id);
        if (idx >= 0) {
          local[idx] = { ...local[idx], antibiotics: dbAntibiotics, antibioticos: dbAntibiotics };
          localStorage.setItem("da_pacientes", JSON.stringify(local));
        }
      } catch { /* ignore */ }

      setAtbToFinalize(null);
      toast.success(`${atbToFinalize.atb.name} marcado como ${status}`);
    } catch (e: any) {
      toast.error("Erro ao finalizar: " + (e.message || "?"));
    }
  };

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    async function loadData() {
      try {
        if (id.startsWith("temp_")) throw new Error("Local");
        const p = await getPatientById(id, userId!);
        
        // Map to component expected format
        const mapped = {
          id: p.id,
          name: p.name,
          bed: p.bed,
          age: p.age,
          sex: p.sex,
          sector: p.sector,
          admissionDate: p.admission_date,
          status: p.status,
          diagnoses: p.problem_list || [],
          comorbidities: p.comorbidities || [],
          pendingIssues: p.pending_issues || [],
          data: {
            abx: (p.antibiotics || []).map(a => ({
              name: a.nome, dose: a.dose, via: a.via, freq: a.frequencia, d0: a.data_inicio,
              data_fim: (a as any).data_fim, status: (a as any).status,
            })),
            lab: (p.labs?.length > 0) ? { 
              date: p.labs[0].data, 
              formatted: p.labs[0].texto_compacto 
            } : null
          }
        };
        setPaciente(mapped);

        const evs = await getEvolutionsByPatient(id, userId!);
        setEvolutions(evs || []);
      } catch (err) {
        // Local fallback
        const existing = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
        const p = existing.find((x: any) => x.id === id);
        if (p) {
          const atbList = p.antibioticos || p.antibiotics || [];
          const labList = p.laboratorios || p.labs || [];
          const pendList = p.pendencias || p.pending_issues || [];
          const problemList = p.lista_de_problemas || p.problem_list || [];
          const mapped = {
            id: p.id,
            name: p.nome || p.name,
            bed: p.leito || p.bed,
            age: p.idade || p.age,
            sex: p.sexo || p.sex,
            sector: p.setor || p.sector,
            admissionDate: p.data_admissao || p.admission_date || p.admissionDate,
            motivo_admissao: p.motivo_admissao || p.reason_for_admission,
            status: p.status,
            diagnoses: problemList.map((t: any) => (typeof t === "string" ? t : t.text || "")),
            comorbidities: p.antecedentes_patologicos || p.comorbidades || p.comorbidities || [],
            pendingIssues: pendList.map((t: any) => (typeof t === "string" ? t : t.text || "")),
            data: {
              abx: atbList.map((a: any) => ({
                name: a.nome || a.name, dose: a.dose, via: a.via, freq: a.frequencia,
                d0: a.dataInicio || a.data_inicio,
              })),
              lab: labList.length > 0 ? {
                date: labList[0].data,
                formatted: labList[0].valor || labList[0].texto_compacto,
              } : null,
            },
          };
          setPaciente(mapped);
          const localEvs = JSON.parse(localStorage.getItem("da_evolucoes") || "[]")
            .filter((e: any) => e.patient_id === id)
            .map((e: any) => ({ ...e, id: e.id || `${e.patient_id}_${e.created_at}` }))
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setEvolutions(localEvs);
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, userId]);

  const dihInfo = useMemo(() => {
    if (!paciente?.admissionDate && !paciente?.admission) return null;
    const admissionStr = paciente.admissionDate || paciente.admission;
    const admission = startOfDay(parseISO(admissionStr));
    if (!isValid(admission)) return null;
    const today = startOfDay(new Date());
    const days = differenceInDays(today, admission);
    
    return {
      d: days >= 0 ? `D${days}` : "D0",
      label: days === 0 ? "Admitido hoje" : `Admissão ${format(admission, "dd/MM/yyyy")}`
    };
  }, [paciente]);

  const handleStatusUpdate = async (status: string) => {
    if (!paciente || !userId) return;
    if (!id.startsWith("temp_")) {
      const p = await getPatientById(id, userId!);
      const newStatus = p.status === 'alta_provavel' ? 'internado' : 'alta_provavel';
      await updatePatient(id, { status: newStatus }, userId!);
      setPaciente({ ...p, status: newStatus });
      toast.success(newStatus === 'alta_provavel' ? "Marcado para alta!" : "Internação mantida.");
    } else {
      const existing = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
      const idx = existing.findIndex((x: any) => x.id === id);
      if (idx >= 0) {
        existing[idx].status = status;
        localStorage.setItem("da_pacientes", JSON.stringify(existing));
        setPaciente({ ...paciente, status });
        toast.success(status === "alta_provavel" ? "Alta provável marcada!" : "Status atualizado");
      }
    }
  };

  const [editingField, setEditingField] = useState<null | "name" | "bed">(null);
  const [editValue, setEditValue] = useState("");

  const gravidade = useMemo(() => computeGravidade({
    setor: paciente?.sector,
    antibioticos: paciente?.data?.abx?.map((a: any) => ({ nome: a.name, via: a.via, data_inicio: a.d0 })) || [],
    pendencias: paciente?.pendingIssues || [],
    lista_de_problemas: paciente?.diagnoses || [],
    motivo_admissao: paciente?.motivo_admissao,
    status: paciente?.status,
  }), [paciente]);

  const startEdit = (field: "name" | "bed") => {
    setEditingField(field);
    setEditValue(field === "name" ? (paciente?.name || "") : (paciente?.bed || ""));
  };

  const saveEdit = async () => {
    if (!editingField || !paciente) return;
    const field = editingField;
    const value = editValue.trim();
    setEditingField(null);
    if (!value || value === (field === "name" ? paciente.name : paciente.bed)) return;

    const updates: any = field === "name" ? { name: value } : { bed: value };
    const updatedLocal = { ...paciente, ...updates };
    setPaciente(updatedLocal);

    try {
      if (!id.startsWith("temp_") && userId) {
        await updatePatient(id, updates, userId);
      } else {
        const existing = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
        const idx = existing.findIndex((x: any) => x.id === id);
        if (idx >= 0) {
          if (field === "name") {
            existing[idx].nome = value;
            existing[idx].name = value;
          } else {
            existing[idx].leito = value;
            existing[idx].bed = value;
          }
          localStorage.setItem("da_pacientes", JSON.stringify(existing));
        }
      }
      toast.success("Salvo.");
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    }
  };

  const resolvePendencia = async (pendText: string) => {
    if (!paciente || !userId) return;
    const updatedPendencias = (paciente.pendingIssues || []).filter((p: string) => p !== pendText);
    const updated = { ...paciente, pendingIssues: updatedPendencias };
    setPaciente(updated);
    toast.success("Pendência resolvida!");
    
    if (!id.startsWith("temp_")) {
      await updatePatient(id, { pending_issues: updatedPendencias }, userId);
    } else {
      const existing = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
      const idx = existing.findIndex((x: any) => x.id === id);
      if (idx >= 0) {
        existing[idx].pendencias = existing[idx].pendencias.filter((p: any) => (p.text || p) !== pendText);
        localStorage.setItem("da_pacientes", JSON.stringify(existing));
      }
    }
  };

  // Hook do especialista — sempre antes dos early returns
  const { specialist, open: drawerOpen, loading: consultLoading, consult, triggerConsult, closeDrawer } = useSpecialistConsult({
    patient: paciente,
    evolutions,
    unitHint: paciente?.sector,
  });

  const handleAcceptSuggestions = async (acceptedTexts: string[]) => {
    if (!acceptedTexts.length || !paciente) return;
    const newPendingTexts = [...(paciente.pendingIssues || []), ...acceptedTexts];
    const updated = { ...paciente, pendingIssues: newPendingTexts };
    setPaciente(updated);
    try {
      if (!id.startsWith("temp_") && userId) {
        await updatePatient(id, { pending_issues: newPendingTexts }, userId);
      } else {
        const existing = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
        const idx = existing.findIndex((x: any) => x.id === id);
        if (idx >= 0) {
          const existingPend = (existing[idx].pendencias || existing[idx].pending_issues || []).map((p: any) => (typeof p === "string" ? { text: p } : p));
          const newOnes = acceptedTexts.map((t) => ({ text: t }));
          existing[idx].pendencias = [...existingPend, ...newOnes];
          existing[idx].pending_issues = [...(existing[idx].pending_issues || []), ...acceptedTexts];
          localStorage.setItem("da_pacientes", JSON.stringify(existing));
        }
      }
      toast.success(`${acceptedTexts.length} pendência(s) adicionada(s).`);
    } catch (err: any) {
      toast.error(`Erro ao adicionar pendências: ${err.message}`);
    }
  };

  if (loading) return null;
  if (!paciente) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold mb-4 uppercase tracking-tighter">Paciente não encontrado</h1>
        <Link to="/dashboard" className="text-primary font-black uppercase text-xs tracking-widest border-b-2 border-primary/20 hover:border-primary">Voltar ao Dashboard</Link>
      </div>
    );
  }

  const lastEvolution = evolutions[0];
  const gStyle = GRAVIDADE_STYLES[gravidade];

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Premium Header */}
      <header className="bg-elevated border-b border-border sticky top-0 z-30 shadow-sm overflow-hidden">
        <div className="absolute top-0 left-0 w-1 bg-primary h-full" />
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-8">
           <div className="flex items-center justify-between mb-4 md:mb-6 gap-2">
              <button onClick={() => nav({ to: "/dashboard" })} className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest">
                 <ChevronLeft className="h-4 w-4" />
                 <span className="hidden sm:inline">VOLTAR AO DASHBOARD</span>
                 <span className="sm:hidden">VOLTAR</span>
              </button>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                 <ShiftBadge />
                 <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${gStyle.bg} ${gStyle.text}`} aria-label={`Gravidade ${gStyle.label}`}>
                   {gStyle.label}
                 </span>
                 <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${paciente.status === 'alta_provavel' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                   {paciente.status === 'alta_provavel' ? 'ALTA PROVÁVEL' : 'INTERNADO'}
                 </span>
                 <ThemeToggle />
              </div>
           </div>

           <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                 {editingField === "name" ? (
                   <input
                     autoFocus
                     value={editValue}
                     onChange={(e) => setEditValue(e.target.value)}
                     onBlur={saveEdit}
                     onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingField(null); }}
                     className="text-3xl md:text-4xl font-black text-foreground tracking-tight mb-2 uppercase bg-secondary/60 border-b-2 border-primary px-3 py-1 rounded outline-none w-full max-w-lg"
                     aria-label="Editar nome do paciente"
                   />
                 ) : (
                   <h1
                     onClick={() => startEdit("name")}
                     className="text-3xl md:text-4xl font-black text-foreground tracking-tight mb-2 uppercase cursor-text hover:bg-secondary/40 px-3 py-1 -mx-3 rounded transition-colors"
                     title="Clique para editar"
                   >
                     {paciente.name}
                   </h1>
                 )}
                 <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    {editingField === "bed" ? (
                      <span className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        LEITO
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value.toUpperCase())}
                          onBlur={saveEdit}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingField(null); }}
                          className="w-20 px-2 py-0.5 bg-elevated border-b-2 border-primary outline-none uppercase font-bold"
                          aria-label="Editar leito"
                        />
                      </span>
                    ) : (
                      <button
                        onClick={() => startEdit("bed")}
                        className="flex items-center gap-1.5 cursor-text hover:bg-secondary/40 px-1.5 py-0.5 rounded transition-colors"
                        title="Clique para editar"
                      >
                        <div className="h-2 w-2 rounded-full bg-primary" /> LEITO {paciente.bed}
                      </button>
                    )}
                    <span className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-secondary" /> {paciente.age} ANOS · {paciente.sex === 'M' ? 'MASCULINO' : 'FEMININO'}</span>
                    <span className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-secondary" /> {paciente.sector}</span>
                 </div>
                 <div className="mt-3 text-[10px] font-black text-primary/60 uppercase tracking-widest flex items-center gap-2">
                    <Calendar className="h-3 w-3" /> {dihInfo?.d} · {dihInfo?.label}
                 </div>
              </div>
              <div className="bg-secondary/30 rounded-2xl px-6 py-4 border border-border">
                 <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">DATA DE ADMISSÃO</div>
                 <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-primary">{dihInfo?.d}</span>
                    <span className="text-xs font-bold text-muted-foreground tracking-tight">
                      {(() => {
                        try {
                          const dateStr = paciente.admissionDate || paciente.admission;
                          if (!dateStr) return "N/A";
                          const d = parseISO(dateStr);
                          return isValid(d) ? format(d, "dd/MM/yyyy") : dateStr;
                        } catch { return "N/A"; }
                      })()}
                    </span>
                 </div>
              </div>
           </div>
        </div>
      </header>

      {/* Barra de ações primárias */}
      <div className="bg-elevated/60 backdrop-blur border-b border-border sticky top-[152px] md:top-[176px] z-20">
         <div className="max-w-5xl mx-auto px-6 py-3 flex flex-wrap items-center gap-2 justify-center">
            <button
               onClick={() => nav({ to: "/evolucao/$id", params: { id } })}
               className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all flex items-center gap-2"
            >
               <TrendingUp className="h-3.5 w-3.5" /> EVOLUIR
            </button>
            <button
               onClick={() => nav({ to: "/prescricao/$id", params: { id } })}
               className="px-5 py-2.5 rounded-xl bg-navy text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-navy/20 hover:-translate-y-0.5 transition-all flex items-center gap-2"
            >
               <Pill className="h-3.5 w-3.5" /> PRESCREVER
            </button>
            <button
               onClick={() => nav({ to: "/upload-ia", search: { patient_id: id, tipo: "admissao", engine: "docling", modo: "unico" } as any })}
               className="px-5 py-2.5 rounded-xl border border-border bg-elevated text-foreground text-[10px] font-black uppercase tracking-widest hover:bg-secondary transition-all flex items-center gap-2"
            >
               <FileUp className="h-3.5 w-3.5" /> ANEXAR DOC
            </button>
            <button
               onClick={() => nav({ to: "/encaminhamento/$id", params: { id } })}
               className="px-5 py-2.5 rounded-xl border border-border bg-elevated text-foreground text-[10px] font-black uppercase tracking-widest hover:bg-secondary transition-all flex items-center gap-2"
            >
               <ArrowRight className="h-3.5 w-3.5" /> ENCAMINHAR
            </button>
            <button
               onClick={() => triggerConsult()}
               disabled={consultLoading}
               className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 ${specialist.cor.bg} ${specialist.cor.text} hover:-translate-y-0.5`}
               title={`Solicitar parecer do(a) ${specialist.nome}`}
            >
               <Activity className="h-3.5 w-3.5" /> PARECER {specialist.nome.split(" ")[1] || "IA"}
            </button>
            <button
               onClick={() => handleStatusUpdate('alta_provavel')}
               className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                  paciente.status === 'alta_provavel'
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                    : "border border-emerald-500/30 bg-elevated text-emerald-600 hover:bg-emerald-50 dark:bg-emerald-500/10"
               }`}
            >
               <Check className="h-3.5 w-3.5" /> {paciente.status === 'alta_provavel' ? 'ALTA MARCADA' : 'MARCAR ALTA'}
            </button>
         </div>
      </div>

      {/* Vigia Clínico — detecta hipoNa/hiperK/PNM/ITU/erisipela e sugere
          condutas com cálculo por peso/TFG. PoC com hiponatremia grave. */}
      <ClinicalWatchdog
        patient={paciente}
        onAddProblem={async (entry) => {
          const novosDiagnosticos = [...(paciente.diagnoses || []), entry];
          const updated = { ...paciente, diagnoses: novosDiagnosticos };
          setPaciente(updated);
          if (userId && !id.startsWith("temp_")) {
            try {
              await updatePatient(id, { problem_list: novosDiagnosticos } as any, userId);
            } catch (e) {
              console.warn("Salvou só local", e);
            }
          }
          try {
            const local = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
            const idx = local.findIndex((p: any) => p.id === id);
            if (idx >= 0) {
              local[idx] = {
                ...local[idx],
                problem_list: novosDiagnosticos,
                lista_de_problemas: novosDiagnosticos.map((t: string) => ({ id: Math.random().toString(36).slice(2), text: t })),
              };
              localStorage.setItem("da_pacientes", JSON.stringify(local));
            }
          } catch { /* ignore */ }
        }}
        onApplyPrescription={(items: PrescriptionItem[]) => {
          const encoded = encodeURIComponent(JSON.stringify(items));
          nav({
            to: "/prescricao/$id",
            params: { id },
            search: { vigia_items: encoded } as any,
          });
        }}
      />

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-12 space-y-6 md:space-y-12">

        <ATBAlertBanner patient={{ id: paciente.id, antibioticos: paciente.data?.abx }} />

        {/* LISTA DE PROBLEMAS */}
        <Section title="LISTA DE PROBLEMAS" icon={<ClipboardList className="h-5 w-5" />} action={
          <button onClick={() => nav({ to: "/cadastro-manual", search: { id, tipo: 'internado' } as any })} className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest flex items-center gap-1">
             <Edit3 className="h-3 w-3" /> EDITAR
          </button>
        }>
           <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                 <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-4">
                    <div className="h-2 w-2 rounded-full bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]" /> PROBLEMAS ATIVOS
                 </h4>
                 {(paciente.diagnoses?.length > 0 || (paciente.data?.conducta?.dx)) ? (
                   <div className="space-y-2">
                      {paciente.diagnoses?.map((prob: string, i: number) => (
                        <div key={i} className="p-4 bg-elevated border border-border rounded-xl text-xs font-bold text-foreground shadow-sm uppercase flex items-center gap-2">
                           <div className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" /> {prob}
                        </div>
                      ))}
                      {paciente.data?.conducta?.dx && (
                        <div className="p-4 bg-elevated border border-border rounded-xl text-xs font-bold text-foreground shadow-sm uppercase flex items-center gap-2">
                           <div className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" /> {paciente.data.conducta.dx}
                        </div>
                      )}
                   </div>
                 ) : (
                   <p className="text-xs italic text-muted-foreground">Nenhum problema ativo listado.</p>
                 )}
              </div>
              <div className="space-y-3">
                 <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-4">
                    <div className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" /> COMORBIDADES CONTROLADAS
                 </h4>
                 <div className="flex flex-wrap gap-2">
                    {paciente.comorbidities?.length > 0 ? (
                      paciente.comorbidities.map((c: string) => (
                        <span key={c} className="px-3 py-2 bg-secondary/50 border border-border rounded-lg text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                           <div className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {c}
                        </span>
                      ))
                    ) : <p className="text-xs italic text-muted-foreground">Nenhuma comorbidade listada.</p>}
                 </div>
              </div>
           </div>
        </Section>

        {/* ANTIBIÓTICOS */}
        <Section title="ANTIBIÓTICOS" icon={<Pill className="h-5 w-5" />}>
           <div className="space-y-8">
              {paciente.data?.abx?.length > 0 ? (
                paciente.data.abx.map((atb: any, i: number) => {
                  const isFinalizado = atb.status === "finalizado" || atb.status === "suspenso" || (atb.data_fim && new Date(`${atb.data_fim}T00:00:00`).getTime() <= Date.now());
                  // Defensivo: parseISO com undefined/string inválida quebra tela inteira.
                  // ATB pode vir da IA sem data_inicio (importação incompleta).
                  const parsedStart = atb.d0 ? parseISO(atb.d0) : null;
                  const validStart = parsedStart && isValid(parsedStart) ? parsedStart : null;
                  const dValue = validStart ? differenceInDays(startOfDay(new Date()), startOfDay(validStart)) : 0;
                  const dSafe = dValue >= 0 ? dValue : 0;
                  const maxDays = 7;
                  const progressBlocks = 8;
                  const activeBlocks = Math.min(Math.round((dSafe / maxDays) * progressBlocks), progressBlocks);
                  
                  const blocks = "█".repeat(activeBlocks) + "░".repeat(progressBlocks - activeBlocks);
                  const colorClass = dSafe <= 3 ? "text-emerald-500" : dSafe <= 5 ? "text-amber-500" : "text-destructive";
                  
                  return (
                    <div key={i} className={`space-y-4 ${isFinalizado ? "opacity-60" : ""}`}>
                       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2 flex-wrap">
                               <h3 className="font-black text-foreground uppercase tracking-tight text-lg">{atb.name}</h3>
                               {isFinalizado && (
                                 <span className="px-2 py-0.5 rounded-md bg-subtle dark:bg-slate-700 text-foreground dark:text-slate-300 text-[10px] font-semibold uppercase tracking-wide">
                                   {atb.status === "suspenso" ? "Suspenso" : "Finalizado"}
                                 </span>
                               )}
                             </div>
                             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                {atb.dose} · {atb.via} · {atb.freq}
                             </p>
                          </div>
                          <div className="text-right flex items-center gap-3">
                             {!isFinalizado && (
                               <button
                                 onClick={() => setAtbToFinalize({ index: i, atb })}
                                 className="px-3 h-8 rounded-md border border-border bg-elevated dark:bg-elevated text-[11px] font-semibold hover:bg-subtle transition-colors"
                                 title="Marcar como finalizado/suspenso"
                               >
                                 Finalizar
                               </button>
                             )}
                             <div>
                               <div className="text-2xl font-black text-foreground">{validStart ? `D${dSafe}` : "D?"}</div>
                               <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                  INÍCIO: {validStart ? format(validStart, "dd/MM/yyyy") : "—"}
                                  {atb.data_fim && (() => {
                                    const fim = parseISO(atb.data_fim);
                                    return isValid(fim) ? <> · FIM: {format(fim, "dd/MM/yyyy")}</> : null;
                                  })()}
                               </p>
                             </div>
                          </div>
                       </div>

                       <div className="space-y-2">
                          <div className={`font-mono text-xl tracking-tighter ${colorClass}`}>
                             {blocks} <span className="text-xs font-black text-muted-foreground ml-2">{dSafe}/7 DIAS</span>
                          </div>
                          <div className="flex justify-between text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                             <span>Início: {validStart ? format(validStart, "dd/MM/yyyy") : "data não informada"}</span>
                             <span>Término previsto: {validStart ? format(addDays(validStart, 7), "dd/MM/yyyy") : "—"}</span>
                          </div>
                       </div>

                       {dSafe > 7 && (
                         <div className="flex items-center gap-2 p-3 bg-destructive/5 border border-destructive/10 rounded-xl text-destructive text-[10px] font-bold uppercase tracking-widest">
                            <AlertTriangle className="h-4 w-4" /> ⚠ ATB HÁ MAIS DE 7 DIAS
                         </div>
                       )}
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center bg-secondary/20 rounded-[2rem] border-2 border-dashed border-border">
                   <Pill className="h-8 w-8 text-muted-foreground/30 mb-3" />
                   <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Nenhum antibiótico em uso</p>
                </div>
              )}
           </div>
        </Section>

        {/* LABORATÓRIOS RECENTES */}
        <Section title="LABORATÓRIOS RECENTES" icon={<Activity className="h-5 w-5" />} action={
          <button className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest">Ver todos</button>
        }>
           {paciente.data?.lab ? (
             <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-2xl border border-border">
                <div className="h-10 w-10 rounded-xl bg-elevated flex items-center justify-center text-primary border border-border shadow-sm shrink-0">
                   <Clock className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                   <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">ÚLTIMO RESULTADO EM {paciente.data.lab.date}</p>
                   <p className="font-bold text-foreground text-sm truncate uppercase tracking-tight">
                      {paciente.data.lab.formatted || "Resultado estruturado disponível."}
                   </p>
                </div>
             </div>
           ) : (
             <p className="text-xs italic text-muted-foreground">Nenhum exame laboratorial registrado.</p>
           )}
        </Section>

        {/* PENDÊNCIAS */}
        <Section title="PENDÊNCIAS" icon={<AlertTriangle className="h-5 w-5" />} action={
           <button onClick={() => nav({ to: "/cadastro-manual", search: { id, tipo: 'internado' } as any })} className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest flex items-center gap-1">
              <Plus className="h-3 w-3" /> Adicionar
           </button>
        }>
           <div className="space-y-3">
              {paciente.pendingIssues?.length > 0 ? (
                paciente.pendingIssues.map((pend: string, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl group transition-all hover:border-amber-400">
                     <div className="flex items-center gap-3 min-w-0">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-tight truncate">{pend}</span>
                     </div>
                     <button 
                       onClick={() => resolvePendencia(pend)}
                       className="px-3 py-2 rounded-lg bg-elevated border border-amber-200 dark:border-amber-500/30 text-[10px] font-black text-amber-600 uppercase tracking-widest hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all flex items-center gap-1"
                     >
                        <CheckCircle2 className="h-3.5 w-3.5" /> RESOLVER
                     </button>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/30 rounded-2xl text-emerald-600">
                   <CheckCircle2 className="h-4 w-4" />
                   <span className="text-xs font-bold uppercase tracking-widest">Tudo resolvido! Nenhuma pendência ativa.</span>
                </div>
              )}
           </div>
        </Section>

        <div className="grid md:grid-cols-2 gap-8">
           {/* TIMELINE DE EVOLUÇÕES */}
           <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4 justify-between">
                 <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground border border-border/50">
                       <FileText className="h-5 w-5" />
                    </div>
                    <h2 className="text-[10px] font-black tracking-[0.25em] uppercase text-foreground">EVOLUÇÕES ({evolutions.length})</h2>
                 </div>
                 {evolutions.length > 0 && (
                    <button onClick={() => nav({ to: "/evolucao/$id/historico", params: { id } })} className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline flex items-center gap-1">
                       VER TODAS <ArrowRight className="h-3 w-3" />
                    </button>
                 )}
              </div>
              <div className="bg-elevated border border-border rounded-[2.5rem] p-6 shadow-sm">
                 {evolutions.length === 0 ? (
                   <p className="text-xs text-muted-foreground italic text-center py-8">Nenhuma evolução registrada.</p>
                 ) : (
                   <div className="space-y-3 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
                      {evolutions.slice(0, 8).map((ev: any, idx: number) => {
                        const evId = ev.id || `${ev.patient_id}_${ev.created_at}`;
                        const dataFmt = ev.created_at ? format(parseISO(ev.created_at), "dd/MM HH:mm") : "—";
                        const isFirst = idx === 0;
                        return (
                          <div key={evId} className={`p-4 rounded-2xl border transition-colors ${isFirst ? "bg-primary/5 border-primary/20" : "bg-secondary/20 border-border"}`}>
                             <div className="flex items-center justify-between mb-2">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isFirst ? "text-primary" : "text-muted-foreground"}`}>
                                   {isFirst && "↳ MAIS RECENTE · "}{dataFmt}
                                </span>
                             </div>
                             <p className="text-[11px] text-foreground leading-relaxed line-clamp-3 mb-3 whitespace-pre-wrap">{ev.content}</p>
                             <div className="flex gap-2">
                                <button onClick={() => setModalEvolucao(ev)} className="flex-1 py-2 rounded-lg border border-border text-[9px] font-black text-foreground uppercase tracking-widest hover:bg-secondary transition-all">
                                   VER COMPLETA
                                </button>
                                <button
                                   onClick={() => nav({ to: "/evolucao/$id", params: { id }, search: { from: evId } })}
                                   className="flex-1 py-2 rounded-lg bg-navy text-white text-[9px] font-black uppercase tracking-widest hover:-translate-y-0.5 transition-all flex items-center justify-center gap-1"
                                >
                                   <ArrowRight className="h-3 w-3" /> USAR COMO BASE
                                </button>
                             </div>
                          </div>
                        );
                      })}
                   </div>
                 )}
              </div>
           </div>

           {/* DOCUMENTOS IMPORTADOS */}
           <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                 <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground border border-border/50">
                    <FileUp className="h-5 w-5" />
                 </div>
                 <h2 className="text-[10px] font-black tracking-[0.25em] uppercase text-foreground">DOCUMENTOS IMPORTADOS</h2>
              </div>
              <div className="bg-elevated border border-border rounded-[2.5rem] p-8 shadow-sm space-y-4">
                 {paciente.documents?.length > 0 ? (
                   <div className="space-y-2">
                      {paciente.documents.map((doc: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-secondary/20 rounded-xl border border-border">
                           <div className="flex items-center gap-3 min-w-0">
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                 <p className="text-[10px] font-bold text-foreground truncate">{doc.name}</p>
                                 <p className="text-[8px] text-muted-foreground font-black uppercase">{doc.date}</p>
                              </div>
                           </div>
                           <ArrowRight className="h-3 w-3 text-muted-foreground/30" />
                        </div>
                      ))}
                   </div>
                 ) : (
                   <p className="text-xs text-muted-foreground italic mb-4">Nenhum documento anexado.</p>
                 )}
                 <button 
                   onClick={() => nav({ to: "/upload-ia", search: { patient_id: id } as any })}
                   className="w-full py-4 border-2 border-dashed border-border rounded-2xl text-[10px] font-black text-muted-foreground hover:border-primary/40 hover:text-primary transition-all flex flex-col items-center gap-2"
                 >
                    <Plus className="h-5 w-5" /> ADICIONAR DOCUMENTO
                 </button>
              </div>
           </div>
        </div>

        {/* AÇÕES EM DESTAQUE */}
        {/* AÇÕES EM DESTAQUE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-12">
           <button 
             onClick={() => nav({ to: "/evolucao/$id", params: { id } })}
             className="flex items-center justify-between p-6 rounded-[2rem] border transition-all hover:-translate-y-1 hover:shadow-xl bg-primary text-white border-primary shadow-lg shadow-primary/20"
           >
              <div className="flex items-center gap-4">
                 <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-elevated/20">
                    <TrendingUp className="h-5 w-5" />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest">GERAR EVOLUÇÃO</span>
              </div>
              <ArrowRight className="h-4 w-4 text-white/40" />
           </button>

           <button 
             onClick={() => nav({ to: "/prescricao/$id", params: { id } })}
             className="flex items-center justify-between p-6 rounded-[2rem] border transition-all hover:-translate-y-1 hover:shadow-xl bg-elevated border-border text-foreground hover:border-primary/40"
           >
              <div className="flex items-center gap-4">
                 <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-secondary">
                    <Pill className="h-5 w-5" />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest">GERAR PRESCRIÇÃO</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
           </button>

           <button 
             onClick={() => nav({ to: "/encaminhamento/$id", params: { id } })}
             className="flex items-center justify-between p-6 rounded-[2rem] border transition-all hover:-translate-y-1 hover:shadow-xl bg-elevated border-border text-foreground hover:border-primary/40"
           >
              <div className="flex items-center gap-4">
                 <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-secondary">
                    <ArrowRight className="h-5 w-5" />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest">GERAR ENCAMINHAMENTO</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
           </button>

           <button 
             onClick={() => nav({ to: "/upload-ia", search: { patient_id: id } as any })}
             className="flex items-center justify-between p-6 rounded-[2rem] border transition-all hover:-translate-y-1 hover:shadow-xl bg-elevated border-border text-foreground hover:border-primary/40"
           >
              <div className="flex items-center gap-4">
                 <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-secondary">
                    <FileUp className="h-5 w-5" />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest">ADICIONAR DOCUMENTO</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
           </button>

           <button 
             onClick={() => nav({ to: "/cadastro-manual", search: { id, tipo: 'internado' } as any })}
             className="flex items-center justify-between p-6 rounded-[2rem] border transition-all hover:-translate-y-1 hover:shadow-xl bg-elevated border-border text-foreground hover:border-primary/40"
           >
              <div className="flex items-center gap-4">
                 <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-secondary">
                    <Edit3 className="h-5 w-5" />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest">EDITAR PACIENTE</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
           </button>

           <button 
             onClick={() => handleStatusUpdate('alta_provavel')}
             className="flex items-center justify-between p-6 rounded-[2rem] border transition-all hover:-translate-y-1 hover:shadow-xl bg-elevated border-border text-foreground hover:border-primary/40"
           >
              <div className="flex items-center gap-4">
                 <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-secondary">
                    <Check className="h-5 w-5" />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest">MARCAR ALTA PROVÁVEL</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
           </button>

           <button 
             onClick={() => nav({ to: "/evolucao/$id/historico", params: { id } })}
             className="flex items-center justify-between p-6 rounded-[2rem] border transition-all hover:-translate-y-1 hover:shadow-xl bg-elevated border-border text-foreground hover:border-primary/40"
           >
              <div className="flex items-center gap-4">
                 <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-secondary">
                    <Clock className="h-5 w-5" />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest">VER HISTÓRICO</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
           </button>
        </div>

        {/* ESPECIALISTA VIRTUAL */}
        <div className="pt-8">
           <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground border border-border/50">
                 <Activity className="h-5 w-5" />
              </div>
              <h2 className="text-[10px] font-black tracking-[0.25em] uppercase text-foreground">SEGUNDA OPINIÃO IA</h2>
           </div>
           <SpecialistCard
              specialist={specialist}
              isLoading={consultLoading}
              hasConsult={paciente ? hasConsultForPatient(paciente.id) : false}
              onConsult={() => triggerConsult()}
           />
        </div>
      </main>

      <SpecialistDrawer
         open={drawerOpen}
         onClose={closeDrawer}
         specialist={specialist}
         consult={consult}
         isLoading={consultLoading}
         onAcceptSuggestions={handleAcceptSuggestions}
      />

      {/* Footer Nav */}
      <div className="max-w-5xl mx-auto px-6 pb-20 text-center">
         <button onClick={() => nav({ to: "/dashboard" })} className="text-[10px] font-black text-muted-foreground hover:text-foreground uppercase tracking-[0.2em] transition-all flex items-center gap-2 mx-auto border-b border-transparent hover:border-muted-foreground">
            <ChevronLeft className="h-4 w-4" /> VOLTAR AO DASHBOARD
         </button>
      </div>

      {/* Floating Action for Mobile */}
      {/* FAB: no mobile fica acima do BottomNav (h-14), no desktop fica colado embaixo */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-30 bottom-20 md:bottom-8"
        style={{ marginBottom: "max(0px, env(safe-area-inset-bottom))" }}
      >
         <button 
           onClick={() => nav({ to: "/evolucao/$id", params: { id } })}
           className="px-10 py-5 rounded-[2rem] bg-navy text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl flex items-center gap-4 hover:scale-105 transition-all"
         >
            <TrendingUp className="h-5 w-5" /> EVOLUIR AGORA
         </button>
      </div>

      {/* Modal Ver Completa */}
      {modalEvolucao && (
        <div
          className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4"
          onClick={() => setModalEvolucao(null)}
          onKeyDown={(e) => e.key === "Escape" && setModalEvolucao(null)}
          role="presentation"
        >
          <div
            className="bg-elevated w-full max-w-2xl rounded-t-2xl md:rounded-[2.5rem] border-t md:border border-border shadow-2xl overflow-hidden flex flex-col max-h-[95vh] md:max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-8 py-6 border-b border-border bg-secondary/30 flex items-center justify-between">
              <div>
                 <h2 className="text-sm font-black text-foreground uppercase tracking-widest mb-1">EVOLUÇÃO MÉDICA</h2>
                 <p className="text-[10px] font-bold text-muted-foreground uppercase">{format(parseISO(modalEvolucao.created_at), "dd/MM/yyyy HH:mm")}</p>
              </div>
              <button onClick={() => setModalEvolucao(null)} className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary transition-all">
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground uppercase">
                {modalEvolucao.content}
              </pre>
            </div>
            <footer className="px-8 py-6 border-t border-border bg-secondary/30 flex justify-end">
              <button 
                onClick={() => setModalEvolucao(null)}
                className="px-8 py-4 rounded-xl bg-navy text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-navy/20 hover:-translate-y-0.5 transition-all"
              >
                FECHAR
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal finalizar ATB */}
      {atbToFinalize && (
        <FinalizeAtbModal
          atb={atbToFinalize.atb}
          onClose={() => setAtbToFinalize(null)}
          onConfirm={finalizeAtb}
        />
      )}
    </div>
  );
}

function FinalizeAtbModal({
  atb,
  onClose,
  onConfirm,
}: {
  atb: any;
  onClose: () => void;
  onConfirm: (status: "finalizado" | "suspenso", dataFim: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [dataFim, setDataFim] = useState(today);
  const [status, setStatus] = useState<"finalizado" | "suspenso">("finalizado");
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!dataFim) return;
    setSaving(true);
    await onConfirm(status, dataFim);
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center md:p-4 bg-foreground/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-elevated rounded-t-2xl md:rounded-xl w-full max-w-md shadow-xl border-t md:border border-border max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 md:p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">Finalizar antibiótico</h2>
              <p className="text-[13px] text-muted-foreground mt-0.5">{atb.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 -mr-1 rounded-md hover:bg-subtle text-muted-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[13px] font-medium mb-1.5 block">Status</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus("finalizado")}
                  className={`h-10 rounded-md border text-[13px] font-medium transition-colors ${
                    status === "finalizado"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-elevated hover:bg-subtle"
                  }`}
                >
                  Finalizado
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("suspenso")}
                  className={`h-10 rounded-md border text-[13px] font-medium transition-colors ${
                    status === "suspenso"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-elevated hover:bg-subtle"
                  }`}
                >
                  Suspenso
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Finalizado = ciclo completo. Suspenso = parou antes do previsto.
              </p>
            </div>

            <div>
              <label htmlFor="data_fim" className="text-[13px] font-medium mb-1.5 block">
                Data de fim
              </label>
              <input
                id="data_fim"
                type="date"
                value={dataFim}
                max={today}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-elevated text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={onClose}
                disabled={saving}
                className="flex-1 h-10 rounded-md border border-border bg-elevated text-sm font-medium hover:bg-subtle transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving || !dataFim}
                className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Salvando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children, action }: { title: string, icon: any, children: any, action?: any }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-4 md:mb-6 ml-1">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl md:rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground border border-border/50">
            {icon}
          </div>
          <h2 className="text-[10px] font-black tracking-[0.25em] uppercase text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      <div className="bg-elevated border border-border rounded-2xl md:rounded-[3rem] p-5 md:p-12 shadow-sm">
        {children}
      </div>
    </div>
  );
}
