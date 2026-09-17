import { horariosAtivos, unidadeLabel } from "@/lib/documentos/formatters";
import type { MedicoDocumento, ReceitaDocumento } from "@/lib/documentos/types";
import { DocumentoA4 } from "./DocumentoA4";

export function ReceitaA4({ doc, medico }: { doc: ReceitaDocumento; medico: MedicoDocumento }) {
  const temFP = doc.itens.some((i) => i.farmaciaPopular);
  const temControlado = doc.itens.some((i) => i.controlado);

  return (
    <DocumentoA4
      medico={medico}
      paciente={doc.paciente}
      titulo="Receituário"
      data={doc.data}
      testid="doc-preview-receita"
      rodapeExtra={doc.vias === 2 ? <div className="text-black/70">2ª via</div> : null}
    >
      {doc.itens.length === 0 && (
        <p className="text-[10pt] italic text-black/50 py-6 text-center">
          Adicione medicamentos para montar a receita.
        </p>
      )}

      <ol className="space-y-2.5">
        {doc.itens.map((item, i) => {
          const ativos = horariosAtivos(item.horarios);
          return (
            <li
              key={item.id}
              className="a4-row break-inside-avoid"
              data-testid={`doc-preview-item-${i}`}
            >
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[10.5pt] font-black">{i + 1})</span>
                <span className="text-[11pt] font-black">
                  {item.nome}
                  {item.dose && ` ${item.dose}`}
                </span>
                {item.apresentacao && (
                  <span className="text-[9pt] text-black/60">{item.apresentacao}</span>
                )}
                <span className="mx-1 text-black/40">——</span>
                <span className="text-[10pt] font-semibold whitespace-nowrap">
                  {item.quantidade}
                </span>
                {item.farmaciaPopular && (
                  <span className="rounded border border-black/50 px-1 text-[7.5pt] font-black tracking-wide uppercase">
                    Farmácia Popular
                  </span>
                )}
                {item.controlado && (
                  <span className="rounded border border-black/50 px-1 text-[7.5pt] font-black tracking-wide uppercase">
                    Receita {item.controlado}
                  </span>
                )}
              </div>

              <p className="mt-0.5 pl-4 text-[10pt] leading-snug">
                {item.instrucao}
                {ativos.length > 0 && (
                  <span className="text-black/70">
                    {" "}
                    ({ativos.map((h) => `${h.label}: ${unidadeLabel(item.acao, h.n)}`).join(" · ")})
                  </span>
                )}
              </p>
              {(item.duracao || item.observacao) && (
                <p className="pl-4 text-[9pt] text-black/70">
                  {[item.duracao, item.observacao].filter(Boolean).join(" · ")}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {doc.observacoes.trim() && (
        <div className="a4-row mt-4 text-[10pt] border-l-4 border-black/60 pl-3">
          <div className="text-[8.5pt] font-black uppercase tracking-wide text-black/60">
            Observações
          </div>
          <p className="whitespace-pre-wrap">{doc.observacoes}</p>
        </div>
      )}

      {(temFP || temControlado) && (
        <p className="mt-4 text-[8pt] text-black/60">
          {temFP &&
            "Itens marcados como Farmácia Popular podem ser retirados gratuitamente nas farmácias credenciadas, apresentando esta receita, documento com foto e CPF. "}
          {temControlado &&
            "Medicamentos controlados exigem receituário específico (retenção na farmácia)."}
        </p>
      )}
    </DocumentoA4>
  );
}
