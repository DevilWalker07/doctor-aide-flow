/**
 * Datas no formato do prontuário: DD/MM/AAAA, e também DD/MM/AA, que é como
 * os cabeçalhos do hospital escrevem ("DATA DA ADMISSÃO: 09/09/26").
 *
 * Conta de dias é do código, não do modelo — mesma regra dos guardrails.
 */

/** Lê `DD/MM/AAAA`, `DD/MM/AA`, `D/M/AAAA` e separadores `.`/`-`. `null` se não for data. */
export function lerDataBR(texto: string | null | undefined): Date | null {
  const m = String(texto ?? "")
    .trim()
    .match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  let ano = Number(m[3]);
  if (m[3].length === 2) ano += 2000;
  const d = new Date(ano, mes - 1, dia);
  // Rejeita 31/02 e afins: o Date "corrige" em silêncio, e isso seria inventar data.
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return d;
}

export function formatarDataBR(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Normaliza qualquer data aceita por `lerDataBR` para `DD/MM/AAAA`. */
export function normalizarDataBR(texto: string | null | undefined): string | null {
  const d = lerDataBR(texto);
  return d ? formatarDataBR(d) : null;
}

/** `AAAA-MM-DD` (valor do `<input type="date">`) → `DD/MM/AAAA`. */
export function isoParaBR(iso: string): string | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? normalizarDataBR(`${m[3]}/${m[2]}/${m[1]}`) : null;
}

/** `DD/MM/AAAA` → `AAAA-MM-DD`, para preencher o `<input type="date">`. */
export function brParaISO(br: string): string {
  const d = lerDataBR(br);
  if (!d) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function diaSeguinte(dataBR: string): string | null {
  const d = lerDataBR(dataBR);
  if (!d) return null;
  d.setDate(d.getDate() + 1);
  return formatarDataBR(d);
}

/**
 * Dias de internação: da DIH até a data do plantão, contando o dia da
 * admissão como D1 — a mesma convenção do prompt ("(data − DIH) + 1").
 * `null` quando alguma das datas não é legível ou a DIH é posterior ao plantão.
 */
export function diasDeInternacao(dih: string, dataPlantao: string): number | null {
  const inicio = lerDataBR(dih);
  const fim = lerDataBR(dataPlantao);
  if (!inicio || !fim) return null;
  const dias = Math.round((fim.getTime() - inicio.getTime()) / 86_400_000) + 1;
  return dias >= 1 ? dias : null;
}
