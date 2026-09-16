import { REGRAS_GLOBAIS } from "./_shared/regrasGlobais.js";
import { RACIOCINIO_POR_PACIENTE } from "./_shared/raciocinio.js";
import { BASE_MOTOR_LUAN_PROMPT } from "./baseMotorLuan.prompt.js";
import { PASSAGEM_PLANTAO_EXAMPLE } from "./examples/passagemPlantao.example.js";

export const PASSAGEM_PLANTAO_BATCH_PROMPT = `${BASE_MOTOR_LUAN_PROMPT}
Você receberá evoluções/prescrições de múltiplos leitos de um setor. Processe CADA leito e retorne um JSON consolidado.
${REGRAS_GLOBAIS}
${RACIOCINIO_POR_PACIENTE}
CAMPOS POR LEITO
1 leito: identificação (ex: "CMF 01", "UTI 03").
2 paciente: nome completo + idade (ex: "João da Silva, 68a").
3 dih: data de internação DD/MM/AAAA.
4 di: dia de internação — declarado no texto, ou (data da evolução − DIH) + 1; senão null.
5 diagnostico: principal + comorbidades relevantes, separados por vírgula.
6 quadroAtual: 1–2 frases, OBRIGATORIAMENTE iniciando com "ESTÁVEL —", "EM MELHORA —", "INSTÁVEL —", "CRÍTICO —" ou "PALIATIVO —".
7 atb: "SEM ATB" se não houver. Vários → um por linha ("\\n"). Formato "[Nome] [dose] [via] [frequência] — D[atual]/[total]" (ex: "Ceftriaxona 1g EV 12/12h — D3/7"). D0 = dia do início. Oral → sufixo "(VO)". Sem total → "D4". Sem data de início → "D?". Empírico sem nome → "ATB empírico (sem nome registrado) — D[n]".
8 ultimoLab: "EXAME valor[seta][!!]" separados por vírgula (ex: "PCR 87↑!!, Hb 7,2↓!!, Cr 1,4→"). Setas só com dois valores (R6); "!!" pelos limiares de R7. Sem lab → "Sem lab recente".
9 condutasHoje: itens com "- " (mudanças de ATB, exames solicitados, ajustes, procedimentos).
10 alertasPendencias: DHE não corrigida, infecção sem controle, imagem pendente, ATB finalizando, pendências sociais. "!!" para urgente, "!" para hoje.
11 anotacoesVisita: sempre "".
12 dispositivos: CVC, SVD, SNE/SNG, O2 (dispositivo e fluxo), VM (modo/parâmetros), drenos — com data de inserção se houver; null se nenhum.

PROTOCOLOS (verificar em cada leito; incluir em alertasPendencias/alertasCriticos quando aplicável)
P01 Cockcroft-Gault com Cr + idade + peso: ClCr < 30 → "!! Ajuste renal obrigatório — ClCr < 30"; 30–60 → "! Verificar doses de eliminação renal".
P02 Metformina prescrita → "!! Suspender metformina — paciente internado".
P03 Antiparkinsoniano de uso prévio ausente na prescrição → "!! Antiparkinsoniano ausente — risco de crise parkinsoniana".
P04 Alfa-bloqueador em ≥ 65a → "! Alfa-bloqueador em idoso — risco de hipotensão ortostática".
P05 Na < 130 → "!! Hiponatremia grave — correção máx 8–10 mEq/L/24h"; 130–134 → "! Hiponatremia leve — monitorar correção".
P06 Candidíase documentada sem antifúngico → "!! Candidíase sem antifúngico prescrito".
P07 DI ≥ 2 sem heparina e sem contraindicação documentada → "! Profilaxia VTE ausente".
P08 Corticoide sistêmico: com DM sem insulina → "!! Corticoide + DM — ajuste glicêmico"; sem plano de desmame → "! Corticoide sem plano de desmame"; dose alta sem IBP → "! Corticoide dose alta sem gastroproteção".
P09 Antidiabético oral (exceto metformina) → "!! [nome] — antidiabético oral contraindicado em internamento; substituir por insulina".
P10 Culturas: pendente > 48h → "! Cultura [sítio] pendente"; positiva sem ATB dirigido → "!! Cultura positiva ([germe]) sem cobertura"; negativa com ATB amplo → "! Avaliar de-escalação".
P11 ATB amplo espectro (meropenem, pip-tazo, vancomicina, polimixina) ≥ 5 dias com melhora e sem foco ativo → "! De-escalação de ATB pendente — [nome] D[n]".
P12 CVC ≥ 7 dias sem reavaliação → "! CVC ≥ 7 dias"; SVD sem indicação → "! SVD sem indicação clara — considerar retirada"; SNE/SNG com rebaixamento ou disfagia → "! SNE — risco de broncoaspiração".

ALERTAS CRÍTICOS (lista consolidada ao final, com "leito" para rastreabilidade)
"!! URGENTE" ação imediata · "! HOJE" próximas horas · "PENDÊNCIA SOCIAL" homecare/SUREM/família · "PALIATIVO" conforto/limitação de suporte.

FORMATO DE SAÍDA — APENAS JSON
{
  "pacientes": [ { "_raciocinio": string, "leito": string, "paciente": string, "dih": string, "di": number|null, "diagnostico": string, "quadroAtual": string, "atb": string, "ultimoLab": string, "condutasHoje": string, "alertasPendencias": string, "dispositivos": string|null, "anotacoesVisita": "" } ],
  "alertasCriticos": [ { "prioridade": "!! URGENTE"|"! HOJE"|"PENDÊNCIA SOCIAL"|"PALIATIVO", "leito": string, "paciente": string, "acao": string } ]
}
${PASSAGEM_PLANTAO_EXAMPLE}
Não inclua texto fora do JSON. Não use markdown.
`;
