import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getMedicoDocumento } from "./medico";
import { saveOutpatientDocument } from "./persist";
import type { OutpatientDocument, PacienteDocumento } from "./types";
import { usePacienteVinculado } from "./usePacienteVinculado";

const PACIENTE_VAZIO: PacienteDocumento = { pacienteId: null, nome: "", idade: "", sexo: "", documento: "", leito: "" };

export function useDocumentoBase(pacienteId: string | undefined) {
  const { paciente: vinculado, loading, erro, userId } = usePacienteVinculado(pacienteId);
  const [pacienteForm, setPacienteForm] = useState<PacienteDocumento>(PACIENTE_VAZIO);
  const [saving, setSaving] = useState(false);
  const medico = useMemo(() => getMedicoDocumento(), []);
  const data = useMemo(() => format(new Date(), "dd/MM/yyyy"), []);

  useEffect(() => {
    if (vinculado) {
      setPacienteForm({ pacienteId: vinculado.pacienteId, nome: vinculado.nome, idade: vinculado.idade, sexo: vinculado.sexo, documento: "", leito: vinculado.leito });
    }
  }, [vinculado]);

  useEffect(() => {
    if (erro) toast.warning(erro);
  }, [erro]);

  const salvar = async (doc: OutpatientDocument) => {
    setSaving(true);
    try {
      const result = await saveOutpatientDocument(doc, userId);
      if (result.origem === "supabase") toast.success("Documento salvo no banco.");
      else toast.info(result.erro ? `Salvo apenas neste dispositivo (banco indisponível: ${result.erro}).` : "Salvo apenas neste dispositivo.");
    } finally {
      setSaving(false);
    }
  };

  return { vinculado, loading, userId, pacienteForm, setPacienteForm, medico, data, saving, salvar };
}
