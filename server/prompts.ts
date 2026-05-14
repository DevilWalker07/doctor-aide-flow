export const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export const prompts = {
  labExtractor: `Extraia exames laboratoriais de texto médico brasileiro. Retorne apenas JSON válido. Nunca invente valores: se ausente, use null; se duvidoso, liste em valores_duvidosos. Formato do Dr. Luan:
LAB ATUAL ([DATA]): HB [X] / HT [X] / LEUCO [X] ([X]% SEG / [X]% BAST) / PLQ [X] / CR [X] / UR [X] / NA [X] / K [X] / PCR [X]
EAS ([DATA]): [X] PIÓCITOS/CAMPO / NITRITO [POSITIVO/NEGATIVO]`,

  evolutionGenerator: `Gere EVOLUÇÃO MÉDICA em caixa alta. Não invente dados. Se ausente, use NÃO REFERIDO. Siga exatamente esta estrutura:
EVOLUÇÃO MÉDICA

#LISTA DE PROBLEMAS:
[ATIVOS]
1.
[RESOLVIDOS]
1.

MEDICAÇÕES EM USO:
- ANTIBIÓTICO:
- SINTOMÁTICOS:
- PROFILAXIAS:
- USO CONTÍNUO:
- SE NECESSÁRIO:

#ADMISSÃO / HISTÓRIA DA DOENÇA ATUAL:
#ANTECEDENTES PATOLÓGICOS:
#MEDICAÇÕES DE USO CONTÍNUO:
#EVOLUÇÃO DIÁRIA:
#EXAME FÍSICO:
ECT:
ACV:
AR:
ABD:
EXT:
#EXAMES COMPLEMENTARES:
* LABORATÓRIO
ANÁLISE:
TFGe (CKD-EPI 2021):
* EXAMES DE IMAGEM
#AVALIAÇÃO DE ESPECIALIDADE:
#IMPRESSÃO DIAGNÓSTICA:
CONDUTAS:
PENDÊNCIAS:
INTERCORRÊNCIAS:`,

  reviewer: `Revise uma evolução médica. Retorne apenas JSON com campos_faltantes, inconsistencias, alertas e sugestoes.`,

  yesterdayImport: `Receba várias evoluções em texto livre. Extraia pacientes por leito e retorne apenas JSON:
{ "patients": [{ "bed": "", "name": "", "age": "", "sex": "", "diagnoses": [], "comorbidities": [], "devices": [], "antibiotics": "", "labs": "", "currentStatus": "", "intercorrencias": "", "pendingIssues": "", "alerts": [], "memory": [], "summary": "" }], "globalAlerts": [] }`,

  roundMap: `Gere mapa de passagem de plantão objetivo, por leito, com diagnóstico/comorbidades, dispositivos, antibiótico, laboratório, quadro atual, intercorrências, pendências e alertas.`,

  briefing: `Gere briefing textual de plantão com: censo, críticos, risco de aspiração, alertas infecciosos, alertas renais, pendências de especialidades, altas prováveis e prioridades do round.`,
};
