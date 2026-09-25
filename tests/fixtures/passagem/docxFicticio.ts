import {
  Document,
  Header,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

/**
 * Um Word com a mesma estrutura dos arquivos reais da passagem — dados
 * inventados, gerado aqui para nenhum documento de paciente entrar no
 * repositório.
 *
 * O que importa reproduzir:
 * - a identificação mora SÓ no cabeçalho, em tabela de rótulo | valor;
 * - dois cabeçalhos que divergem: a primeira página é a atual (HNAS, data
 *   mais recente) e as demais são sobra do modelo copiado (UPA, data antiga);
 * - corpo com prescrição, "OBS: COM PACIENTE" e a evolução em seções `#`,
 *   com dois laboratórios datados.
 */
export interface OpcoesDocxFicticio {
  nome?: string;
  leito?: string;
  admissao?: string;
  dataAtual?: string;
  dataAntiga?: string;
  potassio?: string;
}

function linhaCabecalho(celulas: string[]): TableRow {
  return new TableRow({
    children: celulas.map(
      (c) =>
        new TableCell({
          width: { size: 2000, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun(c)] })],
        }),
    ),
  });
}

function cabecalho(o: Required<OpcoesDocxFicticio>, unidade: string, data: string): Header {
  return new Header({
    children: [
      new Paragraph({ children: [new TextRun({ text: unidade, bold: true })] }),
      new Table({
        rows: [
          linhaCabecalho(["NOME:", o.nome, "DATA:", data]),
          linhaCabecalho(["NOME DA MÃE:", "MARIA FICTÍCIA DOS SANTOS", "SEXO:", "M"]),
          linhaCabecalho(["DATA DE NASCIMENTO:", "01/01/1950", "IDADE:", "76 ANOS"]),
          linhaCabecalho(["DATA DA ADMISSÃO:", o.admissao, "Nº DE PRONTUÁRIO:", "000123"]),
          linhaCabecalho(["UNIDADE DE INTERNAÇÃO:", "CLÍNICA MÉDICA", "LEITO:", o.leito]),
          linhaCabecalho(["DIAGNÓSTICOS DE INTERNAÇÃO:", "PNEUMONIA COMUNITÁRIA", "", ""]),
        ],
      }),
    ],
  });
}

export function corpoFicticio(o: Required<OpcoesDocxFicticio>): string[] {
  return [
    "PRESCRIÇÃO MÉDICA",
    "1. DIETA BRANDA",
    "2. CEFTRIAXONA 1G EV 12/12H",
    "OBS: COM PACIENTE",
    "EVOLUÇÃO MEDICA",
    "# LISTA DE PROBLEMAS",
    "- PNEUMONIA COMUNITÁRIA",
    "- HIPOCALEMIA",
    "# ATB EM USO",
    "- CEFTRIAXONA (D3)",
    "# EVOLUÇÃO",
    "PACIENTE ESTÁVEL, SEM FEBRE HÁ 48H.",
    "# EXAME FISICO",
    "BEG, EUPNEICO, MV+ COM CREPITOS EM BASE DIREITA.",
    `# LABORATÓRIO (${o.dataAntiga.slice(0, 5)})`,
    "HB 11,2 | LEUCO 14.300 | K 3,4 | CR 1,1",
    `# LABORATÓRIO (${o.dataAtual.slice(0, 5)})`,
    `HB 11,5 | LEUCO 9.800 | K ${o.potassio} | CR 1,0`,
    "CONDUTA",
    "- MANTER ATB",
    "- REPOR POTÁSSIO",
  ];
}

export function opcoesCompletas(o: OpcoesDocxFicticio = {}): Required<OpcoesDocxFicticio> {
  return {
    nome: "JOAQUIM FICTÍCIO DA SILVA",
    leito: "03",
    admissao: "20/09/2026",
    dataAtual: "25/09/2026",
    dataAntiga: "24/09/2026",
    potassio: "3,3",
    ...o,
  };
}

export async function gerarDocxFicticio(opcoes: OpcoesDocxFicticio = {}): Promise<Buffer> {
  const o = opcoesCompletas(opcoes);
  const doc = new Document({
    sections: [
      {
        properties: { titlePage: true },
        headers: {
          first: cabecalho(o, "HOSPITAL FICTÍCIO NAIR", o.dataAtual),
          default: cabecalho(o, "UNIDADE DE PRONTO ATENDIMENTO FICTÍCIA", o.dataAntiga),
        },
        children: corpoFicticio(o).map((t) => new Paragraph({ children: [new TextRun(t)] })),
      },
    ],
  });
  return Packer.toBuffer(doc);
}
