/** Partículas que ficam em minúscula no meio do nome. */
const PARTICULAS = new Set([
  "de",
  "da",
  "das",
  "do",
  "dos",
  "e",
  "di",
  "du",
  "van",
  "von",
  "la",
  "le",
  "del",
]);

/**
 * Nome de paciente para leitura na interface.
 *
 * A extração da IA guarda tudo em caixa alta, o que é a convenção do texto
 * clínico. Numa lista de leitos, porém, o nome é o elemento mais escaneado —
 * e caixa alta apaga a forma da palavra, que é justamente o que o olho usa
 * para reconhecer um nome de relance. O dado no banco continua maiúsculo;
 * só a exibição muda.
 */
export function nomeExibicao(nome: string | null | undefined): string {
  if (!nome) return "";
  const limpo = nome.trim().replace(/\s+/g, " ");
  if (!limpo) return "";

  return limpo
    .split(" ")
    .map((palavra, i) => {
      const minuscula = palavra.toLocaleLowerCase("pt-BR");
      if (i > 0 && PARTICULAS.has(minuscula)) return minuscula;
      // Trata hífen e apóstrofo: "ANA-MARIA" → "Ana-Maria", "D'ÁVILA" → "D'Ávila".
      return minuscula.replace(
        /(^|[-'])([\p{L}])/gu,
        (_, sep, letra: string) => sep + letra.toLocaleUpperCase("pt-BR"),
      );
    })
    .join(" ");
}

/**
 * Identificação curta do leito, sem o prefixo "L" que a extração adiciona.
 * Só remove o prefixo quando ele é mesmo um prefixo — "UTI-L3" fica intacto.
 */
export function leitoCurto(leito: string | null | undefined): string {
  if (!leito) return "—";
  return leito.trim().replace(/^L(?=\d)/i, "") || "—";
}

/** "3 pacientes" / "1 paciente" — evita o "1 pacientes" que sai de template. */
export function plural(n: number, singular: string, plural_: string): string {
  return `${n} ${n === 1 ? singular : plural_}`;
}
