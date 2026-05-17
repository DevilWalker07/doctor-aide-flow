import { useState } from "react";
import { AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  getATBsWithAlert,
  registrarReavaliacao,
  ATB_ALERT_STYLES,
  type ATBWithAlert,
  type PatientForATBAlert,
} from "@/lib/atbAlerts";

interface Props {
  patient: PatientForATBAlert;
  onChanged?: () => void;
}

export default function ATBAlertBanner({ patient, onChanged }: Props) {
  const [version, setVersion] = useState(0);
  const atbs = getATBsWithAlert(patient);
  const criticos = atbs.filter((a) => a.level !== "ok");
  if (criticos.length === 0) return null;

  const handleReavaliar = (atb: ATBWithAlert) => {
    if (!patient.id) {
      toast.error("Paciente sem ID — recarregue a página.");
      return;
    }
    registrarReavaliacao(patient.id, atb.nome);
    toast.success(`${atb.nome}: reavaliação registrada por 48h.`);
    setVersion((v) => v + 1);
    onChanged?.();
  };

  return (
    <div className="space-y-2 mb-6">
      {criticos.map((atb, i) => {
        const style = ATB_ALERT_STYLES[atb.level];
        const Icon = atb.level === "red" ? AlertCircle : AlertTriangle;
        return (
          <div key={`${atb.nome}-${i}-${version}`} className={`p-4 rounded-2xl border ${style.bg} ${style.border} flex items-center justify-between flex-wrap gap-3`}>
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Icon className={`h-5 w-5 ${style.text} shrink-0 mt-0.5`} />
              <div className="min-w-0">
                <p className={`text-xs font-black uppercase tracking-widest ${style.text}`}>
                  {atb.nome} — D{atb.dia}{atb.data_inicio && ` (início ${formatDate(atb.data_inicio)})`}
                </p>
                <p className="text-[11px] font-bold text-foreground mt-1">
                  {atb.level === "red"
                    ? "Este antibiótico está há muitos dias sem reavaliação registrada."
                    : "Este antibiótico está se aproximando do prazo de reavaliação."}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleReavaliar(atb)}
              className="px-3 py-2 rounded-lg bg-white border border-border text-[10px] font-black text-foreground uppercase tracking-widest hover:bg-secondary transition-all flex items-center gap-1 shrink-0"
            >
              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Registrar reavaliação
            </button>
          </div>
        );
      })}
    </div>
  );
}

function formatDate(iso: string): string {
  const p = iso.slice(0, 10).split("-");
  if (p.length !== 3) return iso;
  return `${p[2]}/${p[1]}/${p[0]}`;
}
