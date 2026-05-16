import { useState, useCallback } from "react";
import { toast } from "sonner";
import { consultSpecialist, saveConsultForPatient } from "@/lib/specialists/client";
import { buildClinicalContext } from "@/lib/specialists/buildClinicalContext";
import { specialistForUnit, type ConsultResponse, type SpecialistId, type UnitType } from "@/lib/specialists/types";

interface UseSpecialistConsultArgs {
  patient: any;
  evolutions?: Array<{ created_at: string; content: string }>;
  unitHint?: string | null; // "uti" / "enfermaria_clinica" etc
}

export function useSpecialistConsult({ patient, evolutions, unitHint }: UseSpecialistConsultArgs) {
  const specialist = specialistForUnit(unitHint || patient?.setor || patient?.sector);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [consult, setConsult] = useState<ConsultResponse | null>(null);

  const triggerConsult = useCallback(async (specialistOverride?: SpecialistId) => {
    if (!patient) {
      toast.error("Paciente não carregado.");
      return;
    }
    const targetId = specialistOverride || specialist.id;
    const context = buildClinicalContext(patient, { evolutions });
    setOpen(true);
    setLoading(true);
    setConsult(null);
    try {
      const unitType: UnitType = mapUnit(unitHint || patient.setor || patient.sector);
      const resp = await consultSpecialist({
        specialist_id: targetId,
        clinical_context: context,
        unit_type: unitType,
      });
      setConsult(resp);
      saveConsultForPatient(patient.id, resp, []);
      toast.success(`Parecer de ${resp.specialist} gerado.`);
    } catch (err: any) {
      toast.error(`Erro ao consultar: ${err.message}`);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, [patient, evolutions, specialist.id, unitHint]);

  const closeDrawer = useCallback(() => {
    setOpen(false);
  }, []);

  return { specialist, open, loading, consult, triggerConsult, closeDrawer, setConsult };
}

function mapUnit(raw?: string | null): UnitType {
  const v = (raw || "").toLowerCase();
  if (v.includes("uti")) return "uti";
  if (v.includes("pedi")) return "enfermaria_pediatrica";
  if (v.includes("upa") || v.includes("emerg")) return "upa";
  if (v.includes("ubs") || v.includes("ambul")) return "ubs";
  return "enfermaria_clinica";
}
