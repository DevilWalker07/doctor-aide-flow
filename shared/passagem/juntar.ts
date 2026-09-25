import type { AlertaCritico, LinhaMapa, MapaPlantaoData } from "./tipos.js";

/** Chave de comparação de leito: `L 05`, `l05` e `L05` são o mesmo. */
export function chaveDoLeito(leito: string): string {
  const compacto = leito.toUpperCase().replace(/\s+/g, "");
  return /^\d/.test(compacto) ? `L${compacto}` : compacto;
}

function ordemDoLeito(leito: string): [number, string] {
  const m = chaveDoLeito(leito).match(/(\d+)/);
  return [m ? Number(m[1]) : Number.MAX_SAFE_INTEGER, leito];
}

export interface ResultadoLeito {
  arquivo: string;
  linha: LinhaMapa;
  alertas: AlertaCritico[];
}

/**
 * Junta os leitos lidos um a um num mapa só, em ordem de leito.
 *
 * Dois arquivos para o mesmo leito não se fundem em silêncio: fica o primeiro,
 * e o segundo vira aviso dizendo qual arquivo foi deixado de fora — escolher
 * entre duas evoluções do mesmo paciente é decisão do médico.
 */
export function juntarLeitos(resultados: ResultadoLeito[]): {
  mapa: MapaPlantaoData;
  avisos: string[];
} {
  const porLeito = new Map<string, ResultadoLeito>();
  const avisos: string[] = [];

  for (const r of resultados) {
    const chave = chaveDoLeito(r.linha.leito);
    const ja = porLeito.get(chave);
    if (ja) {
      avisos.push(
        `${r.arquivo}: o leito ${r.linha.leito} já veio de ${ja.arquivo}. Ficou só o primeiro — confira qual evolução é a atual.`,
      );
      continue;
    }
    porLeito.set(chave, r);
  }

  const ordenados = [...porLeito.values()].sort((a, b) => {
    const [na, sa] = ordemDoLeito(a.linha.leito);
    const [nb, sb] = ordemDoLeito(b.linha.leito);
    return na - nb || sa.localeCompare(sb);
  });

  const vistos = new Set<string>();
  const alertas: AlertaCritico[] = [];
  for (const r of ordenados) {
    for (const a of r.alertas) {
      const chave = `${chaveDoLeito(a.leito ?? "")}|${a.acao.toUpperCase()}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      alertas.push(a);
    }
  }

  return { mapa: { pacientes: ordenados.map((r) => r.linha), alertasCriticos: alertas }, avisos };
}
