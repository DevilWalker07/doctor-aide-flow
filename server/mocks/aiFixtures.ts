const paciente1 = {
  leito: "L01",
  nome: "PACIENTE TESTE UM",
  idade: "72",
  sexo: "F",
  diagnosticos: "PAC",
  comorbidades: "HAS, DM2",
  dispositivos: "JELCO MSD",
  antibioticos: "CEFTRIAXONA 1G EV 12/12H - D3/7",
  laboratorio: "HB 10,1 / LEUCO 12.300 / CR 1,2 / PCR 48",
  quadro: "REG, ESTÁVEL, EUPNEICA EM AR AMBIENTE.",
  intercorrencias: "SEM INTERCORRÊNCIAS.",
  pendencias: "RX DE TÓRAX CONTROLE.",
  alertas: ["ATB EM CURSO"],
};

const paciente2 = {
  leito: "L02",
  nome: "PACIENTE TESTE DOIS",
  idade: "58",
  sexo: "M",
  diagnosticos: "ITU COMPLICADA",
  comorbidades: "DRC ESTÁGIO 3",
  dispositivos: "SVD",
  antibioticos: "CIPROFLOXACINO 400MG EV 12/12H - D2/7",
  laboratorio: "CR 2,1 / UR 96 / K 5,7 / PCR 22",
  quadro: "REG, ESTÁVEL, DIURESE PRESERVADA.",
  intercorrencias: "SEM INTERCORRÊNCIAS.",
  pendencias: "AVALIAÇÃO NEFROLOGIA.",
  alertas: ["ALERTA RENAL", "HIPERCALEMIA"],
};

export const aiFixtures = {
  clinicaMedica: { patients: [paciente1, paciente2], globalAlerts: ["MODO MOCK (AI_MOCK=1)"] },
  orquestrador: {
    agent: "clinica-medica",
    patients: [paciente1, paciente2],
    globalAlerts: ["MODO MOCK (AI_MOCK=1)"],
    raw: { source: "mock" },
  },
  documentExtraction: {
    nome: "PACIENTE TESTE E2E",
    idade: 64,
    sexo: "F",
    leito: "L99",
    setor: "CLÍNICA MÉDICA",
    data_admissao: "2026-09-10",
    hda: "PACIENTE ADMITIDA COM QUADRO DE PNEUMONIA ADQUIRIDA NA COMUNIDADE.",
    lista_de_problemas: ["PAC", "HAS"],
    antibioticos: ["CEFTRIAXONA 1G EV 12/12H - D2/7"],
    medicacoes: ["LOSARTANA 50MG VO 1X/DIA"],
    laboratorios: ["HB 11,2 / LEUCO 13.100 / CR 0,9 / PCR 61"],
    exame_fisico: "BEG, EUPNEICA, MV+ COM ESTERTORES EM BASE D.",
    condutas: ["MANTER ATB", "FISIOTERAPIA RESPIRATÓRIA"],
    pendencias: ["RX TÓRAX CONTROLE"],
    alertas: ["ATB EM CURSO"],
  },
  passagemBatch: {
    pacientes: [
      {
        leito: "L01",
        paciente: "PACIENTE TESTE UM",
        dih: "10/09/2026",
        di: 5,
        diagnostico: "PAC / HAS, DM2",
        quadroAtual: "ESTÁVEL — EUPNEICA EM AR AMBIENTE, AFEBRIL.",
        atb: "CEFTRIAXONA 1G EV 12/12H — D3/7",
        ultimoLab: "HB 10,1 / LEUCO 12.300 / CR 1,2 / PCR 48↓",
        condutasHoje: "MANTER ATB. RX TÓRAX CONTROLE.",
        alertasPendencias: "! RX TÓRAX PENDENTE",
        dispositivos: "JELCO MSD",
        anotacoesVisita: "",
      },
      {
        leito: "L02",
        paciente: "PACIENTE TESTE DOIS",
        dih: "12/09/2026",
        di: 3,
        diagnostico: "ITU COMPLICADA / DRC 3",
        quadroAtual: "INSTÁVEL — HIPERCALEMIA EM CORREÇÃO.",
        atb: "CIPROFLOXACINO 400MG EV 12/12H — D2/7",
        ultimoLab: "CR 2,1↑ / K 5,7 !! / PCR 22",
        condutasHoje: "GLICOINSULINA. REPETIR K EM 6H.",
        alertasPendencias: "!! K 5,7 — REAVALIAR ELETRÓLITOS",
        dispositivos: "SVD (D3)",
        anotacoesVisita: "",
      },
    ],
    alertasCriticos: [
      { prioridade: "!! URGENTE", leito: "L02", paciente: "PACIENTE TESTE DOIS", acao: "REPETIR POTÁSSIO EM 6H E AJUSTAR CIPROFLOXACINO PARA CLCR" },
    ],
  },
  evolucao: `EVOLUÇÃO MÉDICA (MOCK)

#LISTA DE PROBLEMAS
[ATIVOS] PAC EM TRATAMENTO — D3/7 CEFTRIAXONA
[RESOLVIDOS] —

#EVOLUÇÃO DIÁRIA
PACIENTE ESTÁVEL, AFEBRIL, EUPNEICA EM AR AMBIENTE.

CONDUTAS
- MANTER ANTIBIOTICOTERAPIA
- RX DE TÓRAX DE CONTROLE

PENDÊNCIAS
- RX TÓRAX`,
  mapa: "PASSAGEM DE PLANTÃO (MOCK)\n\nL01 - PACIENTE TESTE UM (72 ANOS)\nDIAGNÓSTICO: PAC\nANTIBIÓTICO: CEFTRIAXONA D3/7\n",
  briefing: "BRIEFING DE PLANTÃO (MOCK)\n\nCENSO: 2 PACIENTES\nPACIENTES CRÍTICOS: L02 — HIPERCALEMIA\n",
  encaminhamento:
    "ENCAMINHAMENTO MÉDICO (MOCK)\n\nEncaminho o(a) paciente para avaliação especializada em NEFROLOGIA devido a piora de função renal em vigência de ITU complicada.\n\nHipóteses diagnósticas: DRC estágio 3 agudizada.\nSolicito avaliação e conduta.",
  evolutionReview: {
    campos_faltantes: ["EXAME FÍSICO ABDOMINAL"],
    inconsistencias: [],
    alertas: ["ATB EM D3/7 — REAVALIAR CULTURAS"],
    sugestoes: ["REGISTRAR DIURESE DAS ÚLTIMAS 24H"],
  },
  lab: {
    data_exame: "15/09/2026",
    tipo_exame: "LABORATÓRIO",
    valores: { HB: "10,1", LEUCO: "12.300", CR: "1,2", PCR: "48" },
    texto_formatado: "LAB ATUAL (15/09/2026): HB 10,1 / LEUCO 12.300 / CR 1,2 / PCR 48",
    eas_formatado: null,
    alertas: [],
    valores_duvidosos: [],
    campos_nao_encontrados: ["NA", "K"],
  },
  receita: {
    itens: [
      {
        medicamentoId: "losartana-50",
        nome: "Losartana",
        apresentacao: "50 mg comprimido",
        dose: "50 mg",
        quantidade: "30 comprimidos",
        horarios: { manha: 1 },
        instrucao: "Tomar 1 comprimido pela manhã, todos os dias.",
        duracao: "Uso contínuo",
        justificativa: "HAS em uso prévio.",
      },
    ],
    observacoes: ["MOCK: revisar antes de imprimir."],
  },
} as const;

export type AiFixtureKey = keyof typeof aiFixtures;
