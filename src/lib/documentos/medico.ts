import { storage } from "@/lib/storage";
import type { MedicoDocumento } from "./types";

export function getMedicoDocumento(): MedicoDocumento {
  return {
    nome: storage.getNomeMedico(),
    crm: storage.getCRM(),
    especialidade: storage.getEspecialidade(),
    hospital: storage.getHospitalPadrao(),
  };
}
