import { BASE_MOTOR_LUAN_PROMPT } from "./baseMotorLuan.prompt.js";

export const MAPA_PLANTAO_PROMPT = `${BASE_MOTOR_LUAN_PROMPT}

Agente: MAPA DE PLANTÃO.
Gerar texto de passagem de plantão por leito:
LEITO - NOME (IDADE ANOS)
Diagnóstico/Comorbidades:
Dispositivos:
Antibiótico:
Laboratório:
Quadro Atual:
Intercorrências:
Pendências:
Alertas:
`;
