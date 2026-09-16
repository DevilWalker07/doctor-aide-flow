import { createFileRoute } from "@tanstack/react-router";
import { FileText, ListChecks, Sparkles, Stethoscope } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ControlledInput, ControlledTextarea } from "@/components/ui/controlled-input";
import { DocumentoActions } from "@/components/documentos/DocumentoActions";
import { DocumentosLayout } from "@/components/documentos/DocumentosLayout";
import { EncaminhamentoA4 } from "@/components/documentos/EncaminhamentoA4";
import { PacienteHeaderForm } from "@/components/documentos/PacienteHeaderForm";
import { Chip, Section } from "@/components/documentos/Section";
import { apiJson } from "@/lib/apiClient";
import { formatEncaminhamentoWhatsApp } from "@/lib/documentos/formatters";
import type { EncaminhamentoDocumento } from "@/lib/documentos/types";
import { useDocumentoBase } from "@/lib/documentos/useDocumentoBase";
import {
  destinoLabel,
  ESPECIALIDADES_ENCAMINHAMENTO,
  EXAMES_COMUNS,
  montarEncaminhamento,
  PRIORIDADES_ENCAMINHAMENTO,
  type EncaminhamentoForm,
} from "@/lib/medical/encaminhamentoTemplates";

export const Route = createFileRoute("/encaminhamento")({
  component: EncaminhamentoPage,
  validateSearch: z.object({ paciente: z.string().optional() }),
  head: () => ({ meta: [{ title: "Encaminhamento — MEDFLUXO" }] }),
});

const FORM_INICIAL: EncaminhamentoForm = {
  destino: "Cardiologia",
  destinoOutro: "",
  prioridade: "eletivo",
  hipoteses: [],
  resumoClinico: "",
  justificativa: "",
  exames: [],
  solicitacao: "",
};

function EncaminhamentoPage() {
  const { paciente: pacienteId } = Route.useSearch();
  const base = useDocumentoBase(pacienteId);
  const [form, setForm] = useState<EncaminhamentoForm>(FORM_INICIAL);
  const [textoManual, setTextoManual] = useState<string | null>(null);
  const [hipoteseInput, setHipoteseInput] = useState("");
  const [suggesting, setSuggesting] = useState(false);

  const set = (patch: Partial<EncaminhamentoForm>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!base.vinculado) return;
    const v = base.vinculado;
    const resumo = [
      v.problemas.length ? `Problemas ativos: ${v.problemas.join("; ")}.` : "",
      v.medicacoes.length ? `Medicações em uso: ${v.medicacoes.join("; ")}.` : "",
      v.antibioticos.length ? `Antibióticos: ${v.antibioticos.join("; ")}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    setForm((f) => ({
      ...f,
      resumoClinico: f.resumoClinico || resumo,
      hipoteses: f.hipoteses.length ? f.hipoteses : v.problemas.slice(0, 4),
    }));
  }, [base.vinculado]);

  const textoGerado = useMemo(
    () =>
      montarEncaminhamento(
        form,
        {
          nome: base.pacienteForm.nome,
          idade: base.pacienteForm.idade,
          sexo:
            base.pacienteForm.sexo === "M"
              ? "Masculino"
              : base.pacienteForm.sexo === "F"
                ? "Feminino"
                : undefined,
        },
        base.data,
      ),
    [form, base.pacienteForm, base.data],
  );
  const texto = textoManual ?? textoGerado;
  const doc: EncaminhamentoDocumento = {
    paciente: base.pacienteForm,
    form,
    texto,
    data: base.data,
  };

  const addHipotese = () => {
    const h = hipoteseInput.trim();
    if (!h) return;
    set({ hipoteses: [...form.hipoteses, h] });
    setHipoteseInput("");
  };

  const sugerir = async () => {
    if (!form.justificativa.trim()) {
      toast.error("Escreva o motivo do encaminhamento antes de pedir a IA.");
      return;
    }
    setSuggesting(true);
    try {
      const res = await apiJson<{ referral_text: string }>("/api/ai/gerar-encaminhamento", {
        patient: base.vinculado?.raw ?? {
          name: base.pacienteForm.nome,
          age: base.pacienteForm.idade,
          sex: base.pacienteForm.sexo,
        },
        destinations: [destinoLabel(form)],
        specialty: destinoLabel(form),
        reason: form.justificativa,
        hypotheses: form.hipoteses,
        data_plantao: base.data,
      });
      setTextoManual(res.referral_text);
      toast.success("Texto gerado pela IA — revise antes de imprimir.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar com IA.");
    } finally {
      setSuggesting(false);
    }
  };

  const salvar = async () => {
    if (!base.pacienteForm.nome.trim()) {
      toast.error("Informe o nome do paciente.");
      return;
    }
    await base.salvar({
      type: "encaminhamento",
      title: `Encaminhamento — ${destinoLabel(form)} — ${base.pacienteForm.nome}`,
      patientId: base.pacienteForm.pacienteId ?? null,
      content: doc,
    });
  };

  return (
    <DocumentosLayout
      titulo="Encaminhamento"
      subtitulo="Carta de referência para especialista ou serviço"
      pacienteId={pacienteId}
      paciente={base.vinculado}
      loadingPaciente={base.loading}
      actions={
        <DocumentoActions
          onCopy={() => formatEncaminhamentoWhatsApp(doc, base.medico)}
          onSave={salvar}
          saving={base.saving}
          onSuggest={sugerir}
          suggesting={suggesting}
        />
      }
      editor={
        <>
          <PacienteHeaderForm
            value={base.pacienteForm}
            onChange={base.setPacienteForm}
            vinculado={Boolean(base.vinculado)}
          />

          <Section title="2. DESTINO E PRIORIDADE" icon={<Stethoscope className="h-4 w-4" />}>
            <div className="flex flex-wrap gap-2 mb-4">
              {ESPECIALIDADES_ENCAMINHAMENTO.map((e) => (
                <Chip
                  key={e}
                  label={e}
                  selected={form.destino === e}
                  onClick={() => set({ destino: e })}
                  testid={`doc-destino-${e.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                />
              ))}
            </div>
            {form.destino === "Outro" && (
              <ControlledInput
                value={form.destinoOutro ?? ""}
                onValueChange={(v) => set({ destinoOutro: v })}
                placeholder="NOME DO SERVIÇO / ESPECIALIDADE"
                uppercase
                className="mb-4"
              />
            )}
            <div className="flex flex-wrap gap-2">
              {PRIORIDADES_ENCAMINHAMENTO.map((p) => (
                <Chip
                  key={p.id}
                  label={`${p.label} — ${p.descricao}`}
                  selected={form.prioridade === p.id}
                  onClick={() => set({ prioridade: p.id })}
                />
              ))}
            </div>
          </Section>

          <Section title="3. CONTEÚDO CLÍNICO" icon={<FileText className="h-4 w-4" />}>
            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                  Hipóteses diagnósticas
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.hipoteses.map((h, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => set({ hipoteses: form.hipoteses.filter((_, j) => j !== i) })}
                      className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold uppercase"
                      aria-label={`Remover hipótese ${h}`}
                    >
                      {h} ×
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={hipoteseInput}
                    onChange={(e) => setHipoteseInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHipotese())}
                    placeholder="Adicionar hipótese e Enter"
                    className="flex-1 bg-secondary/40 border border-border rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                    data-testid="doc-hipotese-input"
                  />
                  <button
                    type="button"
                    onClick={addHipotese}
                    className="px-4 rounded-xl border border-border text-[10px] font-black uppercase"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
              <ControlledTextarea
                value={form.resumoClinico}
                onValueChange={(v) => set({ resumoClinico: v })}
                placeholder="Resumo clínico: história, comorbidades, medicações, exames relevantes"
                rows={4}
                className="text-sm font-semibold"
              />
              <ControlledTextarea
                value={form.justificativa}
                onValueChange={(v) => set({ justificativa: v })}
                placeholder="Motivo / justificativa do encaminhamento"
                rows={3}
                className="text-sm font-semibold"
                data-testid="doc-justificativa"
              />
              <ControlledTextarea
                value={form.solicitacao}
                onValueChange={(v) => set({ solicitacao: v })}
                placeholder="Solicitação ao serviço de destino (ex.: avaliação e seguimento ambulatorial)"
                rows={2}
                className="text-sm font-semibold"
              />
            </div>
          </Section>

          <Section title="4. EXAMES EM ANEXO" icon={<ListChecks className="h-4 w-4" />}>
            <div className="flex flex-wrap gap-2">
              {EXAMES_COMUNS.map((e) => (
                <Chip
                  key={e}
                  label={e}
                  selected={form.exames.includes(e)}
                  onClick={() =>
                    set({
                      exames: form.exames.includes(e)
                        ? form.exames.filter((x) => x !== e)
                        : [...form.exames, e],
                    })
                  }
                />
              ))}
            </div>
          </Section>

          <Section
            title="5. TEXTO FINAL"
            icon={<Sparkles className="h-4 w-4" />}
            right={
              textoManual !== null && (
                <button
                  type="button"
                  onClick={() => setTextoManual(null)}
                  className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                >
                  Voltar ao texto automático
                </button>
              )
            }
          >
            <ControlledTextarea
              value={texto}
              onValueChange={setTextoManual}
              rows={14}
              className="font-mono text-xs leading-relaxed"
              data-testid="doc-texto-final"
            />
          </Section>
        </>
      }
      preview={<EncaminhamentoA4 doc={doc} medico={base.medico} />}
    />
  );
}
