import { describe, expect, it } from "vitest";
import mammoth from "mammoth";
import { Packer } from "docx";
import {
  linhaResumoEnfermarias,
  montarMapaDocx,
  nomeDoArquivoMapa,
  GRUPOS_LEITO_PADRAO,
  type OpcoesMapa,
} from "../../../shared/passagem/docx.js";
import type { CabecalhoMapa, Consolidacao, MapaPlantaoData } from "../../../shared/passagem/tipos.js";

/** Mesma assinatura do gerador antigo, para os testes migrados lerem igual. */
async function gerarMapaPlantaoDocx(
  mapa: MapaPlantaoData,
  setor: string,
  dataPlantao: string,
  cabecalho?: CabecalhoMapa,
  extra: Partial<OpcoesMapa> = {},
): Promise<Buffer> {
  return Packer.toBuffer(montarMapaDocx(mapa, { setor, dataPlantao, cabecalho, ...extra }));
}

/**
 * As colunas do mapa, conferidas abrindo o DOCX gerado.
 *
 * O formato vem do modelo que o médico usa no hospital. Antes daqui, LEITO e
 * PACIENTE eram uma coluna só e havia uma "ANOTAÇÕES VISITA MULTI" que eu
 * inventei e não existe no mapa de verdade.
 */
const base = {
  dih: "20/07/2026",
  di: 14,
  diagnostico: "Pé diabético",
  quadroAtual: "ESTÁVEL —",
  atb: "Sem ATB",
  ultimoLab: "Sem lab recente",
  condutasHoje: "",
  alertasPendencias: "",
  dispositivos: null,
  anotacoesVisita: "",
  resumoLinha: "",
  sugestoesClinicas: [] as string[],
};

const dados: MapaPlantaoData = {
  pacientes: [
    {
      leito: "L04",
      paciente: "WILSON JESUINO LIMA",
      dih: "20/07/2026",
      di: 14,
      diagnostico: "Pé diabético, DRC dialítica",
      quadroAtual: "INSTÁVEL — plaquetopenia nova.",
      atb: "Cefepime 2g EV 12/12h — D4/7",
      ultimoLab: "Plaq 102 mil↓!!, Cr 3,1↑",
      condutasHoje: "- Suspenso HNF e AAS",
      alertasPendencias: "!! Plaquetopenia 102 mil\n— PENDÊNCIAS —\n- Repetir plaquetas hoje",
      dispositivos: "FAV (2024)",
      anotacoesVisita: "",
      resumoLinha: "WILSON – DRC DIALÍTICO, NOVO: PLAQUETOPENIA 102 MIL",
      sugestoesClinicas: [
        "Plaquetopenia 102 mil é achado novo — investigar etiologia medicamentosa.",
        "Repetir plaquetas hoje; trending é crítico.",
      ],
    },
    {
      ...base,
      leito: "L07",
      paciente: "JUVENAL PEREIRA LIMA",
      resumoLinha: "JUVENAL – PANCREATITE AGUDA",
      sugestoesClinicas: ["TC sem sinais de necrose — pancreatite edematosa."],
    },
    {
      ...base,
      leito: "ISO 12",
      paciente: "GABRIEL CORDEIRO",
      resumoLinha: "",
      sugestoesClinicas: [],
    },
  ],
  alertasCriticos: [
    {
      prioridade: "!! URGENTE",
      leito: "L04",
      paciente: "WILSON",
      acao: "Investigar plaquetopenia",
    },
  ],
};

async function texto(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

describe("colunas do mapa de passagem", () => {
  it("traz as sete colunas do modelo do hospital, na ordem", async () => {
    const t = await texto(await gerarMapaPlantaoDocx(dados, "CMM", "02/08/2026"));

    for (const coluna of [
      "LEITO",
      "PACIENTE / INFO",
      "DIAGNÓSTICOS",
      "ATB (D-ATUAL/D-TOTAL)",
      "ÚLTIMOS LABS",
      "CONDUTAS DE 02/08/2026",
      "ALERTAS / PENDÊNCIAS DO LEITO",
    ]) {
      expect(t, coluna).toContain(coluna);
    }
  });

  it("não traz a coluna que eu tinha inventado", async () => {
    const t = await texto(await gerarMapaPlantaoDocx(dados, "CMM", "02/08/2026"));
    expect(t).not.toContain("ANOTAÇÕES VISITA MULTI");
  });

  it("cabeçalho com hospital, período e para quando vai a passagem", async () => {
    const t = await texto(
      await gerarMapaPlantaoDocx(dados, "CMM", "02/08/2026", {
        hospital: "Hospital Nair Alves de Souza",
        periodo: "diurno",
        passagemPara: "03/08/2026",
      }),
    );
    expect(t).toContain("MAPA DE PASSAGEM DE PLANTÃO – CMM");
    expect(t).toContain("HOSPITAL NAIR ALVES DE SOUZA");
    expect(t).toContain("PLANTÃO DE 02/08/2026 (DIURNO)");
    // Sem travessão antes da seta: "(DIURNO) → PASSAGEM", como no modelo.
    expect(t).toContain("PLANTÃO DE 02/08/2026 (DIURNO) → PASSAGEM PARA 03/08/2026");
  });

  it("sem os campos de cabeçalho, não sobra travessão solto", async () => {
    const t = await texto(await gerarMapaPlantaoDocx(dados, "CMM", "02/08/2026"));
    expect(t).toContain("PLANTÃO DE 02/08/2026");
    expect(t).not.toMatch(/–\s*–/);
    expect(t).not.toContain("(UNDEFINED)");
  });

  it("o separador de pendências chega ao documento", async () => {
    const t = await texto(await gerarMapaPlantaoDocx(dados, "CMM", "02/08/2026"));
    expect(t).toContain("— PENDÊNCIAS —");
    expect(t).toContain("Repetir plaquetas hoje");
  });

  it("leito e paciente ficam em células separadas", async () => {
    const buffer = await gerarMapaPlantaoDocx(dados, "CMM", "02/08/2026");
    const { value: html } = await mammoth.convertToHtml({ buffer });
    // A célula do leito tem só o leito — o nome está na célula seguinte.
    // (A célula é negrito, então o conteúdo vem embrulhado em <strong>.)
    const celulaDoLeito = /<td[^>]*>\s*<p>\s*(<strong>)?\s*L04\s*(<\/strong>)?\s*<\/p>\s*<\/td>/;
    expect(html).toMatch(celulaDoLeito);
    expect(html).toContain("WILSON JESUINO LIMA");
    // E o nome não está grudado no leito na mesma célula. Só na tabela: na
    // folha de sugestões "L04 — WILSON" é um título, e ali é o formato certo.
    const tabela = html.slice(0, html.indexOf("FOLHA DE SUGESTÕES"));
    expect(tabela).not.toMatch(/L04[^<]*WILSON/);
  });

  it("agrupa os leitos por enfermaria, como no mapa do hospital", async () => {
    const t = await texto(await gerarMapaPlantaoDocx(dados, "CMM", "02/08/2026"));
    expect(t).toContain("ENFERMARIA 1 — LEITOS 01 A 05");
    expect(t).toContain("ENFERMARIA 2 — LEITOS 06 A 11");
    expect(t).toContain("ISOLAMENTOS — LEITOS 12 E 13");
    // A tarja vem antes do leito que ela cobre.
    expect(t.indexOf("ENFERMARIA 2 — LEITOS 06 A 11")).toBeLessThan(t.indexOf("JUVENAL"));
  });

  it("nenhum paciente some quando o leito não cai em faixa nenhuma", async () => {
    const semFaixa: MapaPlantaoData = {
      pacientes: [{ ...base, leito: "MACA CORREDOR", paciente: "SEM LEITO FIXO" }],
      alertasCriticos: [],
    };
    const t = await texto(await gerarMapaPlantaoDocx(semFaixa, "CMM", "02/08/2026"));
    expect(t).toContain("SEM LEITO FIXO");
    expect(t).not.toContain("ENFERMARIA 1");
  });
});

describe("folha de sugestões clínicas", () => {
  it("sai com o raciocínio por leito quando o modelo analisou", async () => {
    const t = await texto(await gerarMapaPlantaoDocx(dados, "CMM", "02/08/2026"));
    expect(t).toContain("FOLHA DE SUGESTÕES CLÍNICAS – ANÁLISE POR LEITO");
    expect(t).toContain("NÃO SUBSTITUEM AVALIAÇÃO À BEIRA-LEITO");
    expect(t).toContain("L04 — WILSON – DRC DIALÍTICO, NOVO: PLAQUETOPENIA 102 MIL");
    expect(t).toContain("• Repetir plaquetas hoje; trending é crítico.");
  });

  it("leito sem análise não entra na folha — nada é inventado", async () => {
    const t = await texto(await gerarMapaPlantaoDocx(dados, "CMM", "02/08/2026"));
    const folha = t.slice(t.indexOf("FOLHA DE SUGESTÕES CLÍNICAS"));
    expect(folha).not.toContain("GABRIEL CORDEIRO");
    expect(folha).toContain("JUVENAL");
  });

  it("sem nenhuma análise, a folha não sai em branco", async () => {
    const vazio: MapaPlantaoData = {
      pacientes: [{ ...base, leito: "L01", paciente: "ADMISSÃO NOVA" }],
      alertasCriticos: [],
    };
    const t = await texto(await gerarMapaPlantaoDocx(vazio, "CMM", "02/08/2026"));
    expect(t).not.toContain("FOLHA DE SUGESTÕES CLÍNICAS");
    expect(t).toContain("ADMISSÃO NOVA");
  });
});

describe("seções do modelo que o mapa antigo não tinha", () => {
  const consolidacao: Consolidacao = {
    prioridades: [
      { prioridade: "! HOJE", leito: "L07", paciente: "JUVENAL", texto: "Reavaliar dieta" },
      {
        prioridade: "!! URGENTE",
        leito: "L04",
        paciente: "WILSON",
        texto: "Plaquetopenia 102 mil — repetir hoje",
      },
    ],
    pendencias: {
      admissoesPendentes: [],
      labsAIncorporar: ["L04: plaquetas de hoje"],
      procedimentosAgendados: ["L07: TC de abdome amanhã"],
      altasEmProgramacao: [],
      avisosCriticos: [],
    },
  };

  it("linha-resumo das enfermarias sai debaixo do título, montada em código", async () => {
    const t = await texto(await gerarMapaPlantaoDocx(dados, "CMM", "02/08/2026"));
    expect(t).toContain("ENFERMARIA 1: L04 • ENFERMARIA 2: L07 • ISOLAMENTOS: ISO 12");
  });

  it("admissão de hoje sai como NOVO; leitos de imagem e não lidos são listados", () => {
    const r = linhaResumoEnfermarias(
      [
        { ...base, leito: "L01", paciente: "A", di: 1 },
        { ...base, leito: "L06", paciente: "B", lidoDeImagem: true },
      ],
      GRUPOS_LEITO_PADRAO,
      ["L03"],
    );
    expect(r).toBe("ENFERMARIA 1: L01 NOVO • ENFERMARIA 2: L06 | *LIDOS DE IMAGEM: L06 | *NÃO LIDOS: L03");
  });

  it("PRIORIDADES numeradas, urgente primeiro na ordem que a consolidação deu", async () => {
    const t = await texto(
      await gerarMapaPlantaoDocx(dados, "CMM", "02/08/2026", { passagemPara: "03/08/2026" }, { consolidacao }),
    );
    expect(t).toContain("PRIORIDADES PARA O PLANTÃO 03/08/2026");
    expect(t).toContain("1. JUVENAL (L07): Reavaliar dieta");
    expect(t).toContain("2. WILSON (L04): Plaquetopenia 102 mil — repetir hoje");
  });

  it("sem consolidação, prioridades vêm dos alertas dos leitos e pendências gerais dizem que falhou", async () => {
    const t = await texto(await gerarMapaPlantaoDocx(dados, "CMM", "02/08/2026"));
    expect(t).toContain("1. WILSON (L04): Investigar plaquetopenia");
    expect(t).toContain("Não foi possível consolidar as pendências gerais");
    expect(t).not.toContain("LABS RECENTES A INCORPORAR");
  });

  it("PENDÊNCIAS GERAIS numeradas só com as categorias que têm item", async () => {
    const t = await texto(
      await gerarMapaPlantaoDocx(dados, "CMM", "02/08/2026", { passagemPara: "03/08/2026" }, { consolidacao }),
    );
    expect(t).toContain("PENDÊNCIAS GERAIS – PLANTÃO 03/08/2026");
    expect(t).toContain("1. LABS RECENTES A INCORPORAR: L04: plaquetas de hoje");
    expect(t).toContain("2. PROCEDIMENTOS AGENDADOS: L07: TC de abdome amanhã");
    expect(t).not.toContain("ALTAS EM PROGRAMAÇÃO");
  });

  it("leito lido de imagem sai marcado para conferência", async () => {
    const t = await texto(
      await gerarMapaPlantaoDocx(
        { pacientes: [{ ...base, leito: "L02", paciente: "FOTO", lidoDeImagem: true }], alertasCriticos: [] },
        "CMM",
        "02/08/2026",
      ),
    );
    expect(t).toContain("LIDO DE IMAGEM — CONFIRA VALORES");
  });

  it("avisos de leito não lido vêm antes da tabela", async () => {
    const t = await texto(
      await gerarMapaPlantaoDocx(dados, "CMM", "02/08/2026", undefined, {
        avisos: ["L03 (L03-FULANO.docx) não foi lido: tempo esgotado"],
      }),
    );
    expect(t.indexOf("LEIA ANTES DE USAR")).toBeLessThan(t.indexOf("MAPA DE PASSAGEM"));
    expect(t).toContain("L03 (L03-FULANO.docx) não foi lido");
  });

  it("nome do arquivo baixado", () => {
    expect(nomeDoArquivoMapa("cmm", "02/08/2026")).toBe("MAPA_PASSAGEM_CMM_02-08-2026.docx");
  });
});
