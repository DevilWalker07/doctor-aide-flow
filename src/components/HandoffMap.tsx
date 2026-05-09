import { usePatients } from "@/lib/store";
import { patientToClinicalPatient } from "@/lib/clinical/adapters";
import { generateHandoffRows } from "@/lib/clinical/generateHandoff";

export function HandoffMap() {
  const { patients } = usePatients();
  const today = new Date().toISOString().slice(0, 10);
  const rows = generateHandoffRows(patients.map((p) => patientToClinicalPatient(p, today)));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">MAPA DE PASSAGEM DE PLANTÃO</h2>
        <p className="text-sm text-muted-foreground mt-1">Resumo dos pacientes ativos do plantão.</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-secondary/70">
            <tr>
              <th className="p-3 text-left border-b border-border">PACIENTE</th>
              <th className="p-3 text-left border-b border-border">LISTA DE PROBLEMAS</th>
              <th className="p-3 text-left border-b border-border">MEDICAÇÕES EM USO</th>
              <th className="p-3 text-left border-b border-border">MOTIVO DA ADMISSÃO</th>
              <th className="p-3 text-left border-b border-border">PENDÊNCIAS E CONDUTAS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.patient} className="align-top">
                <td className="p-3 border-b border-border font-bold">{row.patient}<br /><span className="text-[10px] text-muted-foreground">{row.priority}</span></td>
                <td className="p-3 border-b border-border leading-relaxed">{row.problemList}</td>
                <td className="p-3 border-b border-border leading-relaxed">{row.medications}</td>
                <td className="p-3 border-b border-border leading-relaxed">{row.admissionReason}</td>
                <td className="p-3 border-b border-border leading-relaxed">{row.pendingAndWhatToEvaluate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">Revise antes de copiar, imprimir ou usar no prontuário.</p>
    </div>
  );
}
