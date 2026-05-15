export const storage = {
  // Shift ativo
  getShiftId: () => localStorage.getItem('da_shift_id'),
  setShiftId: (id: string) => localStorage.setItem('da_shift_id', id),
  clearShiftId: () => localStorage.removeItem('da_shift_id'),

  // Tipo de evolução
  getTipo: () => localStorage.getItem('da_tipo_evolucao') ?? 'enfermaria_clinica',
  setTipo: (tipo: string) => localStorage.setItem('da_tipo_evolucao', tipo),

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
