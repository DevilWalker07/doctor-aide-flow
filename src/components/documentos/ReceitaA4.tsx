import { horariosAtivos, unidadeLabel } from "@/lib/documentos/formatters";
import type { MedicoDocumento, ReceitaDocumento } from "@/lib/documentos/types";
import { HORARIOS } from "@/lib/medical/medicamentos";
import { AcaoIcon } from "./AcaoIcon";
import { DocumentoA4 } from "./DocumentoA4";
import { HorarioIcon } from "./HorarioIcon";

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

      <ol className="space-y-3">
        {doc.itens.map((item, i) => {
          const ativos = horariosAtivos(item.horarios);
          return (
            <li
              key={item.id}
              className="a4-row border border-black/40 rounded-md p-3 break-inside-avoid"
              data-testid={`doc-preview-item-${i}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 w-14 shrink-0">
                  <AcaoIcon acao={item.acao} className="h-11 w-11" />
                  <span className="text-[7.5pt] font-black">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[12pt] font-black uppercase">{item.nome}</span>
                    <span className="text-[10pt] font-semibold">{item.dose}</span>
                    <span className="text-[9.5pt] text-black/70">{item.apresentacao}</span>
                    <span className="ml-auto text-[9.5pt] font-bold whitespace-nowrap">
                      {item.quantidade}
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-1 mt-2" aria-label="Horários">
                    {HORARIOS.map((h) => {
                      const n = item.horarios[h.id] ?? 0;
                      return (
                        <div
                          key={h.id}
                          className={`flex flex-col items-center rounded border py-1 ${n > 0 ? "border-black bg-black/[0.06]" : "border-black/15 text-black/30"}`}
                        >
                          <HorarioIcon horario={h.id} size="md" />
                          <span className="text-[7pt] font-black uppercase tracking-wide">
                            {h.curto}
                          </span>
                          <span className="text-[11pt] font-black leading-none mt-0.5">
                            {n > 0 ? n : "–"}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[10.5pt] font-semibold mt-2 leading-snug">{item.instrucao}</p>
                  {ativos.length > 0 && (
                    <p className="text-[8.5pt] text-black/70 mt-0.5">
                      {ativos.map((h) => `${h.label}: ${unidadeLabel(item.acao, h.n)}`).join(" · ")}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[8.5pt] mt-1">
                    {item.duracao && <span className="font-bold">⏳ {item.duracao}</span>}
                    {item.observacao && <span>ℹ {item.observacao}</span>}
                    {item.farmaciaPopular && (
                      <span className="font-black uppercase tracking-wide border border-black/50 rounded px-1">
                        Farmácia Popular
                      </span>
                    )}
                    {item.controlado && (
                      <span className="font-black uppercase tracking-wide border border-black/50 rounded px-1">
                        Receita {item.controlado}
                      </span>
                    )}
                  </div>
                </div>
              </div>
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
