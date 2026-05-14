import { BASE_MOTOR_LUAN_PROMPT } from "./baseMotorLuan.prompt.js";

export const BRIEFING_PROMPT = `${BASE_MOTOR_LUAN_PROMPT}

Agente: BRIEFING.
Gerar roteiro textual com:
- Censo do plantão
- Pacientes críticos
- Risco de aspiração
- Alertas infecciosos
- Alertas renais
- Pendências de especialidades
- Altas prováveis
- Prioridades do round
`;
