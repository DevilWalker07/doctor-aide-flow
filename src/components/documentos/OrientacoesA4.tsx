import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { MedicoDocumento, OrientacoesDocumento } from "@/lib/documentos/types";
import { getOrientacao } from "@/lib/medical/orientacoes";
import { DocumentoA4 } from "./DocumentoA4";

export function OrientacoesA4({
  doc,
  medico,
}: {
  doc: OrientacoesDocumento;
  medico: MedicoDocumento;
}) {
  const orientacoes = doc.orientacaoIds
    .map(getOrientacao)
    .filter((o): o is NonNullable<typeof o> => Boolean(o));
  const vazio = orientacoes.length === 0 && doc.extras.length === 0;

  return (
    <DocumentoA4
      medico={medico}
      paciente={doc.paciente}
      titulo="Orientações ao paciente"
      data={doc.data}
      testid="doc-preview-orientacoes"
    >
      {vazio && (
        <p className="text-[10pt] italic text-black/50 py-6 text-center">
          Selecione temas ou escreva orientações para montar o documento.
        </p>
      )}

      <div className="space-y-4">
        {orientacoes.map((o) => (
          <section key={o.id} className="a4-row">
            <h3 className="text-[11pt] font-black uppercase tracking-wide border-b border-black/30 mb-2">
              {o.titulo}
            </h3>
            <ul className="space-y-1.5 text-[10.5pt] leading-snug">
              {o.itens.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {o.sinaisAlerta.length > 0 && (
              <div className="mt-2 border-2 border-black rounded p-2 bg-black/[0.04]">
                <div className="flex items-center gap-1.5 text-[9pt] font-black uppercase tracking-wide mb-1">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Procure atendimento se
                </div>
                <ul className="space-y-1 text-[10pt] leading-snug">
                  {o.sinaisAlerta.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden="true">▶</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}

        {doc.extras.length > 0 && (
          <section className="a4-row">
            <h3 className="text-[11pt] font-black uppercase tracking-wide border-b border-black/30 mb-2">
              Outras orientações
            </h3>
            <ul className="space-y-1.5 text-[10.5pt] leading-snug">
              {doc.extras.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {doc.retorno.trim() && (
          <section className="a4-row border border-black/50 rounded px-3 py-2 text-[10.5pt]">
            <span className="font-black uppercase tracking-wide text-[9pt] mr-2">Retorno</span>
            {doc.retorno}
          </section>
        )}
      </div>
    </DocumentoA4>
  );
}
