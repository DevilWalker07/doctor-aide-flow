export type RoundPatient = {
  id: string; leito: string; nome: string; idade: number; sexo: "M"|"F"; setor: string;
  dih: number; diagnosticos: string; comorbidades: string; dispositivos: string;
  quadroAtual: string; laboratorio: string; antibioticos: { nome: string; dia: string; dose: string; dAtual: number; dTotal: number }[];
  intercorrencias: string; pendencias: string; alertas: string[]; tags: string[];
  memoriaClinica: string[]; evolucaoPadraoOuro: string; sugestoesConduta: { titulo: string; justificativa: string; prioridade: "ALTA"|"MÉDIA"|"BAIXA" }[];
  seguranca: { alerta: string; base: string }[];
  condutaAtual: string; status: "estavel"|"alerta"|"critico";
};

export const MOCK_PATIENTS: RoundPatient[] = [
  {
    id: "r1", leito: "L01", nome: "MARIA DE LOURDES DA SILVA FERREIRA", idade: 88, sexo: "F",
    setor: "CMF", dih: 20, diagnosticos: "PAC, HDA estabilizada", comorbidades: "HAS, DM2, sequela de AVC",
    dispositivos: "Jelco MSD, SVD", quadroAtual: "Grave estado geral, clinicamente instável, eupneica em AA. Movimentos repetitivos em hemiface esquerda.",
    laboratorio: "HB 9,2 | HT 28 | LEUCO 14.400 | PLQ 198.000 | CR 1,8 | UR 78 | PCR 42",
    antibioticos: [{ nome: "MEROPENEM", dia: "D5", dose: "1G EV 8/8H", dAtual: 5, dTotal: 10 }],
    intercorrencias: "Episódios de engasgo; dieta VO suspensa pela enfermagem.",
    pendencias: "Avaliação da Fonoaudiologia e extração dentária.",
    alertas: ["RISCO DE ASPIRAÇÃO", "ALERTA RENAL"], tags: ["ENGASGOS", "RISCO ASPIRAÇÃO"],
    memoriaClinica: ["AVC há 10 dias", "Uso prévio de meropenem", "Histórico de engasgos", "DRC conhecida"],
    evolucaoPadraoOuro: "PACIENTE EM LEITO L01 — CMF. EVOLUI EM GRAVE ESTADO GERAL, CLINICAMENTE INSTÁVEL, HEMODINAMICAMENTE ESTÁVEL. EUPNEICA EM AR AMBIENTE. TOLERANDO DIETA ORAL PARCIALMENTE — EPISÓDIOS DE ENGASGO REFERIDOS PELA ENFERMAGEM, DIETA VO SUSPENSA. NEGA NÁUSEAS E VÔMITOS. DEJEÇÕES PRESENTES. DIURESE PRESENTE VIA SVD. ANTIBIÓTICO: MEROPENEM 1G EV 8/8H D5/10. MOVIMENTOS REPETITIVOS EM HEMIFACE ESQUERDA — AVALIAR POSSIBILIDADE DE NOVO INSULTO OU CRISE FOCAL. LABS: HB 9,2 / CR 1,8 / PCR 42 (EM QUEDA). PENDÊNCIAS: FONO + EXTRAÇÃO DENTÁRIA.",
    sugestoesConduta: [
      { titulo: "REAVALIAR RISCO DE ASPIRAÇÃO / SOLICITAR FONO", justificativa: "Episódios de engasgo e dieta suspensa pela enfermagem.", prioridade: "ALTA" },
      { titulo: "AJUSTAR DOSE CONFORME FUNÇÃO RENAL", justificativa: "CR 1,8 — TFGe reduzida, risco de acúmulo de medicações com excreção renal.", prioridade: "ALTA" },
      { titulo: "AVALIAR POSSÍVEL NOVO INSULTO NEUROLÓGICO", justificativa: "Movimentos repetitivos em hemiface — considerar crise focal vs sequela.", prioridade: "ALTA" },
    ],
    seguranca: [
      { alerta: "RISCO DE ASPIRAÇÃO", base: "Engasgos + dieta suspensa" },
      { alerta: "POSSÍVEL NEUROTOXICIDADE OU NOVO INSULTO", base: "Movimentos repetitivos em hemiface" },
    ],
    condutaAtual: "MEROPENEM 1G EV 8/8H\nINÍCIO 20/04 — D5/10", status: "critico",
  },
  {
    id: "r2", leito: "L02", nome: "VANUZIA PEREIRA DE SOUZA SILVA", idade: 55, sexo: "F",
    setor: "CMF", dih: 10, diagnosticos: "PAC", comorbidades: "Rouquidão crônica, colapso T12",
    dispositivos: "Jelco MSE", quadroAtual: "BEG, estável, eupneica em AA. Creptos em base de HTD. PCR elevada.",
    laboratorio: "HB 11,5 | HT 35 | LEUCO 10.200 | PLQ 220.000 | CR 0,9 | PCR 28",
    antibioticos: [{ nome: "CEFTRIAXONA", dia: "D7", dose: "1G EV 12/12H", dAtual: 7, dTotal: 10 }, { nome: "AZITROMICINA", dia: "D5", dose: "500MG VO 1x/dia", dAtual: 5, dTotal: 5 }],
    intercorrencias: "", pendencias: "RNM de tórax com contraste agendada para 17/04.",
    alertas: [], tags: ["RNM PENDENTE"],
    memoriaClinica: ["Rouquidão crônica há 6 meses", "Colapso de T12 — dor lombar crônica"],
    evolucaoPadraoOuro: "PACIENTE EM LEITO L02 — CMF. EVOLUI EM BEG, CLÍNICA E HEMODINAMICAMENTE ESTÁVEL. EUPNEICA EM AA. CREPTOS EM BASE DE HTD. TOLERANDO DIETA VO. NEGA NÁUSEAS/VÔMITOS. DEJEÇÕES E DIURESE FISIOLÓGICAS. ATB: CEFTRIAXONA 1G D7/10 + AZITROMICINA 500MG D5/5 (FINALIZANDO). PCR 28 (EM QUEDA). PENDÊNCIA: RNM TÓRAX 17/04.",
    sugestoesConduta: [
      { titulo: "AVALIAR SUSPENSÃO DE AZITROMICINA", justificativa: "Completando D5/5 hoje — esquema previsto finalizado.", prioridade: "MÉDIA" },
    ],
    seguranca: [], condutaAtual: "CEFTRIAXONA 1G EV 12/12H\nAZITROMICINA 500MG VO", status: "estavel",
  },
  {
    id: "r3", leito: "L03", nome: "DIANA RIBEIRO", idade: 41, sexo: "F",
    setor: "CMF", dih: 15, diagnosticos: "Erisipela bolhosa MID, pé diabético", comorbidades: "Esquizofrenia, DM não tratado, obesidade",
    dispositivos: "Jelco MSE", quadroAtual: "REG, estável. Calma no leito após ajuste psicotrópico. PCR em queda acentuada.",
    laboratorio: "HB 10,1 | HT 31 | LEUCO 18.200 (SEG 88%) | PLQ 412.000 | CR 0,7 | PCR 33 (era 127)",
    antibioticos: [{ nome: "PIPERACILINA-TAZOBACTAM", dia: "D1", dose: "4,5G EV 6/6H", dAtual: 1, dTotal: 10 }],
    intercorrencias: "Debridamento cirúrgico em 08/04.", pendencias: "Parecer da Psiquiatria para alta hospitalar.",
    alertas: ["FALHA TERAPÊUTICA", "FERIDA INFECTADA"], tags: ["FALHA TERAPÊUTICA", "FERIDA INFECTADA"],
    memoriaClinica: ["Esquizofrenia — uso de haloperidol", "DM2 sem tratamento prévio", "Debridamento cirúrgico 08/04", "Ferida com secreção purulenta"],
    evolucaoPadraoOuro: "PACIENTE EM LEITO L03 — CMF. EVOLUI EM REG, CLÍNICA E HEMODINAMICAMENTE ESTÁVEL. CALMA NO LEITO APÓS AJUSTE PSICOTRÓPICO. FERIDA EM MID COM SINAIS FLOGÍSTICOS PERSISTENTES. PCR 33 (QUEDA DE 127). LEUCOCITOSE NEUTROFÍLICA. ESCALONADO ATB PARA TAZOCIN 4,5G 6/6H (D1). PÓS DEBRIDAMENTO CIRÚRGICO 08/04. PENDÊNCIA: PARECER PSIQUIATRIA PARA ALTA.",
    sugestoesConduta: [
      { titulo: "AVALIAR TROCA OU ESCALONAMENTO DE ANTIBIÓTICO", justificativa: "Ferida infectada, secreção purulenta e falha terapêutica após 15 dias.", prioridade: "ALTA" },
      { titulo: "SOLICITAR OU REAVALIAR CULTURAS", justificativa: "Persistência de sinais infecciosos e uso prolongado de antibiótico.", prioridade: "MÉDIA" },
      { titulo: "GERAR RELATÓRIO PARA PSIQUIATRIA", justificativa: "Pendência de parecer para planejamento de alta hospitalar.", prioridade: "MÉDIA" },
    ],
    seguranca: [{ alerta: "FALHA TERAPÊUTICA", base: "Ferida infectada + secreção purulenta + ATB prolongado" }],
    condutaAtual: "TAZOCIN 4,5G EV 6/6H\nINÍCIO HOJE — D1/10", status: "alerta",
  },
  {
    id: "r4", leito: "L04", nome: "TERESINHA CAMPOS NUNES", idade: 80, sexo: "F",
    setor: "CMF", dih: 18, diagnosticos: "DAOP crítica, ITU", comorbidades: "Pé Diabético/Charcot, HAS, DM2",
    dispositivos: "Jelco MSE", quadroAtual: "REG, estável. Insônia, desorientação e delirium.",
    laboratorio: "HB 10,8 | HT 33 | LEUCO 9.800 | PLQ 290.000 | CR 1,1 | PCR 12",
    antibioticos: [{ nome: "CIPROFLOXACINO", dia: "D2", dose: "400MG EV 12/12H", dAtual: 2, dTotal: 7 }],
    intercorrencias: "", pendencias: "Aguarda regulação judicial para angioplastia de MID.",
    alertas: ["DELIRIUM"], tags: ["AGUARDA REGULAÇÃO", "DELIRIUM"],
    memoriaClinica: ["DAOP crítica bilateral", "Aguarda regulação judicial", "Pé de Charcot", "Delirium noturno"],
    evolucaoPadraoOuro: "PACIENTE EM LEITO L04 — CMF. EVOLUI EM REG, ESTÁVEL. MANTÉM INSÔNIA, DESORIENTAÇÃO E DELIRIUM NOTURNO. ITU EM TRATAMENTO COM CIPROFLOXACINO D2/7. DIURESE VIA SVD. LABS ESTÁVEIS, PCR 12 (EM QUEDA). AGUARDA REGULAÇÃO JUDICIAL PARA ANGIOPLASTIA DE MID.",
    sugestoesConduta: [
      { titulo: "AVALIAR MANEJO DO DELIRIUM", justificativa: "Desorientação + insônia persistente. Considerar quetiapina.", prioridade: "ALTA" },
    ],
    seguranca: [{ alerta: "RISCO DE DELIRIUM / QUEDA", base: "Desorientação + insônia + idade avançada" }],
    condutaAtual: "CIPROFLOXACINO 400MG EV 12/12H\nD2/7", status: "alerta",
  },
  {
    id: "r5", leito: "L05", nome: "MARINA ROSA DE JESUS", idade: 86, sexo: "F",
    setor: "CMF", dih: 8, diagnosticos: "DM descompensada, PAC", comorbidades: "HAS, Alzheimer",
    dispositivos: "Jelco MD, SNE em pausa", quadroAtual: "REG, eupneica em AA. Refere tontura e vômitos.",
    laboratorio: "HB 8,5 | HT 24 (VCM 112) | LEUCO 12.000 | PLQ 332.000 | CR 0,8 | PCR 85",
    antibioticos: [{ nome: "CEFTRIAXONA", dia: "D5", dose: "1G EV 12/12H", dAtual: 5, dTotal: 7 }],
    intercorrencias: "Vômitos após dieta. SNE em pausa.", pendencias: "RNM encéfalo e avaliação da endocrinologia.",
    alertas: ["ANEMIA SEVERA", "DISGLICEMIA"], tags: ["VÔMITOS", "ANEMIA SEVERA"],
    memoriaClinica: ["Alzheimer avançado", "DM descompensada — glicemias > 300", "Anemia macrocítica — investigar B12"],
    evolucaoPadraoOuro: "PACIENTE EM LEITO L05 — CMF. EVOLUI EM REG, ESTÁVEL. EUPNEICA EM AA. SNE EM PAUSA POR VÔMITOS. ANEMIA SEVERA MACROCÍTICA — HB 8,5 / VCM 112. PCR 85 ELEVADA. ATB: CEFTRIAXONA D5/7. PENDÊNCIAS: RNM ENCÉFALO + ENDOCRINOLOGIA.",
    sugestoesConduta: [
      { titulo: "AVALIAR NECESSIDADE DE TRANSFUSÃO", justificativa: "HB 8,5 com anemia macrocítica. Solicitar B12 e folato.", prioridade: "ALTA" },
      { titulo: "INVESTIGAR CAUSA DA ANEMIA MACROCÍTICA", justificativa: "VCM 112 — solicitar B12, ácido fólico, reticulócitos.", prioridade: "MÉDIA" },
    ],
    seguranca: [{ alerta: "RISCO DE ASPIRAÇÃO", base: "Vômitos + SNE em pausa + Alzheimer" }],
    condutaAtual: "CEFTRIAXONA 1G EV 12/12H\nD5/7", status: "alerta",
  },
  {
    id: "r6", leito: "L06", nome: "EDITE SOARES DE SOUZA", idade: 78, sexo: "F",
    setor: "CMF", dih: 22, diagnosticos: "DRC agudizada, ITU", comorbidades: "Alzheimer, HAS, DM2",
    dispositivos: "Jelco MSE", quadroAtual: "REG, estável. Desorientação basal. CR 1,6.",
    laboratorio: "HB 10,5 | HT 32 | LEUCO 8.400 | PLQ 210.000 | CR 1,6 | UR 88 | K 5,2 | PCR 8",
    antibioticos: [{ nome: "PIPERACILINA-TAZOBACTAM", dia: "D14", dose: "4,5G EV 6/6H", dAtual: 14, dTotal: 14 }],
    intercorrencias: "", pendencias: "Ofertar relatório para nefrologista.",
    alertas: ["ALERTA RENAL", "ATB FINALIZANDO"], tags: ["RELATÓRIO NEFRO", "ATB FINALIZANDO"],
    memoriaClinica: ["DRC estágio 3B", "Alzheimer — desorientação basal", "Uso prolongado de Tazocin"],
    evolucaoPadraoOuro: "PACIENTE EM LEITO L06 — CMF. EVOLUI EM REG, ESTÁVEL. DESORIENTAÇÃO BASAL (ALZHEIMER). ATB: TAZOCIN D14/14 — FINALIZANDO HOJE. CR 1,6 / K 5,2. PCR 8 (NORMALIZADA). PENDÊNCIA: RELATÓRIO PARA NEFROLOGIA.",
    sugestoesConduta: [
      { titulo: "AVALIAR SUSPENSÃO DO ANTIBIÓTICO", justificativa: "Tazocin completando D14/14 hoje. PCR normalizada.", prioridade: "ALTA" },
      { titulo: "MONITORAR POTÁSSIO", justificativa: "K 5,2 — limítrofe. Considerar poliestirenossulfonato.", prioridade: "MÉDIA" },
    ],
    seguranca: [{ alerta: "AJUSTE RENAL DE DOSE", base: "DRC + CR 1,6 + K 5,2" }],
    condutaAtual: "TAZOCIN 4,5G EV 6/6H\nD14/14 — FINALIZA HOJE", status: "estavel",
  },
  {
    id: "r7", leito: "L07", nome: "MARIA APARECIDA FEITOSA SANTOS", idade: 75, sexo: "F",
    setor: "CMF", dih: 12, diagnosticos: "PAC refratária", comorbidades: "DM2, HAS, hipotireoidismo",
    dispositivos: "Jelco MSD", quadroAtual: "REG, estável. Melhora de leucocitose após prednisona. Disglicemias.",
    laboratorio: "HB 11,0 | HT 34 | LEUCO 11.800 | PLQ 180.000 | CR 0,9 | PCR 18",
    antibioticos: [{ nome: "LEVOFLOXACINO", dia: "D7", dose: "750MG EV 1x/dia", dAtual: 7, dTotal: 10 }],
    intercorrencias: "", pendencias: "Monitorização glicêmica rigorosa.",
    alertas: ["DISGLICEMIA"], tags: ["DISGLICEMIA", "CORTICOIDE"],
    memoriaClinica: ["PAC de repetição", "Uso de prednisona — hiperglicemias", "Hipotireoidismo controlado"],
    evolucaoPadraoOuro: "PACIENTE EM LEITO L07 — CMF. EVOLUI EM REG, ESTÁVEL. MELHORA DE LEUCOCITOSE E EOSINOFILIA APÓS PREDNISONA. MANTÉM DISGLICEMIAS (HGT 280–340). ATB: LEVOFLOXACINO D7/10. PCR 18 (EM QUEDA). PENDÊNCIA: MONITORIZAÇÃO GLICÊMICA + AJUSTE INSULINA.",
    sugestoesConduta: [
      { titulo: "AJUSTAR ESQUEMA DE INSULINA", justificativa: "Disglicemias persistentes com HGT > 280. Em uso de corticoide.", prioridade: "ALTA" },
      { titulo: "AVALIAR DESMAME DE CORTICOIDE", justificativa: "Prednisona pode estar mantendo hiperglicemia.", prioridade: "MÉDIA" },
    ],
    seguranca: [{ alerta: "DISGLICEMIA PERSISTENTE", base: "HGT > 280 + corticoide + DM2" }],
    condutaAtual: "LEVOFLOXACINO 750MG EV 1x/DIA\nD7/10", status: "alerta",
  },
];
