import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ChevronLeft,
  Save,
  Plus,
  Trash2,
  Pill,
  Activity,
  Stethoscope,
  AlertTriangle,
  FileText,
  User,
  Thermometer,
  Wind,
  Baby,
  Info,
  FlaskConical,
} from "lucide-react";
import { toast } from "sonner";
import { useShift } from "@/hooks/useShift";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";

import { getPatientById, createPatient, updatePatient } from "@/lib/db";

import { storage } from "@/lib/storage";

import { ControlledInput, ControlledTextarea } from "@/components/ui/controlled-input";

export const Route = createFileRoute("/cadastro-manual")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tipo: (search.tipo as "admissao" | "internado") || "internado",
      id: search.id as string | undefined,
    };
  },
  component: CadastroManualPage,
  head: () => ({ meta: [{ title: "Cadastro Manual — MEDFLUXO" }] }),
});

const PREDEFINED_COMORBIDITIES = [
  "HAS",
  "DM2",
  "ICC",
  "DPOC",
  "IRC",
  "Tabagismo",
  "Etilismo",
  "Neoplasia",
  "Obesidade",
  "Hipotireoidismo",
  "DLP",
  "AVE Prévio",
];

const PREDEFINED_MEDS = [
  {
    label: "SINTOMÁTICOS",
    items: ["Dipirona 1g EV 6/6h", "Ondansetrona 8mg EV 8/8h", "Plasil 10mg EV 8/8h"],
  },
  {
    label: "PROFILAXIA",
    items: ["Enoxaparina 40mg SC 24/24h", "Heparina 5000UI SC 8/8h", "Omeprazol 40mg EV 24/24h"],
  },
  {
    label: "HIDRATAÇÃO",
    items: ["SF 0,9% 500ml EV agora", "RL 500ml EV agora", "SG 5% 500ml EV agora"],
  },
];

const PREDEFINED_PHYSICAL = {
  estado_geral: [
    "BEG, LOTE, ACIDANÓTICO, ANICTÉRICO",
    "MEG, SONOLENTO, DESIDRATADO ++/4+",
    "REG, LOTE, PALIDEZ CUTÂNEA",
  ],
  acv: [
    "RCR 2T BNF SEM SOPROS, PULSOS PRESENTES",
    "RCR 2T BNF COM SOPRO SISTÓLICO 2+/6+ EM FOCO MITRAL",
    "ARRITMIA COMPLETA (FA), BNF",
  ],
  ar: [
    "MVU SEM RUÍDOS ADVENTÍCIOS, EUPNEICO",
    "MVU DIMINUÍDO EM BASES, COM ESTERTORES CREPITANTES À DIREITA",
    "MVU GLOBALMENTE DIMINUÍDO, COM SIBILOS EXPIRATÓRIOS",
  ],
  abdome: [
    "RHA+, PLANO, INDOLOR À PALPAÇÃO",
    "RHA+, DISTENDIDO, TIMPÂNICO, INDOLOR",
    "RHA DIMINUÍDO, DOLOROSO À PALPAÇÃO EM FID",
  ],
  neuro: [
    "GLASGOW 15, SEM DÉFICITS FOCAIS",
    "GLASGOW 13 (A4V3M6), ISOCÓRICO E FOTORREAGENTE",
    "VIGIL, ORIENTADO, HEMIPARESIA À DIREITA",
  ],
};

const PREDEFINED_DVA = [
  "NORADRENALINA",
  "DOBUTAMINA",
  "VASOPRESSINA",
  "NITROPRUSSIATO",
  "NIPRIDE",
  "TRIDIL",
];
const PREDEFINED_VENT = ["PCV", "VCV", "PSV", "CPAP", "SIMV"];

function CadastroManualPage() {
  const { tipo, id } = Route.useSearch() as any;
  const nav = useNavigate();
  const { userId } = useSupabaseUser();
  const { getShift, getTipo } = useShift();
  const shift = getShift();
  const tipoEvolucao = getTipo(); // uti | enfermaria_pediatrica | etc
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!id);

  const [form, setForm] = useState({
    nome: "",
    idade: "",
    sexo: "F" as "F" | "M",
    leito: "",
    setor: shift?.setor || "",
    data_admissao: new Date().toISOString().slice(0, 10),
    procedencia: "",
    motivo_admissao: "",
    hda: "",
    comorbidades: [] as string[],
    lista_de_problemas: [] as { id: string; text: string }[],
    antibioticos: [] as any[],
    medicacoes: [] as { id: string; text: string }[],
    laboratorios: [
      { id: Date.now().toString(), data: new Date().toISOString().slice(0, 10), valor: "" },
    ],
    exame_fisico: {
      estado_geral: "",
      acv: "",
      ar: "",
      abdome: "",
      neuro: "",
      extremidades: "",
      pele: "",
    },
    uti: {
      vm: false,
      modo: "",
      fio2: "",
      peep: "",
      volume: "",
      fr: "",
      dva: [] as { id: string; text: string }[],
      bh: "",
      sedacao: "",
    },
    pediatria: { peso: "", altura: "", meses: "", aleitamento: false, desenvolvimento: "" },
    condutas: "",
    pendencias: [] as { id: string; text: string }[],
  });

  const [customComorbidity, setCustomComorbidity] = useState("");
  const [showCustomComorbidity, setShowCustomComorbidity] = useState(false);

  // Auto-calculate pediatric age in months if applicable
  useEffect(() => {
    if (tipoEvolucao === "enfermaria_pediatrica" && form.idade) {
      const ageInMonths = parseInt(form.idade) * 12;
      if (ageInMonths < 24) {
        setForm((f) => ({ ...f, pediatria: { ...f.pediatria, meses: ageInMonths.toString() } }));
      }
    }
  }, [form.idade, tipoEvolucao]);

  // Load existing patient if id is provided
  useEffect(() => {
    if (!id || !userId) {
      if (id) setLoading(false);
      return;
    }

    async function load() {
      try {
        if (id.startsWith("temp_")) throw new Error("Local");
        const p = await getPatientById(id, userId!);
        if (p) populateForm(p);
      } catch {
        // Fallback local
        const existing = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
        const p = existing.find((x: any) => x.id === id);
        if (p) populateFormFromLocal(p);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, userId]);

  const populateForm = (p: any) => {
    setForm((f) => ({
      ...f,
      nome: p.name || "",
      idade: p.age || "",
      sexo: (p.sex as any) || "F",
      leito: p.bed || "",
      setor: p.sector || "",
      data_admissao: p.admission_date || new Date().toISOString().slice(0, 10),
      procedencia: p.procedencia || "",
      motivo_admissao: p.reason_for_admission || "",
      hda: p.hda || "",
      comorbidades: p.comorbidities || [],
      lista_de_problemas: (p.problem_list || []).map((text: string) => ({
        id: Math.random().toString(),
        text,
      })),
      antibioticos: (p.antibiotics || []).map((a: any) => ({
        id: Math.random().toString(),
        nome: a.nome,
        dose: a.dose,
        via: a.via,
        frequencia: a.frequencia,
        dataInicio: a.data_inicio || a.dataInicio,
      })),
      medicacoes: (p.medications || []).map((text: string) => ({
        id: Math.random().toString(),
        text,
      })),
      laboratorios: (p.labs || []).map((l: any) => ({
        id: Math.random().toString(),
        data: l.data,
        valor: l.texto_compacto || l.valor,
      })),
      exame_fisico: {
        estado_geral: p.physical_exam?.geral || "",
        acv: p.physical_exam?.acv || "",
        ar: p.physical_exam?.ar || "",
        abdome: p.physical_exam?.abdome || "",
        neuro: p.physical_exam?.neuro || "",
        extremidades: p.physical_exam?.extremidades || "",
        pele: p.physical_exam?.pele || "",
      },
      condutas: (p.conducts || []).join("\n"),
      pendencias: (p.pending_issues || []).map((text: string) => ({
        id: Math.random().toString(),
        text,
      })),
    }));
  };

  const populateFormFromLocal = (p: any) => {
    setForm((f) => ({
      ...f,
      ...p,
    }));
  };

  const handleSave = async (generateEvolution = false) => {
    if (!form.nome || !form.leito) {
      toast.error("Nome e Leito são obrigatórios.");
      return;
    }

    if (!userId) {
      toast.error("Usuário não identificado.");
      return;
    }

    if (saving) return;
    setSaving(true);

    try {
      const shiftId = storage.getShiftId();

      if (shiftId && !shiftId.startsWith("temp_")) {
        const payload = {
          name: form.nome,
          age: form.idade,
          sex: form.sexo,
          bed: form.leito,
          sector: form.setor,
          admission_date: form.data_admissao,
          reason_for_admission: form.motivo_admissao,
          hda: form.hda,
          comorbidities: form.comorbidades,
          problem_list: form.lista_de_problemas.map((p) => p.text),
          antibiotics: form.antibioticos.map((a) => ({
            nome: a.nome,
            dose: a.dose,
            via: a.via,
            frequencia: a.frequencia,
            data_inicio: a.dataInicio,
          })),
          medications: form.medicacoes.map((m) => m.text),
          labs: form.laboratorios.map((l) => ({
            data: l.data,
            texto_compacto: l.valor,
            valores: {},
          })),
          physical_exam: {
            geral: form.exame_fisico.estado_geral,
            acv: form.exame_fisico.acv,
            ar: form.exame_fisico.ar,
            abdome: form.exame_fisico.abdome,
            neuro: form.exame_fisico.neuro,
            extremidades: form.exame_fisico.extremidades,
            pele: form.exame_fisico.pele,
          },
          conducts: form.condutas ? form.condutas.split("\n").filter(Boolean) : [],
          pending_issues: form.pendencias.map((p) => p.text),
          status: "internado",
          tipo_admissao: tipo,
        };

        let savedPatient;
        if (id && !id.startsWith("temp_")) {
          savedPatient = await updatePatient(id, payload, userId);
        } else {
          savedPatient = await createPatient({ ...payload, shift_id: shiftId }, userId);
        }

        toast.success(id ? "Paciente atualizado!" : "Paciente cadastrado com sucesso!");
        if (generateEvolution) {
          nav({ to: "/evolucao/$id", params: { id: savedPatient.id } });
        } else {
          nav({ to: "/dashboard" });
        }
        return;
      }

      throw new Error("Offline ou ID temporário");
    } catch (err) {
      console.warn("Salvando offline", err);

      // Fallback
      const newPatient = {
        id: id || "temp_" + Date.now(),
        ...form,
        status: "internado",
        tipo_admissao: tipo,
        criado_em: Date.now(),
      };

      const existing = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
      const idx = existing.findIndex((p: any) => p.id === newPatient.id);

      if (idx >= 0) existing[idx] = newPatient;
      else existing.push(newPatient);

      localStorage.setItem("da_pacientes", JSON.stringify(existing));

      toast.success(id ? "Paciente atualizado localmente!" : "Paciente cadastrado localmente!");
      if (generateEvolution) {
        nav({ to: "/evolucao/$id", params: { id: newPatient.id } });
      } else {
        nav({ to: "/dashboard" });
      }
    } finally {
      setSaving(false);
    }
  };

  const addItem = (key: "lista_de_problemas" | "medicacoes" | "pendencias") => {
    setForm((f) => ({
      ...f,
      [key]: [...f[key], { id: Date.now().toString() + Math.random(), text: "" }],
    }));
  };

  const updateItem = (
    key: "lista_de_problemas" | "medicacoes" | "pendencias",
    id: string,
    text: string,
  ) => {
    setForm((f) => ({
      ...f,
      [key]: f[key].map((item) => (item.id === id ? { ...item, text } : item)),
    }));
  };

  const removeItem = (key: "lista_de_problemas" | "medicacoes" | "pendencias", id: string) => {
    setForm((f) => ({
      ...f,
      [key]: f[key].filter((item) => item.id !== id),
    }));
  };

  const handleConductKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      const lines = form.condutas.split("\n").filter(Boolean);
      const lastLine = lines[lines.length - 1] || "";
      const currentNumberMatch = lastLine.match(/^(\d+)\./);
      const nextNumber = currentNumberMatch
        ? parseInt(currentNumberMatch[1]) + 1
        : lines.length + 1;

      // If the textarea is empty or doesn't have enumeration yet, start with 1.
      if (form.condutas.trim() === "") {
        e.preventDefault();
        setForm((f) => ({ ...f, condutas: "1. " }));
        return;
      }

      // Add next number automatically
      e.preventDefault();
      setForm((f) => ({ ...f, condutas: form.condutas + "\n" + nextNumber + ". " }));
    }
  };

  const handleAISuggestions = async () => {
    toast.info("A IA está analisando o caso clínico...");
    // Mock simulation
    setTimeout(() => {
      const suggestions =
        "1. Vigilância hemodiátrica rigorosa\n2. Reavaliar antibioticoterapia em 48h\n3. Controle de balanço hídrico diário\n4. Fisioterapia motora e respiratória";
      setForm((f) => ({ ...f, condutas: f.condutas + (f.condutas ? "\n" : "") + suggestions }));
      toast.success("Sugestões de conduta adicionadas!");
    }, 2000);
  };

  const triggerPhotoExtraction = (field: "laboratorios" | "medicacoes") => {
    toast.promise(new Promise((res) => setTimeout(res, 3000)), {
      loading: "Processando imagem...",
      success: "Dados extraídos com sucesso!",
      error: "Falha na extração.",
    });
    // In a real scenario, this would open a file picker and call the documentExtractor
  };

  const addATB = () => {
    setForm((f) => ({
      ...f,
      antibioticos: [
        ...f.antibioticos,
        {
          id: Date.now().toString(),
          nome: "",
          dose: "",
          via: "EV",
          frequencia: "12/12h",
          dataInicio: new Date().toISOString().slice(0, 10),
        },
      ],
    }));
  };

  const toggleComorbidity = (c: string) => {
    setForm((f) => ({
      ...f,
      comorbidades: f.comorbidades.includes(c)
        ? f.comorbidades.filter((item) => item !== c)
        : [...f.comorbidades, c],
    }));
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      {loading && (
        <div className="fixed inset-0 z-50 bg-background/50 backdrop-blur-sm flex items-center justify-center">
          <div className="animate-spin text-primary">
            <Activity className="h-8 w-8" />
          </div>
        </div>
      )}
      <header className="bg-background/90 border-border sticky top-0 z-30 w-full border-b backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={() => window.history.back()}
            aria-label="Voltar"
            className="touch-target border-border bg-card text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl border transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <h1 className="t-title text-foreground">
            {tipo === "admissao" ? "Cadastro de admissão" : "Cadastro manual"}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
        {/* IDENTIFICAÇÃO */}
        <Section title="Identificação" icon={<User className="h-5 w-5" />}>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="t-label text-muted-foreground">Nome completo *</label>
              <ControlledInput
                value={form.nome}
                onValueChange={(v) => setForm({ ...form, nome: v })}
                placeholder="Nome do paciente"
                uppercase
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="t-label text-muted-foreground">Idade</label>
                <ControlledInput
                  type="number"
                  value={form.idade}
                  onValueChange={(v) => setForm({ ...form, idade: v })}
                />
              </div>
              <div className="space-y-2">
                <label className="t-label text-muted-foreground">Sexo</label>
                <div className="flex bg-secondary/50 rounded-xl p-1 h-[50px]">
                  {["F", "M"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setForm({ ...form, sexo: s as any })}
                      className={`focus-visible:ring-ring min-h-[2.75rem] flex-1 rounded-lg text-base font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none ${form.sexo === s ? "bg-card text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {s === "F" ? "FEM" : "MASC"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="t-label text-muted-foreground">Leito *</label>
              <ControlledInput
                value={form.leito}
                onValueChange={(v) => setForm({ ...form, leito: v })}
                placeholder="Ex: L12"
                uppercase
              />
            </div>
            <div className="space-y-2">
              <label className="t-label text-muted-foreground">Setor</label>
              <ControlledInput
                value={form.setor}
                onValueChange={(v) => setForm({ ...form, setor: v })}
                uppercase
              />
            </div>
            <div className="space-y-2">
              <label className="t-label text-muted-foreground">Data de admissão</label>
              <ControlledInput
                type="date"
                value={form.data_admissao}
                onValueChange={(v) => setForm({ ...form, data_admissao: v })}
              />
            </div>
          </div>
          {tipo === "admissao" && (
            <div className="space-y-2">
              <label className="t-label text-muted-foreground">Procedência</label>
              <ControlledInput
                value={form.procedencia}
                onValueChange={(v) => setForm({ ...form, procedencia: v })}
                placeholder="Ex: UPA Central"
              />
            </div>
          )}
        </Section>

        {/* MOTIVO DA ADMISSÃO & HDA */}
        <Section title="Motivo da admissão" icon={<FileText className="h-5 w-5" />}>
          <ControlledTextarea
            value={form.motivo_admissao}
            onValueChange={(v) => setForm({ ...form, motivo_admissao: v })}
            placeholder="Ex: dispneia progressiva há 3 dias..."
            rows={2}
          />
          <div className="space-y-2 pt-4">
            <label className="t-label text-muted-foreground">História da doença atual</label>
            <ControlledTextarea
              value={form.hda}
              onValueChange={(v) => setForm({ ...form, hda: v })}
              rows={6}
              placeholder="Descreva o quadro clínico completo..."
            />
          </div>
        </Section>

        {/* COMORBIDADES */}
        <Section title="Comorbidades" icon={<Stethoscope className="h-5 w-5" />}>
          <div className="flex flex-wrap gap-2">
            {PREDEFINED_COMORBIDITIES.map((c) => (
              <button
                key={c}
                onClick={() => toggleComorbidity(c)}
                className={`t-label focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center rounded-xl border px-3 transition-colors focus-visible:ring-2 focus-visible:outline-none ${form.comorbidades.includes(c) ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/40"}`}
              >
                {c}
              </button>
            ))}
            <button
              onClick={() => setShowCustomComorbidity(!showCustomComorbidity)}
              className="t-label bg-secondary text-muted-foreground border-border inline-flex min-h-[2.75rem] items-center rounded-xl border px-3"
            >
              + OUTRA
            </button>
          </div>
          {showCustomComorbidity && (
            <div className="flex gap-2 pt-4 animate-in fade-in slide-in-from-top-2">
              <ControlledInput
                value={customComorbidity}
                onValueChange={setCustomComorbidity}
                placeholder="DIGITE A COMORBIDADE"
                uppercase
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customComorbidity) {
                    toggleComorbidity(customComorbidity);
                    setCustomComorbidity("");
                    setShowCustomComorbidity(false);
                  }
                }}
              />
            </div>
          )}
        </Section>

        {/* LISTA DE PROBLEMAS */}
        <Section title="Lista de problemas" icon={<Activity className="h-5 w-5" />}>
          <div className="space-y-3">
            {form.lista_de_problemas.map((p) => (
              <div key={p.id} className="flex gap-2">
                <ControlledInput
                  value={p.text}
                  onValueChange={(v) => updateItem("lista_de_problemas", p.id, v)}
                  placeholder="EX: INSUFICIÊNCIA CARDÍACA DESCOMPENSADA"
                  uppercase
                />
                <button
                  onClick={() => removeItem("lista_de_problemas", p.id)}
                  className="p-4 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive transition-colors group"
                >
                  <Trash2 className="h-5 w-5 group-hover:text-white" />
                </button>
              </div>
            ))}
            <button
              onClick={() => addItem("lista_de_problemas")}
              className="w-full py-4 border-2 border-dashed border-border rounded-xl text-xs font-bold text-muted-foreground hover:border-primary/40 hover:text-primary transition-all flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Adicionar problema
            </button>
          </div>
        </Section>

        {/* ANTIBIÓTICOS */}
        <Section title="Antibióticos" icon={<Pill className="h-5 w-5" />}>
          <div className="space-y-6">
            {form.antibioticos.map((atb, idx) => (
              <div
                key={atb.id}
                className="bg-secondary/30 border border-border rounded-2xl p-6 relative group"
              >
                <button
                  onClick={() =>
                    setForm({
                      ...form,
                      antibioticos: form.antibioticos.filter((a) => a.id !== atb.id),
                    })
                  }
                  className="absolute top-4 right-4 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1">
                    <label className="t-label text-muted-foreground font-normal">
                      Nome do antibiótico
                    </label>
                    <ControlledInput
                      value={atb.nome}
                      onValueChange={(v) => {
                        const newList = [...form.antibioticos];
                        newList[idx].nome = v;
                        setForm({ ...form, antibioticos: newList });
                      }}
                      uppercase
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="t-label text-muted-foreground font-normal">Dose</label>
                      <ControlledInput
                        value={atb.dose}
                        onValueChange={(v) => {
                          const newList = [...form.antibioticos];
                          newList[idx].dose = v;
                          setForm({ ...form, antibioticos: newList });
                        }}
                        uppercase
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="t-label text-muted-foreground font-normal">
                        Data de início
                      </label>
                      <ControlledInput
                        type="date"
                        value={atb.dataInicio}
                        onValueChange={(v) => {
                          const newList = [...form.antibioticos];
                          newList[idx].dataInicio = v;
                          setForm({ ...form, antibioticos: newList });
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="t-label text-muted-foreground font-normal">VIA</label>
                    <div className="bg-secondary border-border flex rounded-xl border p-1">
                      {["EV", "VO", "IM", "SC", "Inalatória"].map((v) => (
                        <button
                          key={v}
                          onClick={() => {
                            const newList = [...form.antibioticos];
                            newList[idx].via = v;
                            setForm({ ...form, antibioticos: newList });
                          }}
                          className={`t-label focus-visible:ring-ring min-h-[2.75rem] flex-1 rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none ${atb.via === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="t-label text-muted-foreground font-normal">Frequência</label>
                    <select
                      value={atb.frequencia}
                      onChange={(e) => {
                        const newList = [...form.antibioticos];
                        newList[idx].frequencia = e.target.value;
                        setForm({ ...form, antibioticos: newList });
                      }}
                      className={inputCls}
                    >
                      {["8/8h", "12/12h", "24/24h", "6/6h", "Dose única"].map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={addATB}
              className="w-full py-4 border-2 border-dashed border-ai/30 rounded-xl text-xs font-bold text-ai hover:bg-ai/5 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Adicionar antibiótico
            </button>
          </div>
        </Section>

        {/* MEDICAÇÕES */}
        <Section title="Medicações em uso" icon={<Pill className="h-5 w-5" />}>
          <div className="flex justify-between items-center mb-6">
            <p className="t-label text-muted-foreground">Lista de prescrição</p>
            <button
              onClick={() => triggerPhotoExtraction("medicacoes")}
              className="t-label bg-ai/10 text-ai border-ai/20 hover:bg-ai/20 focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center gap-2 rounded-xl border px-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <Activity className="h-3.5 w-3.5" />
              Ler por foto ou print
            </button>
          </div>

          <div className="space-y-6">
            {PREDEFINED_MEDS.map((group) => (
              <div key={group.label} className="space-y-2">
                <p className="t-label text-muted-foreground font-normal">{group.label}</p>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <button
                      key={item}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          medicacoes: [
                            ...f.medicacoes,
                            { id: Math.random().toString(), text: item.toUpperCase() },
                          ],
                        }))
                      }
                      className="t-label border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center rounded-xl border px-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      + {item}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="border-border mt-6 space-y-3 border-t pt-6">
            {form.medicacoes.map((m) => (
              <div key={m.id} className="flex gap-2">
                <ControlledInput
                  value={m.text}
                  onValueChange={(v) => updateItem("medicacoes", m.id, v)}
                  placeholder="NOME, DOSE, FREQUÊNCIA"
                  uppercase
                />
                <button
                  onClick={() => removeItem("medicacoes", m.id)}
                  className="p-4 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive transition-colors group"
                >
                  <Trash2 className="h-5 w-5 group-hover:text-white" />
                </button>
              </div>
            ))}
            <button
              onClick={() => addItem("medicacoes")}
              className="w-full py-4 border-2 border-dashed border-border rounded-xl text-xs font-bold text-muted-foreground hover:border-primary/40 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Adicionar medicação
            </button>
          </div>
        </Section>

        {/* LABORATÓRIOS */}
        <Section title="Laboratório" icon={<Activity className="h-5 w-5" />}>
          <div className="flex justify-between items-center mb-6">
            <p className="t-label text-muted-foreground">Resultados e evolução</p>
            <button
              onClick={() => triggerPhotoExtraction("laboratorios")}
              className="t-label bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center gap-2 rounded-xl border px-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              Ler exame por foto ou PDF
            </button>
          </div>

          <div className="space-y-6">
            {form.laboratorios.map((lab, idx) => (
              <div key={lab.id} className="space-y-3 border-b border-border pb-6 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="w-40">
                    <ControlledInput
                      type="date"
                      value={lab.data}
                      onValueChange={(v) => {
                        const newList = [...form.laboratorios];
                        newList[idx].data = v;
                        setForm({ ...form, laboratorios: newList });
                      }}
                    />
                  </div>
                  {idx > 0 && (
                    <button
                      onClick={() =>
                        setForm({
                          ...form,
                          laboratorios: form.laboratorios.filter((l) => l.id !== lab.id),
                        })
                      }
                      className="text-destructive hover:bg-destructive/10 p-2 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <ControlledTextarea
                  value={lab.valor}
                  onValueChange={(v) => {
                    const newList = [...form.laboratorios];
                    newList[idx].valor = v;
                    setForm({ ...form, laboratorios: newList });
                  }}
                  placeholder="Hb 10,2 | Ht 31 | Leuco 14500 | PCR 18 | Creat 1,4"
                  rows={3}
                  uppercase
                />
              </div>
            ))}
            <button
              onClick={() =>
                setForm({
                  ...form,
                  laboratorios: [
                    ...form.laboratorios,
                    {
                      id: Date.now().toString(),
                      data: new Date().toISOString().slice(0, 10),
                      valor: "",
                    },
                  ],
                })
              }
              className="w-full py-4 border-2 border-dashed border-border rounded-xl text-xs font-bold text-muted-foreground hover:border-primary/40 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Adicionar outra data
            </button>
          </div>
        </Section>

        {/* EXAME FÍSICO */}
        <Section title="Exame físico" icon={<Thermometer className="h-5 w-5" />}>
          <div className="space-y-8">
            {[
              { key: "estado_geral", label: "Estado geral" },
              { key: "acv", label: "ACV — cardiovascular" },
              { key: "ar", label: "AR — respiratório" },
              { key: "abdome", label: "Abdome" },
              { key: "neuro", label: "Neurológico" },
              { key: "extremidades", label: "Extremidades e MMII" },
              { key: "pele", label: "Pele e mucosas" },
            ].map((field) => (
              <div key={field.key} className="space-y-3">
                <label className="t-label text-muted-foreground">{field.label}</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(PREDEFINED_PHYSICAL as any)[field.key]?.map((phrase: string) => (
                    <button
                      key={phrase}
                      onClick={() =>
                        setForm({
                          ...form,
                          exame_fisico: { ...form.exame_fisico, [field.key]: phrase.toUpperCase() },
                        })
                      }
                      title={phrase}
                      className="t-label border-border bg-secondary text-muted-foreground hover:border-primary/30 focus-visible:ring-ring inline-flex min-h-[2.75rem] max-w-full items-center rounded-xl border px-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {/* Mostrava só o texto antes da primeira vírgula, então
                          três frases começando com "REG" viravam três chips
                          idênticos. Agora mostra a frase e deixa o CSS cortar. */}
                      <span className="line-clamp-2">{phrase}</span>
                    </button>
                  ))}
                </div>
                <ControlledInput
                  value={(form.exame_fisico as any)[field.key]}
                  onValueChange={(v) =>
                    setForm({ ...form, exame_fisico: { ...form.exame_fisico, [field.key]: v } })
                  }
                  placeholder="Clique acima ou digite..."
                  uppercase
                />
              </div>
            ))}
          </div>
        </Section>

        {/* CAMPOS EXTRAS (UTI / PEDIATRIA) */}
        {tipoEvolucao === "uti" && (
          <Section title="Campos da UTI" icon={<Wind className="h-5 w-5" />}>
            <div className="space-y-10">
              <div className="bg-secondary border-border flex items-center justify-between rounded-3xl border p-5">
                <div className="flex items-center gap-4">
                  <div className="bg-card border-border text-primary flex h-12 w-12 items-center justify-center rounded-2xl border">
                    <Wind className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="t-label text-foreground mb-1 block">Ventilação mecânica</span>
                    <p className="t-label text-muted-foreground font-normal">
                      Marque se o paciente está entubado ou em VNI
                    </p>
                  </div>
                </div>
                <div className="bg-card border-border flex rounded-xl border p-1.5">
                  <button
                    onClick={() => setForm({ ...form, uti: { ...form.uti, vm: false } })}
                    className={`t-label focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center rounded-lg px-5 transition-colors focus-visible:ring-2 focus-visible:outline-none ${!form.uti.vm ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    NÃO
                  </button>
                  <button
                    onClick={() => setForm({ ...form, uti: { ...form.uti, vm: true } })}
                    className={`t-label focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center rounded-lg px-5 transition-colors focus-visible:ring-2 focus-visible:outline-none ${form.uti.vm ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    SIM
                  </button>
                </div>
              </div>

              {form.uti.vm && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex flex-wrap gap-2">
                    {PREDEFINED_VENT.map((m) => (
                      <button
                        key={m}
                        onClick={() => setForm({ ...form, uti: { ...form.uti, modo: m } })}
                        className={`t-label focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center rounded-xl border px-3 transition-colors focus-visible:ring-2 focus-visible:outline-none ${form.uti.modo === m ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/30"}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                      { k: "fio2", l: "FiO2 (%)" },
                      { k: "peep", l: "PEEP" },
                      { k: "volume", l: "VOL/PRES" },
                      { k: "fr", l: "FR" },
                    ].map((v) => (
                      <div key={v.k} className="space-y-1.5">
                        <label className="t-label text-muted-foreground">{v.l}</label>
                        <ControlledInput
                          value={(form.uti as any)[v.k]}
                          onValueChange={(val) =>
                            setForm({ ...form, uti: { ...form.uti, [v.k]: val } })
                          }
                          uppercase
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-border grid gap-6 border-t pt-6 md:grid-cols-2">
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="t-label text-foreground">Drogas vasoativas</label>
                    <div className="bg-border mx-4 h-px flex-1" />
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {PREDEFINED_DVA.map((d) => (
                      <button
                        key={d}
                        onClick={() =>
                          setForm({
                            ...form,
                            uti: {
                              ...form.uti,
                              dva: [
                                ...form.uti.dva,
                                { id: Math.random().toString(), text: d + " " },
                              ],
                            },
                          })
                        }
                        className="t-label border-border text-muted-foreground hover:text-primary hover:border-primary/30 focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center rounded-xl border px-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      >
                        + {d}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {form.uti.dva.map((dva) => (
                      <div key={dva.id} className="flex gap-2 group">
                        <ControlledInput
                          value={dva.text}
                          onValueChange={(val) =>
                            setForm({
                              ...form,
                              uti: {
                                ...form.uti,
                                dva: form.uti.dva.map((item) =>
                                  item.id === dva.id ? { ...item, text: val } : item,
                                ),
                              },
                            })
                          }
                          placeholder="DOSE/VELOCIDADE..."
                          uppercase
                        />
                        <button
                          onClick={() =>
                            setForm({
                              ...form,
                              uti: {
                                ...form.uti,
                                dva: form.uti.dva.filter((item) => item.id !== dva.id),
                              },
                            })
                          }
                          className="touch-target bg-secondary text-muted-foreground hover:text-destructive focus-visible:ring-ring inline-flex items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        setForm({
                          ...form,
                          uti: {
                            ...form.uti,
                            dva: [...form.uti.dva, { id: Date.now().toString(), text: "" }],
                          },
                        })
                      }
                      className="t-body border-border text-muted-foreground hover:text-primary hover:border-primary focus-visible:ring-ring flex min-h-[3rem] w-full items-center justify-center rounded-2xl border-2 border-dashed transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      + ADICIONAR DVA MANUAL
                    </button>
                  </div>
                </div>
                <div className="space-y-8">
                  <div className="space-y-2">
                    <label className="t-label text-foreground mb-1 block">
                      Balanço hídrico 24 h (mL)
                    </label>
                    <ControlledInput
                      type="number"
                      value={form.uti.bh}
                      onValueChange={(v) => setForm({ ...form, uti: { ...form.uti, bh: v } })}
                      placeholder="EX: +1200"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="t-label text-foreground mb-1 block">
                      Sedação e analgesia
                    </label>
                    <ControlledInput
                      value={form.uti.sedacao}
                      onValueChange={(v) => setForm({ ...form, uti: { ...form.uti, sedacao: v } })}
                      placeholder="EX: FENTANIL + MIDAZOLAM"
                      uppercase
                    />
                  </div>
                </div>
              </div>
            </div>
          </Section>
        )}

        {tipoEvolucao === "enfermaria_pediatrica" && (
          <Section title="Campos da pediatria" icon={<Baby className="h-5 w-5" />}>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className="t-label text-muted-foreground font-normal">Peso (kg)</label>
                <ControlledInput
                  type="number"
                  value={form.pediatria.peso}
                  onValueChange={(v) =>
                    setForm({ ...form, pediatria: { ...form.pediatria, peso: v } })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="t-label text-muted-foreground font-normal">Altura (cm)</label>
                <ControlledInput
                  type="number"
                  value={form.pediatria.altura}
                  onValueChange={(v) =>
                    setForm({ ...form, pediatria: { ...form.pediatria, altura: v } })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="t-label text-muted-foreground font-normal">Idade em meses</label>
                <ControlledInput
                  type="number"
                  value={form.pediatria.meses}
                  onValueChange={(v) =>
                    setForm({ ...form, pediatria: { ...form.pediatria, meses: v } })
                  }
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-8 pt-6">
              <div className="space-y-4">
                <label className="t-label text-muted-foreground">Aleitamento materno</label>
                <div className="flex bg-secondary/30 rounded-xl p-1 border border-border">
                  <button
                    onClick={() =>
                      setForm({ ...form, pediatria: { ...form.pediatria, aleitamento: false } })
                    }
                    className={`t-label focus-visible:ring-ring min-h-[2.75rem] flex-1 rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none ${!form.pediatria.aleitamento ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    NÃO
                  </button>
                  <button
                    onClick={() =>
                      setForm({ ...form, pediatria: { ...form.pediatria, aleitamento: true } })
                    }
                    className={`t-label focus-visible:ring-ring min-h-[2.75rem] flex-1 rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none ${form.pediatria.aleitamento ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    SIM
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="t-label text-muted-foreground">Desenvolvimento</label>
                <ControlledTextarea
                  value={form.pediatria.desenvolvimento}
                  onValueChange={(v) =>
                    setForm({ ...form, pediatria: { ...form.pediatria, desenvolvimento: v } })
                  }
                  rows={2}
                />
              </div>
            </div>
          </Section>
        )}

        {/* CONDUTAS */}
        <Section title="Plano terapêutico" icon={<Save className="h-5 w-5" />}>
          <div className="flex justify-between items-center mb-4">
            <p className="t-label text-muted-foreground">Digite e dê Enter para numerar</p>
            <button
              onClick={handleAISuggestions}
              className="t-label bg-ai focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center gap-2 rounded-2xl px-4 text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
            >
              <Activity className="h-3.5 w-3.5" />
              Sugerir condutas com IA
            </button>
          </div>
          <ControlledTextarea
            value={form.condutas}
            onValueChange={(v) => setForm({ ...form, condutas: v })}
            onKeyDown={handleConductKeyDown}
            rows={8}
            placeholder="1. Vigiar balanço..."
            uppercase
          />
          <div className="bg-secondary border-border mt-4 flex items-start gap-3 rounded-2xl border p-4">
            <Info className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
            <p className="t-body text-muted-foreground">
              Dica: Pressione ENTER para criar automaticamente o próximo item da lista.
            </p>
          </div>
        </Section>

        {/* PENDÊNCIAS */}
        <Section title="Pendências" icon={<AlertTriangle className="h-5 w-5" />}>
          <div className="space-y-3">
            {form.pendencias.map((p) => (
              <div key={p.id} className="flex gap-2">
                <div className="flex items-center justify-center w-12 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20 shrink-0">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <ControlledInput
                  value={p.text}
                  onValueChange={(v) => updateItem("pendencias", p.id, v)}
                  placeholder="EX: AGUARDANDO RESULTADO DE ECOCARDIOGRAMA"
                  uppercase
                />
                <button
                  onClick={() => removeItem("pendencias", p.id)}
                  className="p-4 rounded-xl bg-destructive/10 text-destructive"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
            <button
              onClick={() => addItem("pendencias")}
              className="w-full py-4 border-2 border-dashed border-amber-500/30 rounded-xl text-xs font-bold text-amber-600 hover:bg-amber-500/5 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Adicionar pendência
            </button>
          </div>
        </Section>

        {/* BOTÕES FINAIS */}
        <footer className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border p-6 z-40">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-4">
            <button
              disabled={saving}
              onClick={() => handleSave(false)}
              className="border-border text-muted-foreground hover:bg-secondary focus-visible:ring-ring inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-2xl border text-base font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
            >
              {saving ? "Salvando…" : id ? "Atualizar paciente" : "Salvar paciente"}
            </button>
            <button
              disabled={saving}
              onClick={() => handleSave(true)}
              className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex min-h-[3rem] flex-[2] items-center justify-center gap-2 rounded-2xl text-base font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
            >
              <Save className="h-4 w-4" />{" "}
              {id ? "Atualizar e gerar evolução" : "Salvar e gerar evolução"}
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: any; children: any }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-6 ml-1">
        <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground border border-border/50">
          {icon}
        </div>
        <h2 className="t-title text-foreground">{title}</h2>
      </div>
      <div className="bg-card border-border space-y-5 rounded-3xl border p-5 sm:p-6">
        {children}
      </div>
    </div>
  );
}

const inputCls =
  "w-full min-h-[3rem] bg-secondary/40 border border-border rounded-xl px-4 py-3 text-base font-medium text-foreground placeholder:font-normal placeholder:text-muted-foreground placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-colors uppercase";
const textareaCls =
  "w-full bg-secondary/40 border border-border rounded-2xl px-4 py-4 text-base font-medium text-foreground placeholder:font-normal placeholder:text-muted-foreground placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card leading-relaxed transition-colors uppercase";
