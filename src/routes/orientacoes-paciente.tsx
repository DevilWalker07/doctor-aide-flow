import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, ClipboardList, PlusCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ControlledInput } from "@/components/ui/controlled-input";
import { DocumentoActions } from "@/components/documentos/DocumentoActions";
import { DocumentosLayout } from "@/components/documentos/DocumentosLayout";
import { OrientacoesA4 } from "@/components/documentos/OrientacoesA4";
import { PacienteHeaderForm } from "@/components/documentos/PacienteHeaderForm";
import { Chip, Section } from "@/components/documentos/Section";
import { formatOrientacoesWhatsApp } from "@/lib/documentos/formatters";
import type { OrientacoesDocumento } from "@/lib/documentos/types";
import { useDocumentoBase } from "@/lib/documentos/useDocumentoBase";
import { CATEGORIAS_ORIENTACAO, ORIENTACOES } from "@/lib/medical/orientacoes";

export const Route = createFileRoute("/orientacoes-paciente")({
  component: OrientacoesPage,
  validateSearch: z.object({ paciente: z.string().optional() }),
  head: () => ({ meta: [{ title: "Orientações ao Paciente — DOUTOR AJUDA" }] }),
});

function OrientacoesPage() {
  const { paciente: pacienteId } = Route.useSearch();
  const base = useDocumentoBase(pacienteId);
  const [ids, setIds] = useState<string[]>([]);
  const [extras, setExtras] = useState<string[]>([]);
  const [extraInput, setExtraInput] = useState("");
  const [retorno, setRetorno] = useState("");

  const doc: OrientacoesDocumento = { paciente: base.pacienteForm, orientacaoIds: ids, extras, retorno, data: base.data };

  const toggle = (id: string) => setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const addExtra = () => {
    const v = extraInput.trim();
    if (!v) return;
    setExtras((prev) => [...prev, v]);
    setExtraInput("");
  };

  const salvar = async () => {
    if (!base.pacienteForm.nome.trim()) {
      toast.error("Informe o nome do paciente.");
      return;
    }
    if (ids.length === 0 && extras.length === 0) {
      toast.error("Selecione ao menos um tema.");
      return;
    }
    await base.salvar({ type: "orientacoes", title: `Orientações — ${base.pacienteForm.nome}`, patientId: base.pacienteForm.pacienteId ?? null, content: doc });
  };

  return (
    <DocumentosLayout
      titulo="Orientações ao paciente"
      subtitulo="Linguagem simples · sinais de alerta · retorno"
      pacienteId={pacienteId}
      paciente={base.vinculado}
      loadingPaciente={base.loading}
      actions={<DocumentoActions onCopy={() => formatOrientacoesWhatsApp(doc, base.medico)} onSave={salvar} saving={base.saving} />}
      editor={
        <>
          <PacienteHeaderForm value={base.pacienteForm} onChange={base.setPacienteForm} vinculado={Boolean(base.vinculado)} />

          <Section title="2. TEMAS" icon={<ClipboardList className="h-4 w-4" />}>
            <div className="space-y-5">
              {CATEGORIAS_ORIENTACAO.map((cat) => {
                const lista = ORIENTACOES.filter((o) => o.categoria === cat);
                if (!lista.length) return null;
                return (
                  <div key={cat}>
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">{cat}</div>
                    <div className="flex flex-wrap gap-2">
                      {lista.map((o) => (
                        <Chip key={o.id} label={o.titulo} selected={ids.includes(o.id)} onClick={() => toggle(o.id)} testid={`doc-orientacao-${o.id}`} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="3. ORIENTAÇÕES ADICIONAIS" icon={<PlusCircle className="h-4 w-4" />}>
            <div className="space-y-2 mb-3">
              {extras.map((e, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="flex-1 text-sm font-semibold bg-secondary/40 rounded-xl px-4 py-3">{e}</span>
                  <button type="button" onClick={() => setExtras((prev) => prev.filter((_, j) => j !== i))} aria-label="Remover orientação" className="p-3 rounded-xl bg-destructive/10 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={extraInput} onChange={(e) => setExtraInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addExtra())} placeholder="Escreva uma orientação em linguagem simples e pressione Enter" className="flex-1 bg-secondary/40 border border-border rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40" data-testid="doc-extra-input" />
              <button type="button" onClick={addExtra} className="px-4 rounded-xl border border-border text-[10px] font-black uppercase">Adicionar</button>
            </div>
          </Section>

          <Section title="4. RETORNO" icon={<CalendarClock className="h-4 w-4" />}>
            <ControlledInput value={retorno} onValueChange={setRetorno} placeholder="Ex.: UBS em 7 dias com os exames; ambulatório de cardiologia em 30 dias" />
          </Section>
        </>
      }
      preview={<OrientacoesA4 doc={doc} medico={base.medico} />}
    />
  );
}
