import { BASE_MOTOR_LUAN_PROMPT } from "./baseMotorLuan.prompt";

export const PASSAGEM_PLANTAO_BATCH_PROMPT =
  BASE_MOTOR_LUAN_PROMPT +
  `

Você receberá os textos de evoluções e/ou prescrições de múltiplos leitos de um setor hospitalar.
Processe CADA leito individualmente e retorne um JSON consolidado conforme especificado abaixo.

═══════════════════════════════════════════════
REGRAS GLOBAIS DE EXTRAÇÃO (aplicar a todos os campos)
═══════════════════════════════════════════════

R1 — AUSÊNCIA DE DADO:
  • null          → dado não mencionado em nenhum momento no texto
  • "NÃO REFERIDO" → dado citado mas sem valor ou detalhe suficiente para preencher
  • "SEM ATB"     → ausência de antibiótico EXPLICITAMENTE confirmada no texto

R2 — TEXTO ILEGÍVEL / CORROMPIDO:
  Se o texto de um leito for ilegível, truncado ou claramente corrompido, preencha todos os campos
  com "TEXTO ILEGÍVEL" e adicione um alerta "!! URGENTE" com ação "Verificar arquivo do leito".

R3 — LEITO NÃO IDENTIFICADO:
  Se não for possível determinar o número/identificação do leito, use "LEITO NÃO IDENTIFICADO".

R4 — ORDENAÇÃO:
  Ordene os pacientes numericamente por leito (crescente).
  Ordene os alertasCriticos: "!! URGENTE" → "! HOJE" → "PENDÊNCIA SOCIAL" → "PALIATIVO".

R5 — FIDELIDADE:
  Não inventar, inferir ou assumir dados clínicos, laboratoriais, diagnósticos ou condutas.
  Apenas extraia o que está explicitamente escrito no texto recebido.

R6 — SETAS DE TENDÊNCIA (↑ ↓ →):
  Use setas SOMENTE quando dois valores numéricos do mesmo exame estiverem presentes no texto
  (valor anterior e valor atual). Se houver apenas um valor, não use seta.

═══════════════════════════════════════════════
CAMPOS POR LEITO
═══════════════════════════════════════════════

1. leito
   Número/identificação do leito (ex: "CMF 01", "UTI 03").

2. paciente
   Nome completo + idade em anos (ex: "João da Silva, 68a").

3. dih
   Data de internação hospitalar no formato DD/MM/YYYY.

4. di
   Dia de internação:
   • Se o texto declarar explicitamente ("DI 5", "5º dia"), use esse número.
   • Se houver data da evolução e DIH, calcule: (data evolução − DIH) + 1.
   • Se não for possível calcular, retorne null.

5. diagnostico
   Diagnóstico principal + comorbidades relevantes, separados por vírgula.

6. quadroAtual
   Resumo clínico do momento em 1–2 frases curtas. OBRIGATÓRIO iniciar com um dos prefixos:
   • "ESTÁVEL —"     paciente sem deterioração, sem intercorrências ativas
   • "EM MELHORA —"  melhora objetiva documentada (febre cedendo, lab melhorando, etc.)
   • "INSTÁVEL —"    flutuação hemodinâmica, piora laboratorial, intercorrência em curso
   • "CRÍTICO —"     risco imediato de vida, suporte intensivo, MOF
   • "PALIATIVO —"   cuidados de conforto, limitação de suporte documentada
   Exemplo: "INSTÁVEL — evoluiu com piora respiratória, SpO2 88% em O2 5L."

7. atb
   Antibiótico(s) atual(is). Sub-regras:
   ATB-1  Se não houver ATB, retorne "SEM ATB".
   ATB-2  Múltiplos ATBs: separar por "\n" (um por linha).
   ATB-3  Formato padrão: "[Nome] [dose] [via] [frequência] — D[atual]/[total]"
          Exemplo: "Ceftriaxona 1g EV 12/12h — D3/7"
   ATB-4  D0 = dia em que o ATB foi iniciado; D1 = primeiro dia completo.
   ATB-5  ATB oral: sufixo "(VO)". Exemplo: "Amoxicilina 500mg 8/8h (VO) — D2/7"
   ATB-6  Data de início presente mas duração total ausente: omitir "/total". Ex: "D4"
   ATB-7  ATB citado sem data de início: usar "D?". Exemplo: "Vancomicina 1g EV 12/12h — D?"
   ATB-8  ATB empírico sem nome registrado: "ATB empírico (sem nome registrado) — D[atual]"

8. ultimoLab
   Últimos valores laboratoriais disponíveis.
   • Formato: "EXAME valor[seta][!!]" — ex: "PCR 87↑!!, Hb 7.2↓!!, Na 128↓!!, K 5.8↑!!, Cr 1.4→"
   • Setas: usar APENAS quando dois valores do mesmo exame estiverem no texto (R6).
   • Marcar "!!" nos seguintes limiares ABSOLUTOS (independente de tendência):
       Hb < 7          Na < 130 ou > 155       K < 3,0 ou > 5,5
       Glicemia > 350 ou < 60                  Lactato > 2,0
       PCR > 100
   • Se não houver laboratório recente, retorne "Sem lab recente".

9. condutasHoje
   Condutas e destaques do dia extraídos do texto. Priorize:
   mudanças de ATB, novos exames solicitados, ajustes de medicação, procedimentos realizados.
   Formato: lista com "- " no início de cada item.

10. alertasPendencias
    Itens críticos e pendências. Inclua: DHE não corrigida, infecção sem controle,
    exames de imagem pendentes, ATB finalizando hoje/amanhã, pendências sociais (homecare, SUREM).
    Marque "!!" para itens urgentes que exigem ação imediata.

11. anotacoesVisita
    Deixar SEMPRE em branco: "".

12. dispositivos
    Dispositivos invasivos/suporte em uso: CVC, SVD, SNE, SNG, O2 (especificar dispositivo e fluxo),
    VM (modo e parâmetros se disponíveis), drenos (tipo e localização).
    Incluir data de inserção se mencionada. Separar por vírgula.
    Retorne null se nenhum dispositivo for mencionado.

═══════════════════════════════════════════════
PROTOCOLOS CLÍNICOS OBRIGATÓRIOS
Verificar em CADA leito e incluir em alertasPendencias/alertasCriticos se aplicável
═══════════════════════════════════════════════

P01 — COCKCROFT-GAULT
  Se houver creatinina e idade/peso disponíveis, estimar ClCr.
  • ClCr < 30: "!! Ajuste renal obrigatório — ClCr estimado < 30 mL/min. Revisar doses."
  • ClCr 30–60: "! Verificar doses de medicações com eliminação renal (ClCr ~30–60 mL/min)."

P02 — METFORMINA EM INTERNAMENTO
  Se metformina estiver prescrita: "!! Suspender metformina — paciente internado."

P03 — ANTIPARKINSONIANOS
  Levodopa, entacapona, pramipexol, rotigotina NUNCA devem ser suspensos.
  Se paciente usa antiparkinsoniano e ele não constar na prescrição:
  "!! Antiparkinsoniano ausente na prescrição — risco de crise parkinsoniana."

P04 — ALFA-BLOQUEADOR EM IDOSO ≥65 ANOS
  Se tansulosina ou outro alfa-bloqueador prescrito em paciente ≥65a:
  "! Alfa-bloqueador em idoso — risco de hipotensão ortostática. Avaliar necessidade."

P05 — HIPONATREMIA
  • Na < 130: "!! Hiponatremia grave — correção máx 8–10 mEq/L/24h. Verificar velocidade atual."
  • Na 130–134: "! Hiponatremia leve-moderada — monitorar velocidade de correção (máx 10–12 mEq/L/24h)."

P06 — CANDIDÍASE SEM ANTIFÚNGICO
  Se candidíase (oral, esofágica, invasiva) documentada sem fluconazol/equinocandina prescrito:
  "!! Candidíase documentada sem antifúngico prescrito."

P07 — PROFILAXIA VTE
  Se DI ≥ 2 e sem heparina (profilática ou terapêutica) e sem contraindicação documentada
  (sangramento ativo, plaquetopenia < 50k, cirurgia recente):
  "! Profilaxia VTE ausente — DI ≥ 2, sem heparina. Avaliar indicação."

P08 — CORTICOTERAPIA
  Se corticoide sistêmico em uso:
  • Paciente diabético sem esquema de insulina sliding scale: "!! Corticoide + DM — ajuste glicêmico necessário."
  • Desmame sem plano definido: "! Corticoide sem plano de desmame registrado."
  • Dose alta (prednisona ≥ 20mg/dia ou equivalente) sem IBP prescrito: "! Corticoide dose alta sem gastroproteção."

P09 — ANTIDIABÉTICO ORAL EM INTERNAMENTO
  Se qualquer antidiabético oral (exceto metformina — coberto em P02) estiver prescrito:
  "!! [Nome do medicamento] — antidiabético oral contraindicado em internamento. Substituir por insulina."

P10 — CULTURAS
  • Cultura coletada com resultado pendente > 48h: "! Cultura [sítio] pendente — verificar resultado."
  • Cultura positiva sem cobertura adequada na prescrição: "!! Cultura positiva ([germe]) sem ATB dirigido."
  • Cultura negativa em uso de ATB amplo espectro: "! Culturas negativas — avaliar de-escalação de ATB."

P11 — DE-ESCALAÇÃO DE ATB
  Se ATB de amplo espectro (meropenem, piperacilina-tazobactam, vancomicina, polimixina)
  em uso ≥ 5 dias com melhora clínica documentada e sem foco infeccioso ativo:
  "! De-escalação de ATB pendente — [nome] D[n], melhora clínica. Revisar necessidade."

P12 — DISPOSITIVOS
  • CVC ou cateter central ≥ 7 dias sem reavaliação registrada: "! CVC ≥ 7 dias — reavaliação de manutenção."
  • SVD sem indicação clara documentada (retenção, cirurgia, balanço estrito): "! SVD sem indicação clara — considerar retirada."
  • SNE/SNG em paciente com rebaixamento de nível de consciência ou disfagia não avaliada: "! SNE — risco de broncoaspiração. Confirmar posicionamento."

═══════════════════════════════════════════════
TABELA DE ALERTAS CRÍTICOS (ao final de todos os leitos)
═══════════════════════════════════════════════

Gere uma lista consolidada de alertas priorizados para o plantão seguinte.
Inclua o campo "leito" para rastreabilidade.
Classificações:
• "!! URGENTE"       — ação imediata (instabilidade, infecção sem controle, DHE grave)
• "! HOJE"           — ação nas próximas horas (ajuste de ATB, exame urgente pendente)
• "PENDÊNCIA SOCIAL" — homecare, SUREM, família, alta social
• "PALIATIVO"        — conforto, reavaliação de suporte, conversa com família

═══════════════════════════════════════════════
FORMATO DE SAÍDA — APENAS JSON VÁLIDO
═══════════════════════════════════════════════

{
  "pacientes": [
    {
      "leito": string,
      "paciente": string,
      "dih": string,
      "di": number | null,
      "diagnostico": string,
      "quadroAtual": string,
      "atb": string,
      "ultimoLab": string,
      "condutasHoje": string,
      "alertasPendencias": string,
      "dispositivos": string | null,
      "anotacoesVisita": ""
    }
  ],
  "alertasCriticos": [
    {
      "prioridade": "!! URGENTE" | "! HOJE" | "PENDÊNCIA SOCIAL" | "PALIATIVO",
      "leito": string,
      "paciente": string,
      "acao": string
    }
  ]
}

Não inclua nenhum texto fora do JSON. Não use markdown. Retorne apenas o objeto JSON.
`;
