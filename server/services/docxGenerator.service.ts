import {
  Document,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  WidthType,
  Packer,
  PageOrientation,
  ShadingType,
  BorderStyle,
  VerticalAlign,
  HeightRule,
  convertInchesToTwip,
} from "docx";

import type { AlertaCritico, MapaPlantaoData, PatientRow } from "../schemas/ai.schemas.js";

export type { AlertaCritico, MapaPlantaoData, PatientRow };

const AZUL_MEDFLUXO = "1F4E79";
const BLUE_HEADER_ROW = "2E74B5";
const RED_ALERT = "C00000";
const WHITE = "FFFFFF";
const LIGHT_GRAY = "F2F2F2";
const LIGHT_RED = "FFE7E7";

function cell(
  rawText: string | null | undefined,
  opts: {
    bold?: boolean;
    fontSize?: number;
    color?: string;
    bgColor?: string;
    width?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    vAlign?: Exclude<(typeof VerticalAlign)[keyof typeof VerticalAlign], "both">;
    wrap?: boolean;
  } = {},
): TableCell {
  const {
    bold = false,
    fontSize = 14,
    color = "000000",
    bgColor,
    width,
    align = AlignmentType.LEFT,
    vAlign = VerticalAlign.TOP,
  } = opts;

  const lines = String(rawText ?? "").split("\n");

  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: bgColor ? { type: ShadingType.SOLID, color: bgColor, fill: bgColor } : undefined,
    verticalAlign: vAlign,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    },
    children: lines.map(
      (line, i) =>
        new Paragraph({
          alignment: align,
          spacing: i < lines.length - 1 ? { after: 40 } : {},
          children: [
            new TextRun({
              text: line,
              bold,
              size: fontSize,
              color,
              font: "Calibri",
            }),
          ],
        }),
    ),
  });
}

function headerCell(text: string, width: number): TableCell {
  return cell(text, {
    bold: true,
    fontSize: 13,
    color: WHITE,
    bgColor: BLUE_HEADER_ROW,
    width,
    align: AlignmentType.CENTER,
    vAlign: VerticalAlign.CENTER,
  });
}

function alertHeaderCell(text: string, width: number): TableCell {
  return cell(text, {
    bold: true,
    fontSize: 13,
    color: WHITE,
    bgColor: RED_ALERT,
    width,
    align: AlignmentType.CENTER,
    vAlign: VerticalAlign.CENTER,
  });
}

function getPrioridadeColor(prioridade: string): string {
  if (prioridade.includes("URGENTE")) return LIGHT_RED;
  if (prioridade.includes("HOJE")) return "FFF3CD";
  if (prioridade.includes("SOCIAL")) return "E8F4FD";
  return "F0FFF0";
}

// Column widths in DXA (twips). Landscape A4 ≈ 15840 twips wide, margins ~1440 each side → ~12960 usable
/**
 * Sete colunas, na ordem do modelo do hospital.
 *
 * LEITO e PACIENTE eram uma coluna só, e a "ANOTAÇÕES VISITA MULTI" era
 * invenção minha — não existe no mapa que o médico usa.
 */
const COL = {
  leito: 700,
  paciente: 2100,
  diagnostico: 2300,
  atb: 1700,
  ultimoLab: 2100,
  condutas: 2100,
  alertas: 2960,
};

const ALERT_COL = {
  prioridade: 1800,
  paciente: 3000,
  acao: 7160,
};

export interface CabecalhoMapa {
  hospital?: string;
  /** "diurno" ou "noturno". */
  periodo?: string;
  /** Data do plantão que recebe. */
  passagemPara?: string;
}

export async function gerarMapaPlantaoDocx(
  data: MapaPlantaoData,
  setor: string,
  dataPlantao: string,
  cabecalho?: CabecalhoMapa,
): Promise<Buffer> {
  const tituloHeader = new TableRow({
    height: { value: convertInchesToTwip(0.45), rule: HeightRule.EXACT },
    children: [
      new TableCell({
        columnSpan: 7,
        shading: { type: ShadingType.SOLID, color: AZUL_MEDFLUXO, fill: AZUL_MEDFLUXO },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `MAPA DE PASSAGEM DE PLANTÃO – ${setor.toUpperCase()}`,
                bold: true,
                size: 22,
                color: WHITE,
                font: "Calibri",
              }),
            ],
          }),
          // Segunda linha como no modelo do hospital: onde, qual turno e para
          // quando a passagem vai. Quem recebe o arquivo precisa saber disso
          // sem perguntar.
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: [
                  cabecalho?.hospital?.toUpperCase(),
                  `PLANTÃO DE ${dataPlantao}${cabecalho?.periodo ? ` (${cabecalho.periodo.toUpperCase()})` : ""}`,
                  cabecalho?.passagemPara ? `→ PASSAGEM PARA ${cabecalho.passagemPara}` : null,
                ]
                  .filter(Boolean)
                  .join(" – "),
                bold: true,
                size: 17,
                color: WHITE,
                font: "Calibri",
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const headerRow = new TableRow({
    height: { value: convertInchesToTwip(0.35), rule: HeightRule.EXACT },
    tableHeader: true,
    children: [
      headerCell("LEITO", COL.leito),
      headerCell("PACIENTE / INFO", COL.paciente),
      headerCell("DIAGNÓSTICOS", COL.diagnostico),
      headerCell("ATB (D-ATUAL/D-TOTAL)", COL.atb),
      headerCell("ÚLTIMOS LABS", COL.ultimoLab),
      headerCell(`CONDUTAS DE ${dataPlantao}`, COL.condutas),
      headerCell("ALERTAS / PENDÊNCIAS DO LEITO", COL.alertas),
    ],
  });

  const dataRows = data.pacientes.map((p, idx) => {
    const bgColor = idx % 2 === 0 ? undefined : LIGHT_GRAY;
    const hasAlertaUrgente = p.alertasPendencias.includes("!!");
    // PACIENTE / INFO: quem é, há quanto tempo está e como está hoje — é o que
    // o modelo do hospital traz nessa coluna.
    const diStr = p.di != null ? ` | DI ${p.di}d` : "";
    const infoText = [p.paciente, `DIH: ${p.dih}${diStr}`, p.quadroAtual ?? null]
      .filter(Boolean)
      .join("\n");
    const diagText = [p.diagnostico, p.dispositivos ? `[${p.dispositivos}]` : null]
      .filter(Boolean)
      .join("\n");

    return new TableRow({
      children: [
        cell(p.leito, { bold: true, fontSize: 13, bgColor, width: COL.leito }),
        cell(infoText, { bold: true, fontSize: 13, bgColor, width: COL.paciente }),
        cell(diagText, { fontSize: 13, bgColor, width: COL.diagnostico }),
        cell(p.atb, {
          fontSize: 13,
          bgColor,
          width: COL.atb,
          color: /^sem atb$/i.test(p.atb.trim()) ? "888888" : "000000",
        }),
        cell(p.ultimoLab, { fontSize: 13, bgColor, width: COL.ultimoLab }),
        cell(p.condutasHoje, { fontSize: 13, bgColor, width: COL.condutas }),
        cell(p.alertasPendencias, {
          fontSize: 13,
          bgColor: hasAlertaUrgente ? LIGHT_RED : bgColor,
          width: COL.alertas,
          bold: hasAlertaUrgente,
          color: hasAlertaUrgente ? "9B0000" : "000000",
        }),
      ],
    });
  });

  const patientTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [tituloHeader, headerRow, ...dataRows],
  });

  // Alerts table
  const alertTituloRow = new TableRow({
    height: { value: convertInchesToTwip(0.4), rule: HeightRule.EXACT },
    children: [
      new TableCell({
        columnSpan: 3,
        shading: { type: ShadingType.SOLID, color: RED_ALERT, fill: RED_ALERT },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: WHITE },
          bottom: { style: BorderStyle.NONE, size: 0, color: WHITE },
          left: { style: BorderStyle.NONE, size: 0, color: WHITE },
          right: { style: BorderStyle.NONE, size: 0, color: WHITE },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `ALERTAS CRÍTICOS — PRIORIDADES PARA O PLANTÃO`,
                bold: true,
                size: 22,
                color: WHITE,
                font: "Calibri",
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const alertHeaderRow = new TableRow({
    height: { value: convertInchesToTwip(0.3), rule: HeightRule.EXACT },
    tableHeader: true,
    children: [
      alertHeaderCell("PRIORIDADE", ALERT_COL.prioridade),
      alertHeaderCell("PACIENTE", ALERT_COL.paciente),
      alertHeaderCell("AÇÃO", ALERT_COL.acao),
    ],
  });

  const alertDataRows = data.alertasCriticos.map((a) => {
    const bg = getPrioridadeColor(a.prioridade);
    return new TableRow({
      children: [
        cell(a.prioridade, {
          bold: true,
          fontSize: 13,
          bgColor: bg,
          width: ALERT_COL.prioridade,
          align: AlignmentType.CENTER,
          vAlign: VerticalAlign.CENTER,
          color: a.prioridade.includes("URGENTE") ? "9B0000" : "000000",
        }),
        cell(a.paciente, { fontSize: 13, bgColor: bg, width: ALERT_COL.paciente }),
        cell(a.leito ? `[${a.leito}] ${a.acao}` : a.acao, {
          fontSize: 13,
          bgColor: bg,
          width: ALERT_COL.acao,
        }),
      ],
    });
  });

  const alertsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [alertTituloRow, alertHeaderRow, ...alertDataRows],
  });

  const doc = new Document({
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
          patientTable,
          new Paragraph({ text: "", spacing: { before: 200, after: 200 } }),
          alertsTable,
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 100 },
            children: [
              new TextRun({
                text: `Gerado em ${new Date().toLocaleString("pt-BR")}`,
                size: 12,
                color: "888888",
                font: "Calibri",
                italics: true,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
