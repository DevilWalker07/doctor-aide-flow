// plantaoImportService.ts - Simulação de IA para processamento de evoluções

export interface ImportedPatient {
  id: string;
  leito: string;
  nome: string;
  idade: string;
  sexo: string;
  diagnosticos: string;
  antibioticos: string;
  quadro: string;
  intercorrencias: string;
  pendencias: string;
  laboratorio: string;
  alertas: string[];
  dispositivos: string;
}

export const plantaoImportService = {
  /**
   * Simula o processamento de texto livre contendo múltiplas evoluções
   */
  processarTextoEvolucoes: async (text: string): Promise<ImportedPatient[]> => {
    // Simula delay de processamento
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Dados Mockados baseados no prompt do usuário
    return [
      {
        id: "L01",
        leito: "L01",
        nome: "MARIA DE LOURDES DA SILVA FERREIRA",
        idade: "88",
        sexo: "F",
        diagnosticos: "PAC, HDA ESTABILIZADA, HAS, DM, SEQUELA DE AVC.",
        dispositivos: "JELCO EM MSD, SVD.",
        antibioticos: "MEROPENEM 1G EV 8/8H - D5/10.",
        laboratorio: "HB 9,2 / HT 28 / LEUCO 14.400 / CR 1,8 / PCR 42.",
        quadro: "GRAVE ESTADO GERAL, CLINICAMENTE INSTÁVEL, EUPNEICA EM AR AMBIENTE. EPISÓDIOS DE ENGASGO, DIETA VO SUSPENSA.",
        intercorrencias: "MOVIMENTOS REPETITIVOS EM HEMIFACE ESQUERDA, AVALIAR NOVO INSULTO/CRISE FOKAL.",
        pendencias: "AVALIAÇÃO DA FONOAUDIOLOGIA E EXTRAÇÃO DENTÁRIA.",
        alertas: ["RISCO DE ASPIRAÇÃO", "ALERTA RENAL"]
      },
      {
        id: "L02",
        leito: "L02",
        nome: "VANUZIA PEREIRA DE SOUZA SILVA",
        idade: "55",
        sexo: "F",
        diagnosticos: "PAC, ROUQUIDÃO CRÔNICA, COLAPSO DE T12.",
        dispositivos: "JELCO EM MSE.",
        antibioticos: "CEFTRIAXONA + AZITROMICINA - D7.",
        laboratorio: "PCR ELEVADA.",
        quadro: "BOM ESTADO GERAL, ESTÁVEL, EUPNEICA EM AR AMBIENTE.",
        intercorrencias: "SEM INTERCORRÊNCIAS.",
        pendencias: "RNM DE TÓRAX COM CONTRASTE AGENDADA.",
        alertas: ["LABORATÓRIO NOVO"]
      },
      {
        id: "L03",
        leito: "L03",
        nome: "DIANA RIBEIRO",
        idade: "41",
        sexo: "F",
        diagnosticos: "ERISIPELA BOLHOSA EM MID, PÉ DIABÉTICO, ESQUIZOFRENIA, DM NÃO TRATADO, OBESIDADE.",
        dispositivos: "JELCO EM MSE.",
        antibioticos: "TAZOCIN 4,5G EV 6/6H - D1.",
        laboratorio: "PCR EM QUEDA ACENTUADA.",
        quadro: "REGULAR ESTADO GERAL, ESTÁVEL. CALMA NO LEITO APÓS AJUSTE PSICOTRÓPICO.",
        intercorrencias: "DEBRIDAMENTO CIRÚRGICO EM 08/04.",
        pendencias: "PARECER DA PSIQUIATRIA PARA ALTA HOSPITALAR.",
        alertas: ["FERIDA INFECTADA", "FALHA TERAPÊUTICA EM ESQUEMA ANTERIOR"]
      },
      {
        id: "L04",
        leito: "L04",
        nome: "TERESINHA CAMPOS NUNES",
        idade: "80",
        sexo: "F",
        diagnosticos: "DAOP CRÍTICA, ITU, PÉ DIABÉTICO/CHARCOT, HAS, DM2.",
        dispositivos: "JELCO EM MSE.",
        antibioticos: "CIPROFLOXACINO - D2.",
        laboratorio: "NÃO CONSTA.",
        quadro: "REGULAR ESTADO GERAL, ESTÁVEL. MANTÉM INSÔNIA, DESORIENTAÇÃO E DELIRIUM.",
        intercorrencias: "SEM INTERCORRÊNCIAS.",
        pendencias: "AGUARDA REGULAÇÃO JUDICIAL PARA ANGIOPLASTIA DE MID.",
        alertas: ["DELIRIUM", "AGUARDA REGULAÇÃO"]
      },
      {
        id: "L05",
        leito: "L05",
        nome: "MARINA ROSA DE JESUS",
        idade: "86",
        sexo: "F",
        diagnosticos: "DM DESCOMPENSADA, PNEUMONIA, HAS, ALZHEIMER.",
        dispositivos: "JELCO EM MD, SNE EM PAUSA POR VÔMITOS.",
        antibioticos: "CEFTRIAXONA - D5.",
        laboratorio: "NÃO CONSTA.",
        quadro: "REGULAR ESTADO GERAL, EUPNEICA EM AR AMBIENTE. REFERE TONTURA E VÔMITOS.",
        intercorrencias: "SEM INTERCORRÊNCIAS.",
        pendencias: "RNM DE ENCÉFALO E AVALIAÇÃO DA ENDOCRINOLOGIA.",
        alertas: ["VÔMITOS", "ANEMIA SEVERA"]
      }
    ];
  },

  /**
   * Gera o texto formatado do mapa de passagem
   */
  gerarTextoMapa: (pacientes: ImportedPatient[], setor: string): string => {
    const today = new Date().toLocaleDateString("pt-BR");
    let text = `📋 PASSAGEM DE PLANTÃO ${setor.toUpperCase()} – ${today}\n`;
    text += "=".repeat(40) + "\n\n";

    pacientes.forEach(p => {
      text += `${p.leito} - ${p.nome} (${p.idade} ANOS)\n`;
      text += `Diagnóstico/Comorbidades: ${p.diagnosticos}\n`;
      text += `Dispositivos: ${p.dispositivos}\n`;
      text += `Antibiótico: ${p.antibioticos}\n`;
      text += `Laboratório: ${p.laboratorio}\n`;
      text += `Quadro Atual: ${p.quadro}\n`;
      if (p.intercorrencias && p.intercorrencias !== "SEM INTERCORRÊNCIAS.") {
        text += `Intercorrências: ${p.intercorrencias}\n`;
      }
      text += `Pendências: ${p.pendencias}\n`;
      if (p.alertas.length > 0) {
        text += `Alertas: ${p.alertas.join("; ")}.\n`;
      }
      text += `\n`;
    });

    return text.toUpperCase();
  },

  /**
   * Gera o roteiro do Briefing
   */
  gerarBriefing: (pacientes: ImportedPatient[], setor: string): string => {
    const today = new Date().toLocaleDateString("pt-BR");
    let text = `BRIEFING DE PLANTÃO – ${setor.toUpperCase()} – ${today}\n\n`;
    
    text += `### CENSO DO PLANTÃO\n`;
    text += `- Total de pacientes: ${pacientes.length}\n`;
    text += `- Críticos: ${pacientes.filter(p => p.alertas.some(a => a.includes("GRAVE") || a.includes("CRÍTICO") || a.includes("INSTÁVEL"))).length}\n\n`;

    text += `### PACIENTES CRÍTICOS / ALERTA\n`;
    pacientes.filter(p => p.alertas.length > 0).forEach(p => {
      text += `- ${p.leito} (${p.nome}): ${p.alertas.join(", ")}\n`;
    });
    
    text += `\n### PRIORIDADES DO ROUND\n`;
    text += `1. REVISAR ANTIBIÓTICOS PROLONGADOS (L06)\n`;
    text += `2. CHECAR REGULAÇÃO JUDICIAL (L04)\n`;
    text += `3. AVALIAR FONOAUDIOLOGIA PARA RISCO DE ASPIRAÇÃO (L01)\n`;

    return text.toUpperCase();
  }
};
