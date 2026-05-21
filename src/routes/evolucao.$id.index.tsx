import { createFileRoute, Link, useParams, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft, Sparkles, Copy, Save, FileText, Download,
  Loader2, Pill, Activity, AlertTriangle,
  Calendar, ArrowRight, Check, History, Wand2, X, RotateCcw
} from "lucide-react";
import { differenceInDays, parseISO, isValid, format, startOfDay } from "date-fns";
import { toast } from "sonner";
import { getPatientById, createEvolution, getEvolutionsByPatient } from "@/lib/db";
import { VITE_CLINICAL_AGENTS_URL } from "@/lib/clinicalAgentsConfig";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { storage } from "@/lib/storage";
import { exportEvolucao, type ExportFormat } from "@/lib/exportEvolucao";
import { useSpecialistConsult } from "@/components/specialists/useSpecialistConsult";
import SpecialistDrawer from "@/components/specialists/SpecialistDrawer";
import SpecialistCard from "@/components/specialists/SpecialistCard";
import {
  EVOLUTION_TEMPLATES,
  EVOLUTION_TEMPLATES_BY_CONTEXT,
  defaultTemplateForUnit,
  findTemplate,
  type EvolutionTemplate,
} from "@/lib/evolutionTemplates";
import ShiftBadge from "@/components/ShiftBadge";
import ThemeToggle from "@/components/ThemeToggle";


export const Route = createFileRoute("/evolucao/$id/")({
  component: EvolucaoPage,
  head: () => ({ meta: [{ title: "Gerar Evolução Clínica — DOUTOR AJUDA" }] }),
});

type Version = {
  id: string;
  text: string;
  createdAt: string;
  source: "gerar" | "refinar" | "base";
};

const TIPOS_UNIDADE: { value: string; label: string }[] = [
  { value: "enfermaria_clinica", label: "ENFERMARIA CLÍNICA" },
  { value: "enfermaria_pediatrica", label: "ENFERMARIA PEDIÁTRICA" },
  { value: "uti", label: "UTI" },
  { value: "upa", label: "UPA / EMERGÊNCIA" },
  { value: "ubs", label: "UBS / AMBULATÓRIO" },
];

const RASCUNHO_DEBOUNCE_MS = 1000;

const TEMPLATES: Record<string, string> = {
  enfermaria_clinica: `EVOLUÇÃO MÉDICA — [DATA]

# LISTA DE PROBLEMAS:
1. [problema]

# ADMISSÃO:
[motivo e contexto]

# EVOLUÇÃO:
[evolução clínica atual]

# AVALIAÇÃO ESPECIALISTA:
[interconsultas se houver]

# HISTÓRICO DE ANTIBIOTICOTERAPIA:
[ATB: nome dose via freq — D[N] DE [TOTAL] — INÍCIO [DATA]]

# AO EXAME FÍSICO:
ESTADO GERAL: [geral]
ACV: [acv]
AR: [ar]
ABDOME: [abdome]
EXTREMIDADES: [extremidades]

# EXAMES COMPLEMENTARES:
>> LABORATÓRIO ([DATA]):
[Hb X | Ht X | Leuco X | PCR X | Creat X | ...]

>> IMAGEM/OUTRO:
[laudos se houver]

# CONDUTAS:
[condutas]

# PENDÊNCIAS:
[pendencias]`,

  enfermaria_pediatrica: `EVOLUÇÃO PEDIÁTRICA — [DATA]

# LISTA DE PROBLEMAS:
1. [problema]

# DADOS DO PACIENTE:
PESO: [X] KG | IDADE: [X MESES / X ANOS]

# ADMISSÃO:
[motivo]

# EVOLUÇÃO:
[evolução]

# AO EXAME FÍSICO:
ESTADO GERAL: [geral]
ACV: [acv]
AR: [ar]
ABDOME: [abdome]
HIDRATAÇÃO: [hidratação]
NEUROLÓGICO: [neuro]

# EXAMES COMPLEMENTARES:
>> LABORATÓRIO ([DATA]):
[resultados]

# CONDUTAS:
[condutas]

# PENDÊNCIAS:
[pendencias]`,

  uti: `EVOLUÇÃO UTI — [DATA]

# LISTA DE PROBLEMAS:
1. [problema]

# ADMISSÃO:
[motivo e data]

# EVOLUÇÃO / ESTADO ATUAL:
[estado clínico]

# VENTILAÇÃO MECÂNICA:
MODO: [modo] | FiO2: [X]% | PEEP: [X] | VC: [X] | FR: [X]
SpO2: [X]% | PaO2/FiO2: [X]

# HEMODINÂMICA:
PA: [X]x[X] | FC: [X] | MAP: [X]
DVA: [drogas vasoativas e doses]

# SEDAÇÃO / ANALGESIA:
[medicamentos e doses]

# BALANÇO HÍDRICO 24H:
ENTRADAS: [X] ML | SAÍDAS: [X] ML | BALANÇO: [+/-X] ML

# HISTÓRICO DE ANTIBIOTICOTERAPIA:
[ATB com D]

# AO EXAME FÍSICO:
[sistemas]

# EXAMES COMPLEMENTARES:
>> LABORATÓRIO ([DATA]):
[resultados]

# CONDUTAS:
[condutas]

# PENDÊNCIAS:
[pendencias]`,

  upa: `EVOLUÇÃO UPA — [DATA] — [HORA]

QUEIXA PRINCIPAL: [queixa]

# HISTÓRIA CLÍNICA:
[HDA resumida]

# AO EXAME FÍSICO:
[sistemas principais]

# EXAMES REALIZADOS:
[resultados]

# HIPÓTESES DIAGNÓSTICAS:
1. [hipótese]

# CONDUTA:
[conduta imediata]

# DESFECHO:
[ ] ALTA  [ ] INTERNAÇÃO  [ ] TRANSFERÊNCIA  [ ] ÓBITO`,

  ubs: `CONSULTA AMBULATORIAL — [DATA]

# MOTIVO DA CONSULTA:
[queixa]

# HISTÓRIA / EVOLUÇÃO:
[anamnese]

# AO EXAME FÍSICO:
[exame]

# HIPÓTESES DIAGNÓSTICAS:
1. [hipótese]

# CONDUTAS:
[receitas, exames solicitados, encaminhamentos]

# RETORNO:
[prazo]`
};

function EvolucaoPage() {
  const { id } = useParams({ from: "/evolucao/$id/" });
  const { from } = useSearch({ from: "/evolucao/$id" });
  const nav = useNavigate();
  const { userId } = useSupabaseUser();
  const [paciente, setPaciente] = useState<any>(null);
  const [tipoUnidade, setTipoUnidadeState] = useState<string>("enfermaria_clinica");
  const [evolutionText, setEvolutionText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [overwriteChoice, setOverwriteChoice] = useState<null | "ask">(null);
  const [rascunhoInfo, setRascunhoInfo] = useState<null | { text: string; savedAt: string }>(null);
  const [didInitDraft, setDidInitDraft] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [templateId, setTemplateId] = useState<string>(defaultTemplateForUnit("enfermaria_clinica").id);
  const [rawNotes, setRawNotes] = useState<string>("");
  const [showRawNotes, setShowRawNotes] = useState<boolean>(false);

  const activeTemplate: EvolutionTemplate = useMemo(
    () => findTemplate(templateId) || defaultTemplateForUnit(tipoUnidade),
    [templateId, tipoUnidade]
  );

  const pushVersion = (text: string, source: Version["source"]) => {
    if (!text.trim()) return;
    setVersions((prev) => [
      { id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, text, createdAt: new Date().toISOString(), source },
      ...prev,
    ].slice(0, 20));
  };

  const setTipoUnidade = (tipo: string) => {
    setTipoUnidadeState(tipo);
    storage.setEvolTipo(id, tipo);
    storage.setTipo(tipo);
    // Quando troca a unidade, escolhe o template default desse contexto.
    const def = defaultTemplateForUnit(tipo);
    setTemplateId(def.id);
    try { localStorage.setItem(`da_evol_template_${id}`, def.id); } catch { /* ignore */ }
  };

  const updateTemplate = (newId: string) => {
    setTemplateId(newId);
    try { localStorage.setItem(`da_evol_template_${id}`, newId); } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!userId) return;
    async function load() {
      try {
        if (id.startsWith("temp_")) throw new Error("Local");
        const p = await getPatientById(id, userId!);
        const labList = p.labs || [];
        const mapped = {
          id: p.id,
          name: p.name,
          age: p.age,
          sex: p.sex,
          bed: p.bed,
          sector: p.sector,
          admissionDate: p.admission_date,
          motivo_admissao: p.reason_for_admission,
          hda: p.hda,
          antecedentes: (p as any).antecedentes_patologicos || [],
          medicacoes_uso_continuo: p.medications || [],
          problemList: p.problem_list || [],
          pendingIssues: p.pending_issues || [],
          data: {
            abx: (p.antibiotics || []).map(a => ({
              name: a.nome,
              dose: (a as any).dose,
              via: (a as any).via,
              frequencia: (a as any).frequencia,
              d0: a.data_inicio,
            })),
            lab: labList.length > 0 ? { formatted: labList[0].texto_compacto } : null,
            labs_all: labList.map((l: any) => ({ data: l.data, texto: l.texto_compacto || "" })),
            resp: p.physical_exam || {},
            condutas: (p as any).conducts || [],
          },
        };
        setPaciente(mapped);
      } catch (err) {
        const existing = storage.getLocalPacientes();
        const p = existing.find((x: any) => x.id === id);
        if (p) {
          const atbList = (p.antibioticos || p.antibiotics || []);
          const labList = (p.laboratorios || p.labs || []);
          const pendList = (p.pendencias || p.pending_issues || []);
          const problemList = (p.lista_de_problemas || p.problem_list || []);
          setPaciente({
            id: p.id,
            name: p.nome || p.name,
            age: p.idade || p.age,
            sex: p.sexo || p.sex,
            bed: p.leito || p.bed,
            sector: p.setor || p.sector,
            admissionDate: p.data_admissao || p.admission_date || p.admissionDate,
            motivo_admissao: p.motivo_admissao || p.reason_for_admission,
            hda: p.hda,
            antecedentes: p.antecedentes_patologicos || p.antecedentes || [],
            medicacoes_uso_continuo: p.medicacoes_uso_continuo || p.medications || p.medicacoes || [],
            problemList: problemList.map((t: any) => (typeof t === "string" ? t : t.text || "")),
            pendingIssues: pendList.map((t: any) => (typeof t === "string" ? t : t.text || "")),
            data: {
              abx: atbList.map((a: any) => ({
                name: a.nome || a.name,
                dose: a.dose,
                via: a.via,
                frequencia: a.frequencia,
                d0: a.dataInicio || a.data_inicio,
              })),
              lab: labList.length > 0 ? {
                formatted: labList[0].valor || labList[0].texto_compacto || "",
              } : null,
              labs_all: labList.map((l: any) => ({
                data: l.data,
                texto: l.valor || l.texto_compacto || "",
              })),
              resp: p.exame_fisico || p.exame_fisico_detalhado || p.physical_exam || {},
              condutas: p.condutas || p.conducts || [],
            },
          });
        }
      }
    }
    load();

    const tipoPaciente = storage.getEvolTipo(id);
    const savedTipo = tipoPaciente || storage.getTipo();
    if (savedTipo) setTipoUnidadeState(savedTipo);

    // Restaura template escolhido pra este paciente; senão, default do tipo.
    try {
      const savedTemplate = localStorage.getItem(`da_evol_template_${id}`);
      if (savedTemplate && findTemplate(savedTemplate)) {
        setTemplateId(savedTemplate);
      } else {
        setTemplateId(defaultTemplateForUnit(savedTipo || "").id);
      }
    } catch {
      /* ignore */
    }

    async function loadBase() {
      if (!from || !userId) return false;
      try {
        const evols = await getEvolutionsByPatient(id, userId!);
        const base = evols.find((e: any) => e.id === from);
        if (base?.content) {
          setEvolutionText(base.content);
          pushVersion(base.content, "base");
          toast.success("Evolução anterior carregada como base.");
          return true;
        }
      } catch {
        /* tenta fallback local */
      }
      try {
        const local = JSON.parse(localStorage.getItem("da_evolucoes") || "[]");
        const base = local.find((e: any) => e.id === from || `${e.patient_id}_${e.created_at}` === from);
        if (base?.content) {
          setEvolutionText(base.content);
          pushVersion(base.content, "base");
          toast.success("Evolução anterior carregada como base.");
          return true;
        }
      } catch {
        /* ignora */
      }
      return false;
    }

    loadBase().then((loadedFromBase) => {
      if (loadedFromBase) {
        setDidInitDraft(true);
        return;
      }
      const rascunho = storage.getEvolRascunho(id);
      if (rascunho && rascunho.text?.trim()) {
        setRascunhoInfo(rascunho);
      } else {
        setDidInitDraft(true);
      }
    });
  }, [id, userId, from]);

  useEffect(() => {
    if (!didInitDraft) return;
    if (!evolutionText.trim()) {
      storage.clearEvolRascunho(id);
      return;
    }
    const timer = setTimeout(() => {
      storage.setEvolRascunho(id, evolutionText);
    }, RASCUNHO_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [evolutionText, id, didInitDraft]);

  const restaurarRascunho = () => {
    if (rascunhoInfo) setEvolutionText(rascunhoInfo.text);
    setRascunhoInfo(null);
    setDidInitDraft(true);
  };

  const descartarRascunho = () => {
    storage.clearEvolRascunho(id);
    setRascunhoInfo(null);
    setDidInitDraft(true);
  };

  const dih = useMemo(() => {
    if (!paciente?.admissionDate && !paciente?.admission) return 0;
    const admission = startOfDay(parseISO(paciente.admissionDate || paciente.admission));
    if (!isValid(admission)) return 0;
    return differenceInDays(startOfDay(new Date()), admission);
  }, [paciente]);

  const runGenerate = async (mode: "replace" | "append") => {
    if (!paciente) return;
    setIsGenerating(true);
    try {
      const plantaoAtivo = storage.getPlantaoAtivo();
      const dataPlantao = plantaoAtivo?.date || format(new Date(), "yyyy-MM-dd");

      const response = await fetch(`${VITE_CLINICAL_AGENTS_URL}/api/ai/gerar-evolucao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: paciente,
          tipo_unidade: tipoUnidade,
          template: activeTemplate.prompt,
          template_id: activeTemplate.id,
          output_style: activeTemplate.outputStyle,
          raw_notes: rawNotes || undefined,
          data_plantao: dataPlantao,
          preferences: {
            uppercase: true,
            lab_format: "compact_inline",
            atb_day_rule: storage.getAtbDayRule()
          }
        }),
      });

      if (!response.ok) throw new Error("Falha na resposta do servidor");
      const result = await response.json();
      const generated = result.evolution_text || result.evolutionText || result.text || "";
      setEvolutionText(prev => {
        const next = mode === "append" && prev.trim() ? `${prev}\n\n${generated}` : generated;
        pushVersion(next, "gerar");
        return next;
      });
      toast.success("Evolução gerada com sucesso!");
    } catch (error: any) {
      console.error("Erro ao gerar evolução", error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = () => {
    if (!paciente) return;
    if (evolutionText.trim()) {
      setOverwriteChoice("ask");
      return;
    }
    runGenerate("replace");
  };

  const handleRefine = async () => {
    const instruction = refineInstruction.trim();
    if (!instruction || !evolutionText.trim()) {
      toast.error("Escreva uma instrução e tenha texto para refinar.");
      return;
    }
    setIsRefining(true);
    try {
      const response = await fetch(`${VITE_CLINICAL_AGENTS_URL}/api/ai/refinar-evolucao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_text: evolutionText,
          instruction,
          tipo_unidade: tipoUnidade,
          preferences: { uppercase: true },
        }),
      });
      if (!response.ok) throw new Error(`Servidor retornou ${response.status}`);
      const result = await response.json();
      const refined = result.evolution_text || result.evolutionText || result.text || "";
      if (!refined) throw new Error("Resposta vazia do servidor");
      setEvolutionText(refined);
      pushVersion(refined, "refinar");
      setRefineInstruction("");
      toast.success("Texto ajustado conforme instrução.");
    } catch (err: any) {
      console.error("Erro ao refinar evolução", err);
      toast.error(`Erro ao refinar: ${err.message}`);
    } finally {
      setIsRefining(false);
    }
  };

  const restoreVersion = (v: Version) => {
    setEvolutionText(v.text);
    toast.success("Versão restaurada.");
  };

  const handleCopy = () => {
    if (!evolutionText) return;
    navigator.clipboard.writeText(evolutionText);
    toast.success("Copiado para a área de transferência!");
  };

  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);
  const handleExport = async (fmt: ExportFormat) => {
    if (!evolutionText.trim() || !paciente) return;
    setIsExporting(fmt);
    try {
      const plantao = storage.getPlantaoAtivo();
      await exportEvolucao({
        text: evolutionText,
        format: fmt,
        filename_hint: `evolucao_${(paciente.name || "paciente").toString().replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}`,
        header: {
          hospital: storage.getHospitalPadrao() || plantao?.hospital || "",
          medico: storage.getNomeMedico() || "",
          crm: storage.getCRM() || "",
          paciente: paciente.name || "",
          leito: paciente.bed || "",
          data: format(new Date(), "dd/MM/yyyy"),
          tipo: `EVOLUÇÃO ${tipoUnidade.replace(/_/g, " ").toUpperCase()}`,
        },
      });
      toast.success(`Arquivo ${fmt.toUpperCase()} baixado.`);
    } catch (err: any) {
      toast.error(`Falha ao exportar ${fmt.toUpperCase()}: ${err.message}`);
    } finally {
      setIsExporting(null);
    }
  };

  const handleSave = async () => {
    if (!evolutionText || !userId) return;
    setIsSaving(true);
    try {
      const shiftId = storage.getShiftId();
      if (shiftId && !shiftId.startsWith("temp_") && !id.startsWith("temp_")) {
        await createEvolution({
          patient_id: id,
          shift_id: shiftId,
          content: evolutionText
        }, userId);
        toast.success("Evolução salva!");
      } else {
        throw new Error("Local fallback");
      }
    } catch (error) {
      console.warn("Salvando evolução localmente", error);
      const shiftId = storage.getShiftId() || "unknown";
      const existing = JSON.parse(localStorage.getItem("da_evolucoes") || "[]");
      existing.push({
        patient_id: id,
        shift_id: shiftId,
        content: evolutionText,
        created_at: new Date().toISOString()
      });
      localStorage.setItem("da_evolucoes", JSON.stringify(existing));
      toast.success("Evolução salva localmente!");
    } finally {
      storage.clearEvolRascunho(id);
      setIsSaving(false);
      nav({ to: "/paciente/$id", params: { id } });
    }
  };

  // Hook do especialista: precisa rodar SEMPRE antes de qualquer return
  // para não violar a ordem de hooks do React.
  const evolutionsForContext = evolutionText.trim()
    ? [{ created_at: new Date().toISOString(), content: evolutionText }]
    : [];
  const { specialist, open: drawerOpen, loading: consultLoading, consult, triggerConsult, closeDrawer } = useSpecialistConsult({
    patient: paciente,
    evolutions: evolutionsForContext,
    unitHint: tipoUnidade,
  });

  const handleAcceptSuggestionsEvol = (acceptedTexts: string[]) => {
    if (!acceptedTexts.length) return;
    const block = "\n\n# CONDUTAS SUGERIDAS PELO ESPECIALISTA:\n" + acceptedTexts.map((t, i) => `${i + 1}. ${t}`).join("\n");
    setEvolutionText((prev) => (prev || "") + block);
    toast.success(`${acceptedTexts.length} sugestão(ões) anexada(s) à evolução.`);
  };

  if (!paciente) return null;

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="bg-elevated border-b border-border sticky top-0 z-30 shadow-sm overflow-hidden">
        <div className="absolute top-0 left-0 w-1 bg-navy h-full" />
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
           <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => nav({ to: "/paciente/$id", params: { id } })} className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary transition-all shrink-0">
                 <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                 <div className="flex items-center gap-2 mb-1 min-w-0">
                    <h1 className="text-base md:text-xl font-black text-foreground tracking-tight uppercase truncate">{paciente.name}</h1>
                    <ShiftBadge silent />
                 </div>
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] truncate">LEITO {paciente.bed} · D{dih} · {tipoUnidade.replace('_', ' ').toUpperCase()}</p>
              </div>
           </div>
           <div className="flex items-center gap-1.5 md:gap-3 flex-wrap">
              <label className="flex items-center gap-2">
                <span className="sr-only">Modelo de evolução</span>
                <select
                  value={templateId}
                  onChange={(e) => updateTemplate(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-border bg-elevated text-[10px] font-black uppercase tracking-widest text-foreground hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-navy/20 cursor-pointer max-w-[280px]"
                  aria-label="Modelo de evolução"
                  title={activeTemplate.description}
                >
                  {(["uti", "clinica", "pediatria", "ubs", "upa"] as const).map((ctx) => {
                    const list = EVOLUTION_TEMPLATES_BY_CONTEXT[ctx];
                    if (list.length === 0) return null;
                    return (
                      <optgroup key={ctx} label={list[0].contextLabel}>
                        {list.map((t) => (
                          <option key={t.id} value={t.id}>{t.label.replace(/^[^—]+—\s*/, "")}</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </label>
              <button
                onClick={() => setShowVersions(true)}
                disabled={versions.length === 0}
                aria-label="Ver versões geradas"
                className="px-4 py-2.5 rounded-xl border border-border text-[10px] font-black uppercase tracking-widest hover:bg-secondary transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <History className="h-3 w-3" /> VERSÕES ({versions.length})
              </button>
              <div className="flex items-center gap-1 p-1 rounded-xl border border-border bg-elevated" role="group" aria-label="Exportar evolução">
                <button
                  onClick={() => handleExport("docx")}
                  disabled={!evolutionText || isExporting !== null}
                  className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-secondary transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isExporting === "docx" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} DOCX
                </button>
                <button
                  onClick={() => handleExport("pdf")}
                  disabled={!evolutionText || isExporting !== null}
                  className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-secondary transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isExporting === "pdf" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} PDF
                </button>
                <button
                  onClick={() => handleExport("txt")}
                  disabled={!evolutionText || isExporting !== null}
                  className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-secondary transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isExporting === "txt" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} TXT
                </button>
              </div>
              <button onClick={handleSave} disabled={!evolutionText || isSaving} className="px-6 py-2.5 rounded-xl border border-border text-[10px] font-black uppercase tracking-widest hover:bg-secondary transition-all flex items-center gap-2 disabled:opacity-50">
                 {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} SALVAR
              </button>
              <button onClick={handleCopy} disabled={!evolutionText} className="px-6 py-2.5 rounded-xl bg-navy text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-navy/20 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50">
                 <Copy className="h-3 w-3" /> COPIAR
              </button>
              <SpecialistCard
                 specialist={specialist}
                 isLoading={consultLoading}
                 onConsult={() => triggerConsult()}
                 variant="inline"
              />
              <ThemeToggle />
           </div>
        </div>
      </header>

      {rascunhoInfo && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-[11px] font-bold text-amber-900 uppercase tracking-wider">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Rascunho não salvo encontrado de {format(parseISO(rascunhoInfo.savedAt), "dd/MM/yyyy 'às' HH:mm")}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={restaurarRascunho} className="px-4 py-2 rounded-lg bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all">
                Restaurar
              </button>
              <button onClick={descartarRascunho} className="px-4 py-2 rounded-lg border border-amber-300 text-amber-900 text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all">
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-12">
         <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8">
            
            {/* PAINEL LATERAL */}
            <aside className="space-y-6 order-2 lg:order-1">
               <SectionCard title="DADOS CLÍNICOS" icon={<Activity className="h-4 w-4" />}>
                  <div className="space-y-6">
                     <div>
                        <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">LABS RECENTES</h4>
                        {paciente.data?.lab ? (
                           <div className="p-4 bg-secondary/30 rounded-2xl border border-border text-[11px] font-bold text-foreground leading-relaxed uppercase">
                              {paciente.data.lab.formatted || "Aguardando resultados."}
                           </div>
                        ) : <p className="text-[10px] italic text-muted-foreground">Nenhum laboratório.</p>}
                     </div>

                     <div>
                        <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">ANTIBIÓTICOS</h4>
                        {paciente.data?.abx?.length > 0 ? (
                           <div className="space-y-2">
                              {paciente.data.abx.map((atb: any, i: number) => (
                                 <div key={i} className="flex justify-between items-center p-3 bg-elevated border border-border rounded-xl">
                                    <span className="text-[10px] font-black text-foreground uppercase">{atb.name}</span>
                                    <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded">
                                       {(() => {
                                          try {
                                             const d = parseISO(atb.d0);
                                             if (!isValid(d)) return "??";
                                             return `D${differenceInDays(startOfDay(new Date()), startOfDay(d))}`;
                                          } catch { return "??"; }
                                       })()}
                                    </span>
                                 </div>
                              ))}
                           </div>
                        ) : <p className="text-[10px] italic text-muted-foreground">Sem ATB.</p>}
                     </div>

                     <div>
                        <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">PENDÊNCIAS</h4>
                        <div className="space-y-2">
                           {paciente.pendingIssues?.length > 0 ? (
                              paciente.pendingIssues.map((p: string, i: number) => (
                                 <div key={i} className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[10px] font-bold text-amber-900 uppercase">
                                    <AlertTriangle className="h-3 w-3 text-amber-500" /> {p}
                                 </div>
                              ))
                           ) : <p className="text-[10px] italic text-muted-foreground text-emerald-600 font-bold uppercase tracking-widest flex items-center gap-2"><Check className="h-3 w-3" /> Nenhuma pendência.</p>}
                        </div>
                     </div>
                  </div>
               </SectionCard>

               <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => nav({ to: "/prescricao/$id", params: { id } })} className="flex flex-col items-center justify-center p-6 bg-elevated border border-border rounded-3xl hover:border-primary hover:bg-primary/5 transition-all group">
                     <Pill className="h-6 w-6 text-muted-foreground group-hover:text-primary mb-2" />
                     <span className="text-[9px] font-black uppercase tracking-widest">PRESCRIÇÃO</span>
                  </button>
                  <button onClick={() => nav({ to: "/dashboard" })} className="flex flex-col items-center justify-center p-6 bg-elevated border border-border rounded-3xl hover:border-primary hover:bg-primary/5 transition-all group">
                     <ArrowRight className="h-6 w-6 text-muted-foreground group-hover:text-primary mb-2" />
                     <span className="text-[9px] font-black uppercase tracking-widest">PASSAGEM</span>
                  </button>
               </div>
            </aside>

            {/* ÁREA PRINCIPAL */}
            <div className="space-y-6 order-1 lg:order-2">
               <div className="bg-elevated border border-border rounded-2xl md:rounded-[2.5rem] p-4 md:p-8 shadow-sm flex flex-col min-h-[600px]">
                  <div className="flex items-center justify-between mb-8">
                     <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-ai/10 flex items-center justify-center text-ai border border-ai/20">
                           <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                           <h2 className="text-xs font-black uppercase tracking-[0.2em]">GERADOR DE EVOLUÇÃO IA</h2>
                           <p className="text-[10px] font-bold text-muted-foreground uppercase">{tipoUnidade.replace('_', ' ')}</p>
                        </div>
                     </div>
                     <button 
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="px-8 py-4 rounded-2xl bg-ai text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-ai/20 hover:shadow-ai/40 hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center gap-3"
                     >
                        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {isGenerating ? "GERANDO..." : "GERAR EVOLUÇÃO"}
                     </button>
                  </div>

                  {/* Anotações brutas (opcional) — quando ditadas ou rascunhadas */}
                  <div className="mb-4 border-b border-border pb-4">
                     <button
                        type="button"
                        onClick={() => setShowRawNotes((v) => !v)}
                        className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-2 mb-2"
                        aria-expanded={showRawNotes}
                     >
                        <Wand2 className="h-3 w-3" />
                        {showRawNotes ? "OCULTAR ANOTAÇÕES BRUTAS" : "USAR ANOTAÇÕES BRUTAS COMO ENTRADA"}
                     </button>
                     {showRawNotes && (
                        <textarea
                           value={rawNotes}
                           onChange={(e) => setRawNotes(e.target.value)}
                           placeholder="Cole ou dite suas anotações brutas aqui. A IA vai reestruturar conforme o modelo selecionado."
                           className="w-full min-h-[120px] bg-secondary/20 border border-border rounded-2xl p-4 text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-ai/30"
                           aria-label="Anotações brutas para reestruturação"
                        />
                     )}
                     <p className="text-[9px] font-bold text-muted-foreground italic mt-1">
                        Modelo: <span className="text-foreground">{activeTemplate.label}</span> · {activeTemplate.description}
                     </p>
                  </div>

                  <div className="flex-1 relative">
                     {isGenerating && (
                        <div className="absolute inset-0 bg-elevated/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-3xl border border-dashed border-ai/40">
                           <Loader2 className="h-12 w-12 text-ai animate-spin mb-6" />
                           <p className="text-xs font-black uppercase tracking-[0.2em] text-ai animate-pulse">ESTRUTURANDO PRONTUÁRIO...</p>
                        </div>
                     )}
                     <textarea
                        value={evolutionText}
                        onChange={(e) => setEvolutionText(e.target.value)}
                        placeholder="Clique em 'GERAR EVOLUÇÃO' para iniciar o rascunho com IA ou digite aqui..."
                        className="w-full h-full min-h-[500px] bg-secondary/20 border border-border rounded-3xl p-8 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-navy/20 custom-scrollbar uppercase"
                     />
                  </div>

                  <div className="mt-6 border-t border-border pt-6">
                     <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                        Refinar com instrução
                     </label>
                     <div className="flex gap-3">
                        <input
                           type="text"
                           value={refineInstruction}
                           onChange={(e) => setRefineInstruction(e.target.value)}
                           onKeyDown={(e) => { if (e.key === "Enter" && !isRefining) handleRefine(); }}
                           disabled={isRefining || !evolutionText.trim()}
                           placeholder="ex: encurte, adicione PCR caiu de 12 para 5, corrija o exame físico..."
                           aria-label="Instrução para refinar a evolução"
                           className="flex-1 px-4 py-3 rounded-xl border border-border bg-elevated text-xs font-bold placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-ai/30 disabled:opacity-50"
                        />
                        <button
                           onClick={handleRefine}
                           disabled={isRefining || !refineInstruction.trim() || !evolutionText.trim()}
                           className="px-6 py-3 rounded-xl bg-ai/10 text-ai border border-ai/30 text-[10px] font-black uppercase tracking-widest hover:bg-ai hover:text-white transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                           {isRefining ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                           {isRefining ? "AJUSTANDO..." : "AJUSTAR COM IA"}
                        </button>
                     </div>
                  </div>
               </div>

               {tipoUnidade === 'uti' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <MiniStat label="MODO VM" value={paciente.data?.resp?.modo || '-'} />
                     <MiniStat label="FiO2" value={paciente.data?.resp?.fio2 ? `${paciente.data.resp.fio2}%` : '-'} />
                     <MiniStat label="PEEP" value={paciente.data?.resp?.peep || '-'} />
                     <MiniStat label="FR" value={paciente.data?.resp?.vmFr || '-'} />
                  </div>
               )}
            </div>

         </div>
      </main>

      {showVersions && (
        <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex justify-end" onClick={() => setShowVersions(false)}>
          <aside
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-elevated border-l border-border shadow-2xl flex flex-col h-full"
            role="dialog"
            aria-label="Versões geradas"
          >
            <header className="px-6 py-5 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest">Versões</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Snapshots desta sessão</p>
              </div>
              <button onClick={() => setShowVersions(false)} className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3">
              {versions.length === 0 ? (
                <p className="text-xs italic text-muted-foreground text-center py-12">Nenhuma versão ainda. Gere ou refine uma evolução.</p>
              ) : versions.map((v) => (
                <div key={v.id} className="border border-border rounded-2xl p-4 bg-secondary/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                      {v.source === "gerar" && "GERADA"}
                      {v.source === "refinar" && "REFINADA"}
                      {v.source === "base" && "DE ANTERIOR"}
                      {" · "}
                      {format(parseISO(v.createdAt), "HH:mm:ss")}
                    </span>
                    <button
                      onClick={() => { restoreVersion(v); setShowVersions(false); }}
                      className="px-3 py-1.5 rounded-lg bg-navy text-white text-[9px] font-black uppercase tracking-widest hover:-translate-y-0.5 transition-all flex items-center gap-1"
                    >
                      <RotateCcw className="h-3 w-3" /> Restaurar
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono leading-relaxed text-foreground line-clamp-6 whitespace-pre-wrap">{v.text}</pre>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}

      {overwriteChoice === "ask" && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-elevated w-full max-w-md rounded-[2rem] border border-border shadow-2xl overflow-hidden">
            <header className="px-8 py-6 border-b border-border bg-secondary/30">
              <h2 className="text-sm font-black text-foreground uppercase tracking-widest">Já existe texto no campo</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Como você quer gerar a nova evolução?</p>
            </header>
            <div className="p-6 space-y-3">
              <button
                onClick={() => { setOverwriteChoice(null); runGenerate("replace"); }}
                className="w-full px-6 py-4 rounded-xl bg-navy text-white text-[11px] font-black uppercase tracking-widest hover:-translate-y-0.5 transition-all text-left"
              >
                Substituir texto atual
              </button>
              <button
                onClick={() => { setOverwriteChoice(null); runGenerate("append"); }}
                className="w-full px-6 py-4 rounded-xl border border-border text-foreground text-[11px] font-black uppercase tracking-widest hover:bg-secondary transition-all text-left"
              >
                Anexar abaixo
              </button>
              <button
                onClick={() => setOverwriteChoice(null)}
                className="w-full px-6 py-4 rounded-xl text-muted-foreground text-[11px] font-black uppercase tracking-widest hover:bg-secondary transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <SpecialistDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        specialist={specialist}
        consult={consult}
        isLoading={consultLoading}
        onAcceptSuggestions={handleAcceptSuggestionsEvol}
      />
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string, icon: any, children: any }) {
  return (
    <div className="bg-elevated border border-border rounded-[2rem] overflow-hidden shadow-sm">
      <header className="px-6 py-4 border-b border-border bg-secondary/20 flex items-center gap-3">
        <div className="text-muted-foreground">{icon}</div>
        <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground">{title}</h3>
      </header>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-elevated border border-border rounded-2xl p-4 text-center shadow-sm">
       <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
       <p className="text-lg font-black text-foreground">{value}</p>
    </div>
  );
}
