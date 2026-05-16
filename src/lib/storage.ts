export const storage = {
  // Shift ativo
  getShiftId: () => localStorage.getItem('da_shift_id'),
  setShiftId: (id: string) => localStorage.setItem('da_shift_id', id),
  clearShiftId: () => localStorage.removeItem('da_shift_id'),

  // Tipo de evolução
  getTipo: () => localStorage.getItem('da_tipo_evolucao') ?? 'enfermaria_clinica',
  setTipo: (tipo: string) => localStorage.setItem('da_tipo_evolucao', tipo),

  // Tipo de evolução por paciente (sobrescreve o global quando setado)
  getEvolTipo: (patientId: string) =>
    localStorage.getItem(`da_evol_tipo_${patientId}`),
  setEvolTipo: (patientId: string, tipo: string) =>
    localStorage.setItem(`da_evol_tipo_${patientId}`, tipo),

  // Rascunho de evolução em edição (auto-save)
  getEvolRascunho: (patientId: string): { text: string; savedAt: string } | null => {
    const raw = localStorage.getItem(`da_evol_rascunho_${patientId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  setEvolRascunho: (patientId: string, text: string) =>
    localStorage.setItem(
      `da_evol_rascunho_${patientId}`,
      JSON.stringify({ text, savedAt: new Date().toISOString() })
    ),
  clearEvolRascunho: (patientId: string) =>
    localStorage.removeItem(`da_evol_rascunho_${patientId}`),

  // Job em andamento (Railway / Safari persistence)
  getJobAtivo: () => localStorage.getItem('da_job_ativo'),
  setJobAtivo: (id: string) => localStorage.setItem('da_job_ativo', id),
  clearJobAtivo: () => localStorage.removeItem('da_job_ativo'),

  getJobArquivo: () => localStorage.getItem('da_job_arquivo') ?? 'documento',
  setJobArquivo: (nome: string) => localStorage.setItem('da_job_arquivo', nome),

  // Preferências do médico (persistem entre sessões)
  getNomeMedico: () => localStorage.getItem('da_nome_medico') ?? 'Médico',
  setNomeMedico: (nome: string) => localStorage.setItem('da_nome_medico', nome),

  getHospitalPadrao: () => localStorage.getItem('da_hospital_padrao') ?? '',
  setHospitalPadrao: (h: string) => localStorage.setItem('da_hospital_padrao', h),

  getAtbDayRule: () => localStorage.getItem('da_atb_day_rule') ?? 'D0',
  setAtbDayRule: (rule: string) => localStorage.setItem('da_atb_day_rule', rule),

  getAtbAlertDays: () => parseInt(localStorage.getItem('da_atb_alert_days') ?? '7'),
  setAtbAlertDays: (days: number) =>
    localStorage.setItem('da_atb_alert_days', String(days)),

  // CRM e Especialidade (fallbacks)
  getCRM: () => localStorage.getItem('da_crm') ?? '',
  setCRM: (crm: string) => localStorage.setItem('da_crm', crm),
  
  getEspecialidade: () => localStorage.getItem('da_especialidade') ?? '',
  setEspecialidade: (esp: string) => localStorage.setItem('da_especialidade', esp),

  // Chaves temporárias do fluxo
  getExtracaoResultado: () => localStorage.getItem('da_extracao_resultado'),
  setExtracaoResultado: (data: string) => localStorage.setItem('da_extracao_resultado', data),
  clearExtracaoResultado: () => localStorage.removeItem('da_extracao_resultado'),

  getUploadPatientId: () => localStorage.getItem('da_upload_patient_id'),
  setUploadPatientId: (id: string) => localStorage.setItem('da_upload_patient_id', id),
  clearUploadPatientId: () => localStorage.removeItem('da_upload_patient_id'),

  // Plantão Ativo (Objeto completo do shift)
  getPlantaoAtivo: () => {
    const raw = localStorage.getItem('da_plantao_ativo');
    return raw ? JSON.parse(raw) : null;
  },
  setPlantaoAtivo: (data: any) => localStorage.setItem('da_plantao_ativo', JSON.stringify(data)),

  // Fallback Local (Pacientes salvos quando offline)
  getLocalPacientes: () => {
    const raw = localStorage.getItem('da_pacientes');
    return raw ? JSON.parse(raw) : [];
  },
  setLocalPacientes: (data: any[]) => localStorage.setItem('da_pacientes', JSON.stringify(data)),

  // Merge Local
  mergeLocalPatient: (id: string, newData: any) => {
    const raw = localStorage.getItem('da_pacientes');
    const patients = raw ? JSON.parse(raw) : [];
    const index = patients.findIndex((p: any) => p.id === id);
    if (index === -1) return null;

    const existing = patients[index];
    const merged = { ...existing };

    if (newData.name) merged.name = newData.name;
    if (newData.age) merged.age = newData.age;
    if (newData.sex) merged.sex = newData.sex;
    if (newData.bed) merged.bed = newData.bed;
    if (newData.sector) merged.sector = newData.sector;
    if (newData.admission_date) merged.admission_date = newData.admission_date;
    if (newData.reason_for_admission) merged.reason_for_admission = newData.reason_for_admission;
    if (newData.hda) merged.hda = newData.hda;

    if (newData.problem_list?.length) {
      const existingTexts = new Set((existing.problem_list ?? []).map((p: any) => String(p).trim().toLowerCase()));
      const newProblems = newData.problem_list.filter((p: string) => p && !existingTexts.has(p.trim().toLowerCase()));
      merged.problem_list = [...(existing.problem_list ?? []), ...newProblems];
    }

    if (newData.antibiotics?.length) {
      const existingNames = new Set((existing.antibiotics ?? []).map((a: any) => a.nome?.trim().toLowerCase()));
      const newAtbs = newData.antibiotics.filter((a: any) => a.nome && !existingNames.has(a.nome.trim().toLowerCase()));
      merged.antibiotics = [...(existing.antibiotics ?? []), ...newAtbs];
    }

    if (newData.labs?.length) {
      const newLabs = newData.labs.filter((l: any) => l.texto_compacto);
      merged.labs = [...(existing.labs ?? []), ...newLabs];
    }

    if (newData.medications?.length) {
      const existingTexts = new Set((existing.medications ?? []).map((m: any) => String(m).trim().toLowerCase()));
      const newMeds = newData.medications.filter((m: string) => m && !existingTexts.has(m.trim().toLowerCase()));
      merged.medications = [...(existing.medications ?? []), ...newMeds];
    }

    if (newData.conducts?.length) {
      const existingTexts = new Set((existing.conducts ?? []).map((c: any) => String(c).trim().toLowerCase()));
      const newConducts = newData.conducts.filter((c: string) => c && !existingTexts.has(c.trim().toLowerCase()));
      merged.conducts = [...(existing.conducts ?? []), ...newConducts];
    }

    if (newData.pending_issues?.length) {
      const existingTexts = new Set((existing.pending_issues ?? []).map((p: any) => String(p).trim().toLowerCase()));
      const newPending = newData.pending_issues.filter((p: string) => p && !existingTexts.has(p.trim().toLowerCase()));
      merged.pending_issues = [...(existing.pending_issues ?? []), ...newPending];
    }

    if (newData.physical_exam) {
      merged.physical_exam = {
        ...(existing.physical_exam || {}),
        ...Object.fromEntries(
          Object.entries(newData.physical_exam).filter(([, v]) => v != null && v !== '')
        ),
      };
    }

    patients[index] = merged;
    localStorage.setItem('da_pacientes', JSON.stringify(patients));
    return merged;
  },

  // Limpeza de sessão (ao encerrar plantão ou sair da conta)
  clearSession: () => {
    localStorage.removeItem('da_shift_id');
    localStorage.removeItem('da_tipo_evolucao');
    localStorage.removeItem('da_extracao_resultado');
    localStorage.removeItem('da_job_ativo');
    localStorage.removeItem('da_job_arquivo');
    localStorage.removeItem('da_upload_patient_id');
    localStorage.removeItem('da_paciente_atual_id');
    localStorage.removeItem('da_plantao_ativo');
    localStorage.removeItem('da_pacientes');
    localStorage.removeItem('da_paciente_atual');
    localStorage.removeItem('da_evolucoes');
    localStorage.removeItem('da_prescricoes');
    localStorage.removeItem('da_encaminhamentos');
    localStorage.removeItem('da_passagens');
  }
};
