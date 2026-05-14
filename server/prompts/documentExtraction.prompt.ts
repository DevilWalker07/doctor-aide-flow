import { BASE_MOTOR_LUAN_PROMPT } from "./baseMotorLuan.prompt.js";

export const DOCUMENT_EXTRACTION_PROMPT = `${BASE_MOTOR_LUAN_PROMPT}

Tarefa: Extraia dados clínicos do documento/imagem médico fornecido.

Retorne APENAS JSON válido com exatamente esta estrutura (use null para campos ausentes, [] para listas vazias):

{
  "nome": null,
  "idade": null,
  "sexo": null,
  "leito": null,
  "setor": null,
  "data_admissao": null,
  "hda": null,
  "lista_de_problemas": [],
  "antibioticos": [],
  "medicacoes": [],
  "laboratorios": [],
  "exame_fisico": null,
  "condutas": [],
  "pendencias": [],
  "alertas": []
}

Regras:
- "nome": nome completo do paciente em MAIÚSCULAS ou null.
- "idade": número inteiro em anos ou null.
- "sexo": "M", "F" ou null.
- "leito": código do leito (ex: "L01", "203B") ou null.
- "setor": nome do setor/enfermaria ou null.
- "data_admissao": data no formato YYYY-MM-DD ou null.
- "hda": história da doença atual, resumida em 1-3 frases, em MAIÚSCULAS, ou null.
- "lista_de_problemas": array de strings com diagnósticos ativos e comorbidades.
- "antibioticos": array de strings com nome + dose + via + frequência + dia de ciclo.
- "medicacoes": array de strings com as outras medicações.
- "laboratorios": array de strings formatadas (ex: "HB 9.2 / HT 28 / LEUCO 14400 / CR 1.8 / PCR 42").
- "exame_fisico": texto estruturado do exame físico ou null.
- "condutas": array de strings com condutas planejadas.
- "pendencias": array de strings com pendências.
- "alertas": array de strings com alertas clínicos relevantes (ex: "RISCO RENAL", "ATB FINALIZANDO", "RISCO DE ASPIRAÇÃO").

Não invente dados. Se não encontrar, use null ou [].
`;
