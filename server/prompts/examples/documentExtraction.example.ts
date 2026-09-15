export const DOCUMENT_EXTRACTION_EXAMPLE = `
### EXEMPLO ENTRADA
"EVOLUÇÃO 12/09/2026 — Enf. Clínica Médica, leito 07. M.A.S., 81 anos, feminino. Admitida 09/09/2026 por pneumonia com queda do estado geral. HAS, DM2. Em uso de ceftriaxona 1g EV 12/12h (D4/7) e losartana 50mg. Lab 11/09: Hb 9,8 / Leuco 13.900 / Cr 1,4 / PCR 88. Exame: REG, eupneica em cateter O2 2L, MV+ com estertores em base D. Conduta: manter ATB, fisioterapia respiratória. Pendente: TC de tórax."

### EXEMPLO SAÍDA
{
  "_raciocinio": "Um paciente (leito 07). Data mais recente 12/09/2026. Nome só com iniciais → manter como está. Peso e sinais vitais numéricos ausentes → não inventar. Nenhum limiar crítico (Hb 9,8 > 7; PCR 88 < 100).",
  "nome": "M.A.S.",
  "idade": 81,
  "sexo": "F",
  "leito": "07",
  "setor": "CLÍNICA MÉDICA",
  "data_admissao": "2026-09-09",
  "hda": "ADMITIDA EM 09/09/2026 POR PNEUMONIA COM QUEDA DO ESTADO GERAL.",
  "lista_de_problemas": ["PNEUMONIA", "HAS", "DM2"],
  "antibioticos": ["CEFTRIAXONA 1G EV 12/12H — D4/7"],
  "medicacoes": ["LOSARTANA 50MG"],
  "laboratorios": ["11/09: HB 9,8 / LEUCO 13.900 / CR 1,4 / PCR 88"],
  "exame_fisico": "REG, EUPNEICA EM CATETER O2 2L, MV+ COM ESTERTORES EM BASE D.",
  "condutas": ["MANTER ATB", "FISIOTERAPIA RESPIRATÓRIA"],
  "pendencias": ["TC DE TÓRAX"],
  "alertas": ["ATB D4/7", "O2 SUPLEMENTAR 2L"]
}
`;
