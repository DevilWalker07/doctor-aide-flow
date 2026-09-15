import { RACIOCINIO_INTERNO } from "./_shared/raciocinio.js";
import { BASE_MOTOR_LUAN_PROMPT } from "./baseMotorLuan.prompt.js";
import { DOCUMENT_EXTRACTION_EXAMPLE } from "./examples/documentExtraction.example.js";

export const DOCUMENT_EXTRACTION_PROMPT = `${BASE_MOTOR_LUAN_PROMPT}
Tarefa: extrair dados clínicos do documento/imagem médico fornecido (evolução, prescrição, prontuário, foto de papel).
${RACIOCINIO_INTERNO}
Retorne APENAS JSON com exatamente esta estrutura (null para ausentes, [] para listas vazias):
{
  "_raciocinio": "",
  "nome": null, "idade": null, "sexo": null, "leito": null, "setor": null, "data_admissao": null,
  "hda": null, "lista_de_problemas": [], "antibioticos": [], "medicacoes": [], "laboratorios": [],
  "exame_fisico": null, "condutas": [], "pendencias": [], "alertas": []
}

Regras por campo:
- nome: nome completo (ou iniciais, se só houver iniciais) em MAIÚSCULAS, ou null.
- idade: inteiro em anos ou null. Nunca deduzir de data de nascimento sem a data da evolução.
- sexo: "M", "F" ou null.
- leito: código do leito (ex: "L01", "203B", "07") ou null. setor: nome da enfermaria ou null.
- data_admissao: AAAA-MM-DD ou null.
- hda: 1–3 frases em MAIÚSCULAS ou null.
- lista_de_problemas: diagnósticos ativos e comorbidades.
- antibioticos: "NOME DOSE VIA FREQUÊNCIA — D[n]/[total]" quando disponível.
- medicacoes: demais medicações em uso.
- laboratorios: uma string por data no formato "DD/MM: HB 9,2 / LEUCO 14.400 / CR 1,8 / PCR 42" (manter valores como no texto).
- exame_fisico: texto do exame físico com sinais vitais se houver, ou null.
- condutas / pendencias: listas de strings curtas em MAIÚSCULAS.
- alertas: apenas alertas objetivos presentes no texto (ex: "ATB D4/7", "RISCO DE ASPIRAÇÃO", "O2 SUPLEMENTAR"). Não invente.
${DOCUMENT_EXTRACTION_EXAMPLE}
Não inclua texto fora do JSON.
`;
