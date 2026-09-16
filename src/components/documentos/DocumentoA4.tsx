import type { ReactNode } from "react";
import type { MedicoDocumento, PacienteDocumento } from "@/lib/documentos/types";

interface FrameProps {
  medico: MedicoDocumento;
  paciente: PacienteDocumento;
  titulo: string;
  data: string;
  children: ReactNode;
  rodapeExtra?: ReactNode;
  testid?: string;
}

export function DocumentoA4({
  medico,
  paciente,
  titulo,
  data,
  children,
  rodapeExtra,
  testid,
}: FrameProps) {
  const identificacao = [
    paciente.nome || "________________________",
    paciente.idade ? `${paciente.idade} anos` : null,
    paciente.sexo === "M" ? "Masculino" : paciente.sexo === "F" ? "Feminino" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="a4-doc bg-white text-black shadow-xl print:shadow-none mx-auto"
      data-testid={testid}
    >
      <header className="a4-header flex items-start justify-between border-b-2 border-black pb-3 mb-4">
        <div>
          <div className="text-[15pt] font-black uppercase tracking-tight">
            Dr(a). {medico.nome}
          </div>
          <div className="text-[10pt] font-semibold uppercase tracking-wide">
            {medico.crm ? `CRM ${medico.crm}` : "CRM ________"}
            {medico.especialidade ? ` · ${medico.especialidade}` : ""}
          </div>
          {medico.hospital && (
            <div className="text-[9pt] uppercase tracking-wide text-black/70">
              {medico.hospital}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[11pt] font-black uppercase tracking-widest">{titulo}</div>
          <div className="text-[9pt] font-semibold">{data}</div>
        </div>
      </header>

      <section className="a4-paciente text-[10.5pt] mb-4 border border-black/30 rounded px-3 py-2">
        <span className="font-black uppercase tracking-wide text-[8.5pt] text-black/60 mr-2">
          Paciente
        </span>
        <span className="font-bold uppercase">{identificacao}</span>
        {paciente.documento && (
          <span className="ml-3 text-black/70">Doc.: {paciente.documento}</span>
        )}
        {paciente.leito && <span className="ml-3 text-black/70">Origem: {paciente.leito}</span>}
      </section>

      <div className="a4-body">{children}</div>

      <footer className="a4-footer mt-8 pt-3 border-t border-black/40 text-[9pt]">
        <div className="grid grid-cols-2 gap-8 items-end">
          <div>
            <div className="border-b border-black h-10" />
            <div className="mt-1 font-bold uppercase tracking-wide">Assinatura e carimbo</div>
            <div className="text-black/70 uppercase">
              Dr(a). {medico.nome}
              {medico.crm ? ` — CRM ${medico.crm}` : ""}
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold uppercase tracking-wide">Data: {data}</div>
            {rodapeExtra}
          </div>
        </div>
      </footer>
    </div>
  );
}
