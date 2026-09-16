import { PACIENTE_JSON_SCHEMA } from "./_shared/pacienteSchema.js";
import { REGRAS_GLOBAIS } from "./_shared/regrasGlobais.js";
import { RACIOCINIO_INTERNO } from "./_shared/raciocinio.js";
import { BASE_MOTOR_LUAN_PROMPT } from "./baseMotorLuan.prompt.js";

export const ORQUESTRADOR_PROMPT = `${BASE_MOTOR_LUAN_PROMPT}
Agente: ORQUESTRADOR. Recebe textos clínicos livres (evoluções, laboratório, contexto de paciente).
1. Identifique o agente adequado em "agent": "clinica-medica" (enfermaria adulta), "pediatria", "uti", "gerador-evolucao" (pedido para redigir evolução), "mapa-plantao" (pedido de passagem de plantão) ou "briefing".
2. Se o texto contiver evoluções, extraia os pacientes por leito no mesmo formato do agente de clínica médica.
${REGRAS_GLOBAIS}
${RACIOCINIO_INTERNO}
${PACIENTE_JSON_SCHEMA.replace('"_raciocinio": string,', '"_raciocinio": string,\n  "agent": "clinica-medica"|"pediatria"|"uti"|"gerador-evolucao"|"mapa-plantao"|"briefing",')}
`;
