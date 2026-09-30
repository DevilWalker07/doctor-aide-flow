import { BASE_MOTOR_LUAN_PROMPT } from "./baseMotorLuan.prompt.js";

/**
 * As duas listas que precisam enxergar o plantão inteiro. Recebe só as linhas
 * já validadas pelo schema — nunca o texto das evoluções — e não pode trazer
 * dado que não esteja nelas.
 */
export const PASSAGEM_CONSOLIDAR_PROMPT = `${BASE_MOTOR_LUAN_PROMPT}
Você recebe as linhas JÁ PRONTAS do mapa de passagem de plantão (uma por leito) e monta duas listas para o plantão que recebe.
Use SOMENTE o que está nas linhas. Não acrescente exame, conduta ou dado que não esteja nelas.

1 prioridades: uma frase curta por paciente que exige ação do plantão que recebe (máx. 1 por leito, no máx. 12), em caixa alta, formato "PROBLEMA — O QUE FAZER" (ex.: "HIPOCALEMIA K 2,9 — REPOR E REPETIR K EM 6H").
  prioridade: "!! URGENTE" ação imediata · "! HOJE" próximas horas · "PENDÊNCIA SOCIAL" · "PALIATIVO". Todo alerta "!!" das linhas deve virar prioridade "!! URGENTE".
  leito e paciente exatamente como nas linhas (paciente: só o primeiro nome).
2 pendencias: itens curtos "LEITO: o quê", nestas cinco listas (lista vazia quando não houver):
  admissoesPendentes — admissão recente (DI 1–2) com dado faltando (lab, exame, história).
  labsAIncorporar — exame colhido ou pedido cujo resultado ainda precisa ser visto.
  procedimentosAgendados — exame de imagem, procedimento ou parecer com data.
  altasEmProgramacao — leito com alta prevista ou em preparo.
  avisosCriticos — o que não cabe acima e não pode passar despercebido (isolamento, família, suporte).

FORMATO DE SAÍDA — APENAS JSON
{
  "_raciocinio": string (1–2 linhas),
  "prioridades": [ { "prioridade": string, "leito": string, "paciente": string, "texto": string } ],
  "pendencias": { "admissoesPendentes": string[], "labsAIncorporar": string[], "procedimentosAgendados": string[], "altasEmProgramacao": string[], "avisosCriticos": string[] }
}
Não inclua texto fora do JSON. Não use markdown.
`;
