export const PASSAGEM_PLANTAO_EXAMPLE = `
### EXEMPLO ENTRADA
{ "setor": "CMF", "data": "15/09/2026", "evolucoes": "=== ARQUIVO: L03.docx ===\\nEVOLUÇÃO 15/09/2026 — LEITO CMF 03 — ANA SOUZA, 74a — DIH 10/09/2026\\nPAC em tratamento. Ceftriaxona 1g EV 12/12h iniciada 12/09. Afebril há 48h, eupneica em ar ambiente. Lab 14/09: Hb 10,4 / Leuco 11.200 / Cr 1,1 / PCR 62 (anterior 118). SVD desde 10/09 sem indicação registrada. Conduta: manter ATB, RX tórax controle amanhã.\\n\\n=== ARQUIVO: L05.docx ===\\nLEITO CMF 05 — JOÃO LIMA — DIH 13/09/2026\\nITU complicada, DRC 3. Ciprofloxacino 400mg EV 12/12h D2. Hoje sonolento, PA 90x50. Lab hoje: Cr 2,4 (ontem 1,9) / K 5,8 / Na 133. Nefro avisada. Sem laboratório de PCR." }

### EXEMPLO SAÍDA
{
  "pacientes": [
    {
      "_raciocinio": "Leito CMF 03, evolução 15/09, DIH 10/09 → DI 6. Lab tem PCR anterior e atual → seta ↓. SVD sem indicação → P12.",
      "leito": "CMF 03",
      "paciente": "ANA SOUZA, 74a",
      "dih": "10/09/2026",
      "di": 6,
      "diagnostico": "PAC",
      "quadroAtual": "EM MELHORA — afebril há 48h, eupneica em ar ambiente.",
      "atb": "Ceftriaxona 1g EV 12/12h — D3",
      "ultimoLab": "Hb 10,4, Leuco 11.200, Cr 1,1, PCR 62↓",
      "condutasHoje": "- Manter ATB\\n- RX tórax controle amanhã",
      "alertasPendencias": "! SVD desde 10/09 sem indicação clara — considerar retirada\\n! RX tórax pendente",
      "dispositivos": "SVD (10/09)",
      "anotacoesVisita": ""
    },
    {
      "_raciocinio": "Leito CMF 05, sem data da evolução (usar 'hoje' = data do plantão), DIH 13/09 → DI 3. Cr 2,4 com anterior 1,9 → ↑; K 5,8 > 5,5 → !!. PA 90x50 + sonolência → instável. Sem PCR → não inventar.",
      "leito": "CMF 05",
      "paciente": "JOÃO LIMA",
      "dih": "13/09/2026",
      "di": 3,
      "diagnostico": "ITU complicada, DRC estágio 3",
      "quadroAtual": "INSTÁVEL — sonolento, PA 90x50, piora de função renal.",
      "atb": "Ciprofloxacino 400mg EV 12/12h — D2",
      "ultimoLab": "Cr 2,4↑!!, K 5,8!!, Na 133",
      "condutasHoje": "- Nefrologia acionada",
      "alertasPendencias": "!! K 5,8 — hipercalemia sem conduta registrada\\n!! Cr 2,4 em ascensão — ajustar ciprofloxacino para ClCr\\n! Avaliar hipotensão (PA 90x50)",
      "dispositivos": null,
      "anotacoesVisita": ""
    }
  ],
  "alertasCriticos": [
    { "prioridade": "!! URGENTE", "leito": "CMF 05", "paciente": "JOÃO LIMA", "acao": "Tratar hipercalemia (K 5,8) e reavaliar hipotensão; ajustar ciprofloxacino à função renal" },
    { "prioridade": "! HOJE", "leito": "CMF 03", "paciente": "ANA SOUZA", "acao": "Definir indicação da SVD ou retirar; conferir RX de tórax" }
  ]
}
`;
