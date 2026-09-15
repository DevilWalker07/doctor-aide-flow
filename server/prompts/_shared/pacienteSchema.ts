export const PACIENTE_JSON_SCHEMA = `
FORMATO DE SAÍDA — APENAS JSON
{
  "_raciocinio": string,
  "patients": [
    {
      "leito": string, "nome": string, "idade": string, "sexo": "M"|"F"|"",
      "diagnosticos": string, "comorbidades": string, "dispositivos": string,
      "antibioticos": string, "laboratorio": string, "quadro": string,
      "intercorrencias": string, "pendencias": string, "alertas": string[]
    }
  ],
  "globalAlerts": string[]
}
Campos de texto: "NÃO REFERIDO" quando citado sem detalhe; "" quando não mencionado. antibioticos: "NOME DOSE VIA FREQ — D[n]/[total]" (vários separados por " + "). laboratorio: "HB 9,2 / LEUCO 14.400 / CR 1,8 / PCR 42" com "!!" nos limiares de R7. alertas: objetivos e curtos, em MAIÚSCULAS.
`;
