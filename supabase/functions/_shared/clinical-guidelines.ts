/**
 * Diretrizes clinicas usadas como referencia nos prompts da IA.
 *
 * Foco nas condicoes mais frequentes em enfermaria de clinica medica
 * brasileira. Estas diretrizes sao injetadas nos prompts de Dr. Victor
 * (parecer + chat), evolution-generator e prescription-generator pra
 * garantir que a IA tenha as escolhas corretas na ponta da lingua —
 * sem precisar buscar do conhecimento geral, o que da respostas variaveis.
 *
 * Baseado em: Harrison 21ed, IDSA, ATS/ERS, AMB, PCDT/MS, UpToDate.
 * Doses adultas normais (TFG > 30, peso normal). Sempre ajustar.
 */

export const CLINICAL_GUIDELINES_PT = `
═══════════════════════════════════════════════════════════════════════
DIRETRIZES — CLÍNICA MÉDICA / ENFERMARIA (Dr. Luan)

PNEUMONIA ADQUIRIDA NA COMUNIDADE (PAC):
- Estratificação CURB-65: Confusão / Ureia >43 mg/dL / FR ≥30 / PA <90x60 / ≥65 anos.
  · 0-1 = ambulatorial   · 2 = enfermaria   · ≥3 = considerar UTI
- ATB empírico ENFERMARIA (não-UTI): CEFTRIAXONA 1-2g IV 1x/dia + AZITROMICINA 500mg IV/VO 1x/dia.
  · Alternativa: AMOXI-CLAV 1.5g IV 8/8h + macrolídeo.
  · Duração: 5-7 dias se boa resposta clínica em 48-72h.
- Se UTI: pip-tazo 4.5g 8/8h + macrolídeo, OU ceftriaxona + macrolídeo + cobertura SARM se aspirativa/cavitação.
- Critérios de troca IV→VO: afebril 24h, estável, deglutição preservada, tolera dieta.
- Imagem: RX tórax sempre; TC se dúvida ou complicação (empiema, abscesso).
- Coletar: hemocultura 2 amostras antes do ATB, escarro se possível.

ERISIPELA / CELULITE:
- ERISIPELA = lesão bem delimitada, eritema vivo, borda em "casca de laranja", linfangite. S. pyogenes.
  · ATB ambulatorial: AMOXICILINA 500mg 8/8h VO 7-10d, OU CEFALEXINA 500mg 6/6h VO 7-10d.
  · ATB internação: CEFAZOLINA 1-2g IV 8/8h, OU CEFTRIAXONA 1-2g IV 1x/dia, OU OXACILINA 2g IV 6/6h.
- CELULITE = lesão mal delimitada, mais profunda, edema, calor. Pode ter SARM.
  · ATB ambulatorial: AMOXI-CLAV 875/125 12/12h VO 7-10d OU CEFALEXINA + (SMX-TMP se purulenta).
  · Internação: CEFAZOLINA OU AMPI-SULBACTAM 3g IV 6/6h. Se purulento/MRSA risco: + CLINDAMICINA 600mg 8/8h OU VANCOMICINA.
- ELEVAÇÃO DO MEMBRO, MARCAÇÃO DO ERITEMA com caneta (controle de progressão), CONTROLE GLICÊMICO.
- Sinais de gravidade (rever cobertura): bolhas, necrose, crepitação, dor desproporcional, hipotensão → suspeitar FASCEÍTE NECROSANTE, avaliar cirurgia URGENTE.
- Profilaxia secundária se ≥2 episódios/ano: penicilina G benzatina 1.200.000 UI IM 3/3 sem.

INFECÇÃO DO TRATO URINÁRIO (ITU):
- CISTITE não complicada (mulher jovem, não-gestante, sem comorbidade):
  · 1ª escolha: NITROFURANTOÍNA 100mg 6/6h VO 5 dias.
  · 2ª: FOSFOMICINA 3g dose única VO.
  · 3ª: SMX-TMP 800/160 12/12h VO 3d (só se resistência <20%).
  · NUNCA usar quinolona em cistite não complicada.
- PIELONEFRITE não complicada (ambulatorial possível se estável, sem vômito, sem sinais sistêmicos graves):
  · CEFTRIAXONA 1g IV/IM 1x/dia 7-14d, OU CIPROFLOXACINO 500mg 12/12h VO 7d.
- PIELONEFRITE / ITU COMPLICADA (DM, gestante, idoso, imunossuprimido, sonda, anomalia urológica):
  · INTERNAR. CEFTRIAXONA 2g IV 1x/dia OU PIP-TAZO 4.5g 8/8h se sepse / múltiplas exposições prévias.
  · Duração: 7-14 dias dependendo do foco.
- SEMPRE: UROCULTURA + antibiograma ANTES do ATB. Ajustar conforme cultura.
- Sonda vesical: TROCAR antes da urocultura se uso prolongado. Bacteriúria assintomática em sondado NÃO trata (exceto grávida ou pré-procedimento urológico).
- Suspeitar de obstrução / abscesso se febre persistente >72h em ATB adequado → US/TC.

REGRAS GERAIS DE ATB:
- D-day: contar D1 no dia que iniciou. Reavaliar em 48-72h (resposta clínica + culturas).
- Descalonamento agressivo conforme cultura.
- Trocar IV → VO assim que tolerar (custo, flebite, alta).
- Hemocultura SEMPRE antes da 1ª dose em sepse / endocardite / suspeita bacteremia.

CUIDADOS DE ENFERMARIA CLÍNICA — sempre considerar:
- Profilaxia TEV: avaliar Padua. Se ≥4 → enoxaparina 40mg SC 1x/dia.
- Profilaxia úlcera de estresse: IBP se ventilação mecânica >48h, coagulopatia, AVC com escala alterada.
- Controle glicêmico: alvo 140-180 mg/dL em internados não-críticos.
- Mobilização precoce, fisioterapia, espirometria de incentivo (pneumonia).
- Hidratação oral preferencial. SF/RL endovenoso só se VO contraindicada.
- Reavaliar SVD/SNE diariamente — retirar assim que possível.
═══════════════════════════════════════════════════════════════════════
`;
