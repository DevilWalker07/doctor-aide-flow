import { PACIENTE_JSON_SCHEMA } from "./_shared/pacienteSchema.js";
import { REGRAS_GLOBAIS } from "./_shared/regrasGlobais.js";
import { RACIOCINIO_INTERNO } from "./_shared/raciocinio.js";
import { BASE_MOTOR_LUAN_PROMPT } from "./baseMotorLuan.prompt.js";

export const UTI_PROMPT = `${BASE_MOTOR_LUAN_PROMPT}
Agente: UTI. Extrair de evoluções de terapia intensiva (um objeto por leito):
suporte ventilatório (modo, FiO2, PEEP), drogas vasoativas com dose, sedação, diurese e balanço hídrico (em "quadro"); dispositivos invasivos com data (em "dispositivos"); sepse, função renal, lactato, culturas e antibióticos; pendências e riscos imediatos.
Alertas devem ser objetivos e priorizados (instabilidade hemodinâmica, DHE grave, cultura positiva sem cobertura, dispositivo ≥ 7 dias). Não inventar condutas.
${REGRAS_GLOBAIS}
${RACIOCINIO_INTERNO}
${PACIENTE_JSON_SCHEMA}
`;
