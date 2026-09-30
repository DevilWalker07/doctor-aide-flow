import {
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
  Document,
  HeightRule,
  PageBreak,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import {
  CATEGORIAS_PENDENCIA,
  TITULO_CATEGORIA,
  type AlertaCritico,
  type CabecalhoMapa,
  type Consolidacao,
  type LinhaMapa,
  type MapaPlantaoData,
  type Prioridade,
  type PrioridadePlantao,
} from "./tipos.js";

/**
 * O mapa de passagem no formato do modelo do hospital
 * (`MAPA_PASSAGEM_CMM_02_08_2026.pdf`), montado a partir dos leitos já lidos.
 *
 * Devolve o `Document` e não os bytes: o navegador empacota em Blob para
 * baixar, os testes empacotam em Buffer para abrir e conferir. É o mesmo
 * código nos dois — que é o ponto de ter saído do servidor.
 */

const AZUL = "1F4E79";
const AZUL_CABECALHO = "2E74B5";
const VERMELHO = "C00000";
const BRANCO = "FFFFFF";
const CINZA = "F2F2F2";
const VERMELHO_CLARO = "FFE7E7";
const FONTE = "Calibri";

const BORDA = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" } as const;
const SEM_BORDA = { style: BorderStyle.NONE, size: 0, color: BRANCO } as const;

type Alinhamento = (typeof AlignmentType)[keyof typeof AlignmentType];
type AlinhamentoVertical = Exclude<(typeof VerticalAlign)[keyof typeof VerticalAlign], "both">;

function celula(
  texto: string | null | undefined,
  opts: {
    negrito?: boolean;
    tamanho?: number;
    cor?: string;
    fundo?: string;
    largura?: number;
    alinhar?: Alinhamento;
    vertical?: AlinhamentoVertical;
  } = {},
): TableCell {
  const {
    negrito = false,
    tamanho = 13,
    cor = "000000",
    fundo,
    largura,
    alinhar = AlignmentType.LEFT,
    vertical = VerticalAlign.TOP,
  } = opts;
  const linhas = String(texto ?? "").split("\n");
  return new TableCell({
    width: largura ? { size: largura, type: WidthType.DXA } : undefined,
    shading: fundo ? { type: ShadingType.SOLID, color: fundo, fill: fundo } : undefined,
    verticalAlign: vertical,
    borders: { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA },
    children: linhas.map(
      (linha, i) =>
        new Paragraph({
          alignment: alinhar,
          spacing: i < linhas.length - 1 ? { after: 40 } : {},
          children: [
            new TextRun({ text: linha, bold: negrito, size: tamanho, color: cor, font: FONTE }),
          ],
        }),
    ),
  });
}

function celulaDeCabecalho(texto: string, largura: number): TableCell {
  return celula(texto, {
    negrito: true,
    cor: BRANCO,
    fundo: AZUL_CABECALHO,
    largura,
    alinhar: AlignmentType.CENTER,
    vertical: VerticalAlign.CENTER,
  });
}

function faixaDeLargura(
  texto: string,
  fundo: string,
  tamanho: number,
  corTexto = BRANCO,
): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        columnSpan: 7,
        shading: { type: ShadingType.SOLID, color: fundo, fill: fundo },
        borders: { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: texto, bold: true, size: tamanho, color: corTexto, font: FONTE }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** Sete colunas, na ordem do modelo do hospital. */
const COL = {
  leito: 700,
  paciente: 2100,
  diagnostico: 2300,
  atb: 1700,
  ultimoLab: 2100,
  condutas: 2100,
  alertas: 2960,
};

/**
 * Faixas de leito por enfermaria. O mapa do hospital separa as linhas por
 * enfermaria; sem isso quem recebe lê 13 leitos seguidos sem saber onde
 * termina uma ala. O padrão é o do CMM. Leito fora de toda faixa entra sem
 * tarja — nunca é descartado.
 */
export interface GrupoLeitos {
  titulo: string;
  /** Nome curto para a linha-resumo ("ENFERMARIA 1"). */
  nome: string;
  de: number;
  ate: number;
}

export const GRUPOS_LEITO_PADRAO: GrupoLeitos[] = [
  { titulo: "ENFERMARIA 1 — LEITOS 01 A 05", nome: "ENFERMARIA 1", de: 1, ate: 5 },
  { titulo: "ENFERMARIA 2 — LEITOS 06 A 11", nome: "ENFERMARIA 2", de: 6, ate: 11 },
  { titulo: "ISOLAMENTOS — LEITOS 12 E 13", nome: "ISOLAMENTOS", de: 12, ate: 13 },
];

function numeroDoLeito(leito: string): number | null {
  const m = String(leito ?? "").match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

export function grupoDoLeito(leito: string, grupos: GrupoLeitos[]): GrupoLeitos | null {
  const n = numeroDoLeito(leito);
  return n == null ? null : (grupos.find((g) => n >= g.de && n <= g.ate) ?? null);
}

/**
 * A terceira linha do título do modelo:
 * `ENFERMARIA 1: L01 NOVO, L02, L05 • ENFERMARIA 2: L07 | *LIDOS DE IMAGEM: L03`.
 *
 * Montada em código, sem IA: é só faixa de leito e contagem. "NOVO" é leito
 * internado hoje (DI 1), que o código calcula da DIH.
 */
export function linhaResumoEnfermarias(
  pacientes: LinhaMapa[],
  grupos: GrupoLeitos[],
  leitosComFalha: string[] = [],
): string {
  const porGrupo = new Map<string, string[]>();
  const semGrupo: string[] = [];
  for (const p of pacientes) {
    const rotulo = p.di === 1 ? `${p.leito} NOVO` : p.leito;
    const g = grupoDoLeito(p.leito, grupos);
    if (g) porGrupo.set(g.nome, [...(porGrupo.get(g.nome) ?? []), rotulo]);
    else semGrupo.push(rotulo);
  }
  const partes = grupos
    .filter((g) => porGrupo.has(g.nome))
    .map((g) => `${g.nome}: ${porGrupo.get(g.nome)!.join(", ")}`);
  if (semGrupo.length) partes.push(`OUTROS: ${semGrupo.join(", ")}`);

  const marcas: string[] = [];
  const deImagem = pacientes.filter((p) => p.lidoDeImagem).map((p) => p.leito);
  if (deImagem.length) marcas.push(`*LIDOS DE IMAGEM: ${deImagem.join(", ")}`);
  if (leitosComFalha.length) marcas.push(`*NÃO LIDOS: ${leitosComFalha.join(", ")}`);

  return [partes.join(" • "), ...marcas].filter(Boolean).join(" | ");
}

const ORDEM_PRIORIDADE: Record<Prioridade, number> = {
  "!! URGENTE": 0,
  "! HOJE": 1,
  "PENDÊNCIA SOCIAL": 2,
  PALIATIVO: 3,
};

/**
 * Prioridades quando a consolidação não veio: as dos próprios leitos,
 * ordenadas por gravidade. São saídas já validadas pelo schema — nada aqui é
 * inventado para preencher a seção.
 */
export function prioridadesDosAlertas(alertas: AlertaCritico[]): PrioridadePlantao[] {
  return [...alertas]
    .sort((a, b) => ORDEM_PRIORIDADE[a.prioridade] - ORDEM_PRIORIDADE[b.prioridade])
    .map((a) => ({
      prioridade: a.prioridade,
      leito: a.leito ?? "",
      paciente: a.paciente,
      texto: a.acao,
    }));
}

function titulo(texto: string, cor = AZUL, antes = 240): Paragraph {
  return new Paragraph({
    spacing: { before: antes, after: 80 },
    children: [new TextRun({ text: texto, bold: true, size: 22, color: cor, font: FONTE })],
  });
}

function itemNumerado(n: number, texto: string, destaque = false): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    indent: { left: 240, hanging: 240 },
    children: [
      new TextRun({ text: `${n}. `, bold: true, size: 15, font: FONTE }),
      new TextRun({
        text: texto,
        size: 15,
        bold: destaque,
        color: destaque ? "9B0000" : "000000",
        font: FONTE,
      }),
    ],
  });
}

function paragrafoSimples(texto: string, cor = "555555", italico = false): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text: texto, size: 15, color: cor, italics: italico, font: FONTE })],
  });
}

/** "FOLHA DE SUGESTÕES CLÍNICAS – ANÁLISE POR LEITO". Sem análise nenhuma, a folha não sai. */
function folhaDeSugestoes(mapa: MapaPlantaoData, dataPlantao: string): Paragraph[] {
  const comAnalise = mapa.pacientes.filter((p) => p.sugestoesClinicas.length > 0);
  if (comAnalise.length === 0) return [];
  const blocos: Paragraph[] = [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: "FOLHA DE SUGESTÕES CLÍNICAS – ANÁLISE POR LEITO",
          bold: true,
          size: 24,
          color: AZUL,
          font: FONTE,
        }),
      ],
    }),
    paragrafoSimples(
      `REFERENTE ÀS EVOLUÇÕES DE ${dataPlantao} | SUGESTÕES DE APOIO À DECISÃO (NÃO SUBSTITUEM AVALIAÇÃO À BEIRA-LEITO)`,
    ),
  ];
  for (const p of comAnalise) {
    blocos.push(
      new Paragraph({
        spacing: { before: 140, after: 40 },
        children: [
          new TextRun({
            text: [p.leito, p.resumoLinha || p.paciente].filter(Boolean).join(" — "),
            bold: true,
            size: 17,
            color: AZUL,
            font: FONTE,
          }),
        ],
      }),
    );
    for (const linha of p.sugestoesClinicas) {
      blocos.push(
        new Paragraph({
          spacing: { after: 30 },
          indent: { left: 180 },
          children: [new TextRun({ text: `• ${linha}`, size: 15, font: FONTE })],
        }),
      );
    }
  }
  return blocos;
}

export interface OpcoesMapa {
  setor: string;
  dataPlantao: string;
  cabecalho?: CabecalhoMapa;
  grupos?: GrupoLeitos[];
  /** Resultado da chamada final; `null` quando ela falhou ou não houve. */
  consolidacao?: Consolidacao | null;
  /** Leitos que não foram lidos, para o aviso de mapa incompleto. */
  leitosComFalha?: string[];
  /** Avisos da geração: falhas de leito, leito duplicado, conflito de cabeçalho. */
  avisos?: string[];
}

export function montarMapaDocx(mapa: MapaPlantaoData, opts: OpcoesMapa): Document {
  const { setor, dataPlantao, cabecalho, consolidacao = null } = opts;
  const grupos = opts.grupos ?? GRUPOS_LEITO_PADRAO;
  const avisos = opts.avisos ?? [];
  const leitosComFalha = opts.leitosComFalha ?? [];
  const dataQueRecebe = cabecalho?.passagemPara ?? "";

  const linhaPlantao =
    [
      cabecalho?.hospital?.toUpperCase(),
      `PLANTÃO DE ${dataPlantao}${cabecalho?.periodo ? ` (${cabecalho.periodo.toUpperCase()})` : ""}`,
    ]
      .filter(Boolean)
      .join(" – ") + (dataQueRecebe ? ` → PASSAGEM PARA ${dataQueRecebe}` : "");

  const resumo = linhaResumoEnfermarias(mapa.pacientes, grupos, leitosComFalha);

  const faixaTitulo = new TableRow({
    children: [
      new TableCell({
        columnSpan: 7,
        shading: { type: ShadingType.SOLID, color: AZUL, fill: AZUL },
        borders: { top: SEM_BORDA, bottom: SEM_BORDA, left: SEM_BORDA, right: SEM_BORDA },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `MAPA DE PASSAGEM DE PLANTÃO – ${setor.toUpperCase()}`,
                bold: true,
                size: 22,
                color: BRANCO,
                font: FONTE,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: linhaPlantao, bold: true, size: 17, color: BRANCO, font: FONTE }),
            ],
          }),
          ...(resumo
            ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: resumo, size: 14, color: BRANCO, font: FONTE })],
                }),
              ]
            : []),
        ],
      }),
    ],
  });

  const linhaColunas = new TableRow({
    height: { value: convertInchesToTwip(0.35), rule: HeightRule.EXACT },
    tableHeader: true,
    children: [
      celulaDeCabecalho("LEITO", COL.leito),
      celulaDeCabecalho("PACIENTE / INFO", COL.paciente),
      celulaDeCabecalho("DIAGNÓSTICOS", COL.diagnostico),
      celulaDeCabecalho("ATB (D-ATUAL/D-TOTAL)", COL.atb),
      celulaDeCabecalho("ÚLTIMOS LABS", COL.ultimoLab),
      celulaDeCabecalho(`CONDUTAS DE ${dataPlantao}`, COL.condutas),
      celulaDeCabecalho("ALERTAS / PENDÊNCIAS DO LEITO", COL.alertas),
    ],
  });

  function linhaDoPaciente(p: LinhaMapa, i: number): TableRow {
    const fundo = i % 2 === 0 ? undefined : CINZA;
    const urgente = p.alertasPendencias.includes("!!");
    const info = [
      p.paciente,
      `DIH: ${p.dih}${p.di != null ? ` | DI ${p.di}d` : ""}`,
      p.quadroAtual,
      p.lidoDeImagem ? "⚠ LIDO DE IMAGEM — CONFIRA VALORES" : null,
    ]
      .filter(Boolean)
      .join("\n");
    const diagnostico = [p.diagnostico, p.dispositivos ? `[${p.dispositivos}]` : null]
      .filter(Boolean)
      .join("\n");
    return new TableRow({
      children: [
        celula(p.leito, { negrito: true, fundo, largura: COL.leito }),
        celula(info, { negrito: true, fundo, largura: COL.paciente }),
        celula(diagnostico, { fundo, largura: COL.diagnostico }),
        celula(p.atb, {
          fundo,
          largura: COL.atb,
          cor: /^sem atb$/i.test(p.atb.trim()) ? "888888" : "000000",
        }),
        celula(p.ultimoLab, { fundo, largura: COL.ultimoLab }),
        celula(p.condutasHoje, { fundo, largura: COL.condutas }),
        celula(p.alertasPendencias, {
          fundo: urgente ? VERMELHO_CLARO : fundo,
          largura: COL.alertas,
          negrito: urgente,
          cor: urgente ? "9B0000" : "000000",
        }),
      ],
    });
  }

  // A tarja entra quando a enfermaria muda. Emitir a partir da lista de
  // pacientes (e não da de grupos) garante que nenhum leito fique de fora.
  let grupoAtual: string | null = null;
  const linhas = mapa.pacientes.flatMap((p, i) => {
    const g = grupoDoLeito(p.leito, grupos);
    const tarja =
      g && g.titulo !== grupoAtual ? [faixaDeLargura(g.titulo, "D9E2F3", 15, AZUL)] : [];
    if (g) grupoAtual = g.titulo;
    return [...tarja, linhaDoPaciente(p, i)];
  });

  const tabela = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [faixaTitulo, linhaColunas, ...linhas],
  });

  // Aviso de mapa incompleto ANTES da tabela: quem recebe precisa saber que
  // falta leito antes de confiar no que está lá.
  const blocoAvisos: Paragraph[] = avisos.length
    ? [
        titulo("⚠ ATENÇÃO — LEIA ANTES DE USAR ESTE MAPA", VERMELHO, 0),
        ...avisos.map((a, i) => itemNumerado(i + 1, a, true)),
        new Paragraph({ text: "", spacing: { after: 120 } }),
      ]
    : [];

  const prioridades = consolidacao?.prioridades.length
    ? consolidacao.prioridades
    : prioridadesDosAlertas(mapa.alertasCriticos);
  const blocoPrioridades: Paragraph[] = [
    titulo(`PRIORIDADES PARA O PLANTÃO${dataQueRecebe ? ` ${dataQueRecebe}` : ""}`),
    ...(prioridades.length
      ? prioridades.map((p, i) =>
          itemNumerado(
            i + 1,
            `${p.paciente}${p.leito ? ` (${p.leito})` : ""}: ${p.texto}`,
            p.prioridade === "!! URGENTE",
          ),
        )
      : [paragrafoSimples("Nenhuma prioridade registrada nos leitos lidos.", "555555", true)]),
  ];

  const categoriasComItens = consolidacao
    ? CATEGORIAS_PENDENCIA.filter((c) => consolidacao.pendencias[c].length > 0)
    : [];
  const blocoPendencias: Paragraph[] = [
    titulo(`PENDÊNCIAS GERAIS – PLANTÃO${dataQueRecebe ? ` ${dataQueRecebe}` : ""}`),
    ...(!consolidacao
      ? [
          paragrafoSimples(
            "Não foi possível consolidar as pendências gerais — veja a coluna ALERTAS / PENDÊNCIAS DO LEITO de cada paciente.",
            VERMELHO,
            true,
          ),
        ]
      : categoriasComItens.length
        ? categoriasComItens.map((c, i) =>
            itemNumerado(
              i + 1,
              `${TITULO_CATEGORIA[c]}: ${consolidacao.pendencias[c].join(" | ")}`,
            ),
          )
        : [paragrafoSimples("Nenhuma pendência geral registrada.", "555555", true)]),
  ];

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
              width: convertInchesToTwip(11.69),
              height: convertInchesToTwip(8.27),
            },
            margin: {
              top: convertInchesToTwip(0.5),
              bottom: convertInchesToTwip(0.5),
              left: convertInchesToTwip(0.5),
              right: convertInchesToTwip(0.5),
            },
          },
        },
        children: [
          ...blocoAvisos,
          tabela,
          ...blocoPrioridades,
          ...blocoPendencias,
          ...folhaDeSugestoes(mapa, dataPlantao),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 100 },
            children: [
              new TextRun({
                text: `Gerado em ${new Date().toLocaleString("pt-BR")}`,
                size: 12,
                color: "888888",
                italics: true,
                font: FONTE,
              }),
            ],
          }),
        ],
      },
    ],
  });
}

/** Nome do arquivo baixado: `MAPA_PASSAGEM_CMM_25-09-2026.docx`. */
export function nomeDoArquivoMapa(setor: string, dataPlantao: string): string {
  const s = setor
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `MAPA_PASSAGEM_${s}_${dataPlantao.replace(/\//g, "-")}.docx`;
}
