import { PACIENTE_JSON_SCHEMA } from "./_shared/pacienteSchema.js";
import { REGRAS_GLOBAIS } from "./_shared/regrasGlobais.js";
import { RACIOCINIO_INTERNO } from "./_shared/raciocinio.js";
import { BASE_MOTOR_LUAN_PROMPT } from "./baseMotorLuan.prompt.js";

export const CLINICA_MEDICA_PROMPT = `${BASE_MOTOR_LUAN_PROMPT}
Agente: CLÍNICA MÉDICA. Extrair de evoluções de enfermaria (um ou vários pacientes, um objeto por leito):
leito, nome, idade, sexo; diagnósticos, comorbidades, dispositivos; antibióticos com dose/via/frequência/dia de ciclo; laboratório relevante; quadro atual (incluir sinais vitais numéricos citados: PA, FC, FR, SpO2, temperatura); intercorrências; pendências; alertas clínicos objetivos.
${REGRAS_GLOBAIS}
${RACIOCINIO_INTERNO}
${PACIENTE_JSON_SCHEMA}
`;
