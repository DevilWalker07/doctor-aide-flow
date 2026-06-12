/**
 * Lista canônica de antibióticos rotineiros usados no plantão.
 * Validada com médica em 16/05/2026.
 *
 * Usada para:
 * 1. Chips de adição rápida na tela de revisar extração e prescrição.
 * 2. Autocomplete por nome (com pesquisa por prefixo + fuzzy).
 * 3. Normalização: quando a IA extrai um ATB, tenta mapear para esta
 *    lista canônica antes de exibir.
 */

export interface AntibioticoRotineiro {
  nome: string;       // Nome canônico em CAIXA ALTA
  apelidos?: string[]; // Outros nomes que a IA pode retornar
  dose: string;
  via: string;
  frequencia: string;
}

export const ANTIBIOTICOS_ROTINEIROS: AntibioticoRotineiro[] = [
  { nome: "CEFTRIAXONA", apelidos: ["ROCEFIN", "CFT"], dose: "1g", via: "IV", frequencia: "12/12h" },
  { nome: "PIPERACILINA + TAZOBACTAM", apelidos: ["PIPTAZO", "PIP-TAZO", "TAZOCIN"], dose: "4,5g", via: "IV", frequencia: "6/6h" },
  { nome: "VANCOMICINA", apelidos: ["VANCO"], dose: "1g", via: "IV", frequencia: "12/12h" },
  { nome: "MEROPENEM", apelidos: ["MERO", "MEROPEN"], dose: "1g", via: "IV", frequencia: "8/8h" },
  { nome: "AMOXICILINA + CLAVULANATO", apelidos: ["CLAVULIN", "AMOXI/CLAV", "AMOXI-CLAV"], dose: "875mg", via: "VO", frequencia: "12/12h" },
  { nome: "AZITROMICINA", apelidos: ["AZI", "AZITRO"], dose: "500mg", via: "VO", frequencia: "1x/dia" },
  { nome: "CLINDAMICINA", apelidos: ["CLINDA"], dose: "600mg", via: "IV", frequencia: "8/8h" },
  { nome: "METRONIDAZOL", apelidos: ["METRO", "FLAGYL"], dose: "500mg", via: "IV", frequencia: "8/8h" },
  { nome: "CIPROFLOXACINO", apelidos: ["CIPRO"], dose: "400mg", via: "IV", frequencia: "12/12h" },
  { nome: "LEVOFLOXACINO", apelidos: ["LEVO", "LEVAQUIN"], dose: "750mg", via: "VO", frequencia: "1x/dia" },
  { nome: "CEFEPIME", apelidos: ["MAXCEF"], dose: "2g", via: "IV", frequencia: "12/12h" },
  { nome: "POLIMIXINA B", apelidos: ["POLI B", "POLIB"], dose: "1MUI", via: "IV", frequencia: "12/12h" },
  { nome: "OXACILINA", apelidos: ["OXA"], dose: "2g", via: "IV", frequencia: "4/4h" },
  { nome: "GENTAMICINA", apelidos: ["GENTA"], dose: "240mg", via: "IV", frequencia: "1x/dia" },
];

/** Lookup case-insensitive incluindo apelidos. Retorna o item canônico ou null. */
export function findAntibiotico(query: string): AntibioticoRotineiro | null {
  const q = query.trim().toUpperCase();
  if (!q) return null;
  for (const a of ANTIBIOTICOS_ROTINEIROS) {
    if (a.nome === q) return a;
    if (a.apelidos?.some(ap => ap.toUpperCase() === q)) return a;
  }
  // Match por prefixo (mínimo 3 chars)
  if (q.length >= 3) {
    for (const a of ANTIBIOTICOS_ROTINEIROS) {
      if (a.nome.startsWith(q)) return a;
      if (a.apelidos?.some(ap => ap.toUpperCase().startsWith(q))) return a;
    }
  }
  return null;
}

/** Filtra a lista por substring para autocomplete. */
export function searchAntibioticos(query: string, limit = 8): AntibioticoRotineiro[] {
  const q = query.trim().toUpperCase();
  if (!q) return ANTIBIOTICOS_ROTINEIROS.slice(0, limit);
  return ANTIBIOTICOS_ROTINEIROS.filter(a => {
    if (a.nome.includes(q)) return true;
    return a.apelidos?.some(ap => ap.toUpperCase().includes(q));
  }).slice(0, limit);
}
