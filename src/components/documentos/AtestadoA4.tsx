import { corpoAtestado } from "@/lib/documentos/atestado";
import type { AtestadoDocumento, MedicoDocumento } from "@/lib/documentos/types";
import { DocumentoA4 } from "./DocumentoA4";

export function AtestadoA4({ doc, medico }: { doc: AtestadoDocumento; medico: MedicoDocumento }) {
  const corpo = corpoAtestado(doc);

  return (
    <DocumentoA4
      medico={medico}
      paciente={doc.paciente}
      titulo="Atestado médico"
      data={doc.data}
      testid="doc-preview-atestado"
    >
      {!corpo ? (
        <p className="py-6 text-center text-[10pt] text-black/50 italic">
          Preencha o nome do paciente e os dados da finalidade para gerar o atestado.
        </p>
      ) : (
        <div className="space-y-4 text-[11pt] leading-loose">
          {corpo.split("\n\n").map((paragrafo, i) => (
            <p key={i} className="a4-row text-justify whitespace-pre-wrap">
              {paragrafo}
            </p>
          ))}
        </div>
      )}
    </DocumentoA4>
  );
}
