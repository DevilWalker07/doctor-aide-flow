import { renderThresholdsForPrompt } from "../../../shared/medical/labThresholds.js";

export const REGRAS_GLOBAIS = `
REGRAS GLOBAIS DE EXTRAÇÃO
R1 AUSÊNCIA: null = não mencionado; "NÃO REFERIDO" = citado sem valor; "SEM ATB" = ausência de antibiótico confirmada no texto.
R2 ILEGÍVEL: texto corrompido/ilegível → campos "TEXTO ILEGÍVEL" + alerta "!! URGENTE" com ação "Verificar arquivo do leito".
R3 LEITO: sem identificação → "LEITO NÃO IDENTIFICADO".
R4 ORDEM: pacientes por leito crescente; alertas na ordem "!! URGENTE" → "! HOJE" → "PENDÊNCIA SOCIAL" → "PALIATIVO".
R5 FIDELIDADE: nunca inventar, inferir ou assumir dados clínicos, laboratoriais, diagnósticos ou condutas.
R6 SETAS ↑↓→: somente quando houver dois valores do mesmo exame no texto (anterior e atual).
R7 LIMIARES CRÍTICOS (marcar "!!" no valor): ${renderThresholdsForPrompt()}.
`;
