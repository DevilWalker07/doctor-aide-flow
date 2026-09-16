import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, FileSignature, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AtestadoA4 } from "@/components/documentos/AtestadoA4";
import { DocumentoActions } from "@/components/documentos/DocumentoActions";
import { DocumentosLayout } from "@/components/documentos/DocumentosLayout";
import { PacienteHeaderForm } from "@/components/documentos/PacienteHeaderForm";
import { Chip, Section } from "@/components/documentos/Section";
import { ControlledInput, ControlledTextarea } from "@/components/ui/controlled-input";
import { corpoAtestado, FINALIDADES, tituloAtestado, cidVisivel } from "@/lib/documentos/atestado";
import type { AtestadoDocumento, FinalidadeAtestado } from "@/lib/documentos/types";
import { useDocumentoBase } from "@/lib/documentos/useDocumentoBase";

export const Route = createFileRoute("/atestado")({
  component: AtestadoPage,
  validateSearch: z.object({ paciente: z.string().optional() }),
  head: () => ({ meta: [{ title: "Atestado médico — MEDFLUXO" }] }),
});

function hojeBR() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function AtestadoPage() {
  const { paciente: pacienteId } = Route.useSearch();
  const base = useDocumentoBase(pacienteId);

  const [finalidade, setFinalidade] = useState<FinalidadeAtestado>("afastamento");
  const [dias, setDias] = useState("1");
  const [dataInicio, setDataInicio] = useState(hojeBR);
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [acompanhado, setAcompanhado] = useState("");
  const [cid, setCid] = useState("");
  const [cidAutorizado, setCidAutorizado] = useState(false);
  const [observacoes, setObservacoes] = useState("");

  const doc: AtestadoDocumento = {
    paciente: base.pacienteForm,
    finalidade,
    dias,
    dataInicio,
    horaInicio,
    horaFim,
    acompanhado,
    cid,
    cidAutorizado,
    observacoes,
    data: base.data,
  };

  const corpo = corpoAtestado(doc);

  const salvar = async () => {
    if (!base.pacienteForm.nome.trim()) {
      toast.error("Informe o nome do paciente.");
      return;
    }
    if (!corpo) {
      toast.error("Preencha os dados da finalidade escolhida.");
      return;
    }
    await base.salvar({
      type: "atestado",
      title: tituloAtestado(doc),
      patientId: base.pacienteForm.pacienteId ?? null,
      content: doc,
    });
  };

  const textoLimpo = () => {
    if (!corpo) return "";
    const medico = base.medico;
    return [
      "ATESTADO MÉDICO",
      "",
      corpo,
      "",
      `${base.data}`,
      [medico.nome, medico.crm ? `CRM ${medico.crm}` : ""].filter(Boolean).join(" — "),
    ].join("\n");
  };

  return (
    <DocumentosLayout
      titulo="Atestado médico"
      subtitulo={pacienteId ? "Vinculado ao paciente" : "Atestado avulso"}
      pacienteId={pacienteId}
      paciente={base.vinculado}
      loadingPaciente={base.loading}
      actions={<DocumentoActions onCopy={textoLimpo} onSave={salvar} saving={base.saving} />}
      editor={
        <>
          <PacienteHeaderForm
            value={base.pacienteForm}
            onChange={base.setPacienteForm}
            vinculado={Boolean(base.vinculado)}
          />

          <Section title="Finalidade" icon={<FileSignature className="h-4 w-4" />}>
            <div className="flex flex-wrap gap-2">
              {FINALIDADES.map((f) => (
                <Chip
                  key={f.id}
                  label={f.label}
                  selected={finalidade === f.id}
                  onClick={() => setFinalidade(f.id)}
                  testid={`atestado-finalidade-${f.id}`}
                />
              ))}
            </div>
            <p className="t-body text-muted-foreground mt-3">
              {FINALIDADES.find((f) => f.id === finalidade)?.descricao}
            </p>
          </Section>

          <Section title="Período" icon={<CalendarDays className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {finalidade === "afastamento" && (
                <div>
                  <label htmlFor="atestado-dias" className="t-label text-muted-foreground">
                    Dias de afastamento
                  </label>
                  <ControlledInput
                    id="atestado-dias"
                    type="number"
                    min={1}
                    value={dias}
                    onValueChange={setDias}
                    data-testid="atestado-dias"
                    className="mt-1.5"
                  />
                </div>
              )}

              {finalidade !== "atividade-fisica" && (
                <div>
                  <label htmlFor="atestado-data" className="t-label text-muted-foreground">
                    {finalidade === "afastamento" ? "A contar de" : "Data do comparecimento"}
                  </label>
                  <ControlledInput
                    id="atestado-data"
                    value={dataInicio}
                    onValueChange={setDataInicio}
                    placeholder="dd/mm/aaaa"
                    data-testid="atestado-data"
                    className="mt-1.5"
                  />
                </div>
              )}

              {finalidade === "comparecimento" && (
                <>
                  <div>
                    <label htmlFor="atestado-hora-inicio" className="t-label text-muted-foreground">
                      Das
                    </label>
                    <ControlledInput
                      id="atestado-hora-inicio"
                      value={horaInicio}
                      onValueChange={setHoraInicio}
                      placeholder="08:00"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <label htmlFor="atestado-hora-fim" className="t-label text-muted-foreground">
                      Às
                    </label>
                    <ControlledInput
                      id="atestado-hora-fim"
                      value={horaFim}
                      onValueChange={setHoraFim}
                      placeholder="10:00"
                      className="mt-1.5"
                    />
                  </div>
                </>
              )}

              {finalidade === "acompanhante" && (
                <div className="sm:col-span-2">
                  <label htmlFor="atestado-acompanhado" className="t-label text-muted-foreground">
                    Nome de quem foi acompanhado
                  </label>
                  <ControlledInput
                    id="atestado-acompanhado"
                    value={acompanhado}
                    onValueChange={setAcompanhado}
                    data-testid="atestado-acompanhado"
                    className="mt-1.5"
                  />
                </div>
              )}
            </div>
          </Section>

          <Section title="CID e observações" icon={<ShieldCheck className="h-4 w-4" />}>
            {/* O CID em atestado exige autorização do paciente (art. 73 do
                Código de Ética Médica). Por isso o campo nasce desligado e o
                valor só chega ao documento por cidVisivel(). */}
            <label className="border-border bg-secondary flex cursor-pointer items-start gap-3 rounded-2xl border p-4">
              <input
                type="checkbox"
                checked={cidAutorizado}
                onChange={(e) => setCidAutorizado(e.target.checked)}
                data-testid="atestado-cid-autorizado"
                className="accent-primary mt-0.5 h-5 w-5 shrink-0"
              />
              <span>
                <span className="t-title text-foreground block">
                  O paciente autorizou informar o CID
                </span>
                <span className="t-body text-muted-foreground">
                  Sem esta autorização o diagnóstico não entra no atestado — nem na prévia, nem na
                  impressão.
                </span>
              </span>
            </label>

            {cidAutorizado && (
              <div className="mt-4">
                <label htmlFor="atestado-cid" className="t-label text-muted-foreground">
                  CID-10
                </label>
                <ControlledInput
                  id="atestado-cid"
                  value={cid}
                  onValueChange={setCid}
                  placeholder="Ex.: J18.9"
                  uppercase
                  data-testid="atestado-cid"
                  className="mt-1.5"
                />
              </div>
            )}

            <div className="mt-4">
              <label htmlFor="atestado-obs" className="t-label text-muted-foreground">
                Observações (opcional)
              </label>
              <ControlledTextarea
                id="atestado-obs"
                value={observacoes}
                onValueChange={setObservacoes}
                rows={3}
                placeholder="Ex.: Retorno para reavaliação em 7 dias."
                data-testid="atestado-obs"
                className="mt-1.5"
              />
            </div>

            {cidAutorizado && !cidVisivel(doc) && (
              <p className="t-body text-muted-foreground mt-3">
                Preencha o CID ou desmarque a autorização.
              </p>
            )}
          </Section>
        </>
      }
      preview={<AtestadoA4 doc={doc} medico={base.medico} />}
    />
  );
}
