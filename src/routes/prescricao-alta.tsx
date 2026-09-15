import { createFileRoute } from "@tanstack/react-router";
import { Pill, StickyNote } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ControlledTextarea } from "@/components/ui/controlled-input";
import { DocumentoActions } from "@/components/documentos/DocumentoActions";
import { DocumentosLayout } from "@/components/documentos/DocumentosLayout";
import { MedicamentoCard } from "@/components/documentos/MedicamentoCard";
import { MedicamentoPicker } from "@/components/documentos/MedicamentoPicker";
import { PacienteHeaderForm } from "@/components/documentos/PacienteHeaderForm";
import { ReceitaA4 } from "@/components/documentos/ReceitaA4";
import { Chip, Section } from "@/components/documentos/Section";
import { apiJson } from "@/lib/apiClient";
import { formatReceitaWhatsApp } from "@/lib/documentos/formatters";
import type { ReceitaDocumento, ReceitaItem } from "@/lib/documentos/types";
import { useDocumentoBase } from "@/lib/documentos/useDocumentoBase";
import { getMedicamento, MEDICAMENTOS, type Horario, type Medicamento } from "@/lib/medical/medicamentos";

export const Route = createFileRoute("/prescricao-alta")({
  component: PrescricaoAltaPage,
  validateSearch: z.object({ paciente: z.string().optional() }),
  head: () => ({ meta: [{ title: "Receita de Alta — DOUTOR AJUDA" }] }),
});

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

function itemFromMedicamento(m: Medicamento, presetId?: string): ReceitaItem {
  const preset = m.presets.find((p) => p.id === presetId) ?? m.presets[0];
  return {
    id: newId(),
    medicamentoId: m.id,
    nome: m.nome,
    apresentacao: m.apresentacao,
    dose: preset?.dose ?? "",
    quantidade: preset?.quantidade ?? "",
    horarios: { ...(preset?.horarios ?? {}) },
    instrucao: preset?.instrucao ?? "",
    duracao: preset?.duracao ?? "",
    observacao: preset?.observacao ?? "",
    acao: m.acao,
    farmaciaPopular: m.farmaciaPopular,
    controlado: m.controlado ?? null,
  };
}

function itemManual(): ReceitaItem {
  return { id: newId(), medicamentoId: null, nome: "", apresentacao: "", dose: "", quantidade: "", horarios: {}, instrucao: "", duracao: "Uso contínuo", observacao: "", acao: "comprimido", farmaciaPopular: false, controlado: null };
}

interface SugestaoItem {
  medicamentoId: string | null;
  nome: string;
  apresentacao: string;
  dose: string;
  quantidade: string;
  horarios: Partial<Record<Horario, number>>;
  instrucao: string;
  duracao: string | null;
  justificativa: string;
}

function PrescricaoAltaPage() {
  const { paciente: pacienteId } = Route.useSearch();
  const base = useDocumentoBase(pacienteId);
  const [itens, setItens] = useState<ReceitaItem[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [vias, setVias] = useState<1 | 2>(1);
  const [suggesting, setSuggesting] = useState(false);

  const doc: ReceitaDocumento = { paciente: base.pacienteForm, itens, observacoes, vias, data: base.data };

  const addMed = (m: Medicamento) => {
    setItens((prev) => [...prev, itemFromMedicamento(m)]);
    toast.success(`${m.nome} adicionado.`);
  };

  const updateItem = (id: string, next: ReceitaItem) => setItens((prev) => prev.map((i) => (i.id === id ? next : i)));
  const removeItem = (id: string) => setItens((prev) => prev.filter((i) => i.id !== id));

  const sugerir = async () => {
    if (!base.vinculado) return;
    setSuggesting(true);
    try {
      const res = await apiJson<{ itens: SugestaoItem[]; observacoes: string[] }>("/api/ai/sugerir-receita", {
        patient: base.vinculado.raw,
        itensAtuais: itens.map((i) => ({ nome: i.nome, dose: i.dose })),
        catalogo: MEDICAMENTOS.map((m) => ({ id: m.id, nome: m.nome, apresentacao: m.apresentacao })),
      });
      const novos = res.itens
        .filter((s) => !itens.some((i) => i.nome.toLowerCase() === s.nome.toLowerCase()))
        .map((s): ReceitaItem => {
          const med = s.medicamentoId ? getMedicamento(s.medicamentoId) : undefined;
          const baseItem = med ? itemFromMedicamento(med) : itemManual();
          return {
            ...baseItem,
            nome: s.nome || baseItem.nome,
            apresentacao: s.apresentacao || baseItem.apresentacao,
            dose: s.dose || baseItem.dose,
            quantidade: s.quantidade || baseItem.quantidade,
            horarios: Object.keys(s.horarios).length ? s.horarios : baseItem.horarios,
            instrucao: s.instrucao || baseItem.instrucao,
            duracao: s.duracao || baseItem.duracao,
            observacao: s.justificativa ? `IA: ${s.justificativa}` : baseItem.observacao,
          };
        });
      setItens((prev) => [...prev, ...novos]);
      if (res.observacoes.length) setObservacoes((prev) => [prev, ...res.observacoes].filter(Boolean).join("\n"));
      toast.success(novos.length ? `${novos.length} item(ns) sugerido(s) — revise antes de imprimir.` : "A IA não sugeriu itens novos.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao sugerir com IA.");
    } finally {
      setSuggesting(false);
    }
  };

  const salvar = async () => {
    if (!base.pacienteForm.nome.trim()) {
      toast.error("Informe o nome do paciente.");
      return;
    }
    if (itens.length === 0) {
      toast.error("Adicione ao menos um medicamento.");
      return;
    }
    await base.salvar({ type: "receita", title: `Receita — ${base.pacienteForm.nome}`, patientId: base.pacienteForm.pacienteId ?? null, content: doc });
  };

  return (
    <DocumentosLayout
      titulo="Receita de alta"
      subtitulo="Receituário para casa · modelo ilustrado"
      pacienteId={pacienteId}
      paciente={base.vinculado}
      loadingPaciente={base.loading}
      actions={
        <DocumentoActions
          onCopy={() => formatReceitaWhatsApp(doc, base.medico)}
          onSave={salvar}
          saving={base.saving}
          onSuggest={sugerir}
          suggesting={suggesting}
          suggestDisabledReason={base.vinculado ? undefined : "Disponível apenas com paciente vinculado ao cadastro."}
        />
      }
      editor={
        <>
          <PacienteHeaderForm value={base.pacienteForm} onChange={base.setPacienteForm} vinculado={Boolean(base.vinculado)} />
          <MedicamentoPicker onAdd={addMed} onAddManual={() => setItens((prev) => [...prev, itemManual()])} />

          <Section title={`3. ITENS DA RECEITA (${itens.length})`} icon={<Pill className="h-4 w-4" />} className="p-0 bg-transparent border-0 shadow-none space-y-4">
            {itens.length === 0 && <p className="text-xs font-bold text-muted-foreground uppercase text-center py-6 bg-white border border-dashed border-border rounded-[2rem]">Nenhum medicamento ainda. Busque acima ou use "Sugerir com IA".</p>}
            {itens.map((item, i) => (
              <MedicamentoCard key={item.id} item={item} index={i} onChange={(next) => updateItem(item.id, next)} onRemove={() => removeItem(item.id)} />
            ))}
          </Section>

          <Section title="4. OBSERVAÇÕES E VIAS" icon={<StickyNote className="h-4 w-4" />}>
            <ControlledTextarea value={observacoes} onValueChange={setObservacoes} placeholder="Observações gerais (ex.: retorno em 7 dias, trazer exames...)" rows={3} className="text-sm font-semibold mb-4" />
            <div className="flex gap-2">
              <Chip label="1 via" selected={vias === 1} onClick={() => setVias(1)} />
              <Chip label="2 vias" selected={vias === 2} onClick={() => setVias(2)} />
            </div>
          </Section>
        </>
      }
      preview={<ReceitaA4 doc={doc} medico={base.medico} />}
    />
  );
}
