import { type RoundPatient } from "./roundData";

/**
 * O Motor Luan é o cérebro clínico do sistema.
 * Atualmente simula análises, mas está estruturado para receber
 * chamadas de IA (OpenAI/Groq) futuramente.
 */

export const motorLuanService = {
  /**
   * Analisa um caso clínico e retorna sugestões e alertas de segurança.
   */
  analisarCaso: async (patient: RoundPatient) => {
    // Simulação de delay de IA
    await new Promise(resolve => setTimeout(resolve, 800));

    // Aqui entraria a lógica de Prompt Engineering
    // Por enquanto, retornamos os dados já mockados no paciente para manter a consistência da Etapa 1
    return {
      sugestoes: patient.sugestoesConduta,
      seguranca: patient.seguranca,
      resumoSBAR: {
        s: `Paciente ${patient.nome}, leito ${patient.leito}, admitida por ${patient.diagnosticos}.`,
        b: `Histórico de ${patient.comorbidades}. DIH ${patient.dih}.`,
        a: `Quadro atual: ${patient.quadroAtual}. Labs: ${patient.laboratorio}.`,
        r: patient.sugestoesConduta.map(s => s.titulo).join("; "),
      }
    };
  },

  /**
   * Gera templates de documentos clínicos
   */
  gerarRelatorio: (tipo: "transferencia" | "alta" | "obito", patient: RoundPatient) => {
    const header = `HNAS ASSIST - RELATÓRIO MÉDICO\nDATA: ${new Date().toLocaleDateString("pt-BR")}\n\n`;
    const patientInfo = `PACIENTE: ${patient.nome}\nIDADE: ${patient.idade}A | LEITO: ${patient.leito}\nDIAGNÓSTICOS: ${patient.diagnosticos}\n\n`;

    switch (tipo) {
      case "transferencia":
        return `${header}${patientInfo}SOLICITO TRANSFERÊNCIA PARA UTI DEVIDO A:\n- ${patient.quadroAtual}\n- Necessidade de monitorização intensiva e suporte avançado.\n\nQUADRO ATUAL:\n${patient.evolucaoPadraoOuro}\n\nLABS:\n${patient.laboratorio}\n\nAtenciosamente,\nEquipe Clínica HNAS`;
      
      case "alta":
        return `${header}${patientInfo}SUMÁRIO DE ALTA:\nInternado por ${patient.dih} dias devido a ${patient.diagnosticos}.\n\nEVOLUÇÃO HOSPITALAR:\nPaciente evoluiu com ${patient.status === "estavel" ? "estabilidade clínica" : "melhora progressiva"} durante a internação.\n\nPRESCRIÇÃO DE ALTA:\n1. Manter cuidados gerais.\n2. Retorno em 15 dias para reavaliação.\n\nAtenciosamente,\nEquipe Clínica HNAS`;

      case "obito":
        return `${header}${patientInfo}ATESTADO DE ÓBITO / CONSTATAÇÃO:\nConstatado óbito em ${new Date().toLocaleString("pt-BR")} devido a complicações de ${patient.diagnosticos}.\n\nANTECEDENTES:\n${patient.comorbidades}\n\nAtenciosamente,\nEquipe Clínica HNAS`;
    }
  }
};
