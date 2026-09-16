import type { EncaminhamentoDocumento, MedicoDocumento } from "@/lib/documentos/types";
import { DocumentoA4 } from "./DocumentoA4";

export function EncaminhamentoA4({
  doc,
  medico,
}: {
  doc: EncaminhamentoDocumento;
  medico: MedicoDocumento;
}) {
  const blocos = doc.texto.split(/\n(?=[A-ZÇÃÕÉÍÓÚÂÊÔ ]{6,}\n)/);
  return (
    <DocumentoA4
      medico={medico}
      paciente={doc.paciente}
      titulo="Encaminhamento"
      data={doc.data}
      testid="doc-preview-encaminhamento"
    >
      {!doc.texto.trim() ? (
        <p className="text-[10pt] italic text-black/50 py-6 text-center">
          Preencha o formulário para gerar o texto do encaminhamento.
        </p>
      ) : (
        <div className="space-y-3 text-[10.5pt] leading-relaxed">
          {blocos.map((bloco, i) => {
            const [primeira, ...resto] = bloco.split("\n");
            const isTitulo = /^[A-ZÇÃÕÉÍÓÚÂÊÔ ]{6,}$/.test(primeira.trim());
            return (
              <div key={i} className="a4-row">
                {isTitulo ? (
                  <div className="text-[9pt] font-black uppercase tracking-widest border-b border-black/30 mb-1">
                    {primeira}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{primeira}</p>
                )}
                {resto.length > 0 && <p className="whitespace-pre-wrap">{resto.join("\n")}</p>}
              </div>
            );
          })}
        </div>
      )}
    </DocumentoA4>
  );
}
