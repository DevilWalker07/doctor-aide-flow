import { describe, expect, it } from "vitest";
import {
  brParaISO,
  diaSeguinte,
  diasDeInternacao,
  isoParaBR,
  lerDataBR,
  normalizarDataBR,
} from "../../../shared/passagem/datas.js";
import { lerNomeDoArquivo, numeroDoLeito } from "../../../shared/passagem/nomeArquivo.js";
import { juntarLeitos, type ResultadoLeito } from "../../../shared/passagem/juntar.js";
import type { LinhaMapa } from "../../../shared/passagem/tipos.js";

describe("datas", () => {
  it("lê DD/MM/AAAA, DD/MM/AA e outros separadores", () => {
    expect(normalizarDataBR("19/09/26")).toBe("19/09/2026");
    expect(normalizarDataBR("9.9.2026")).toBe("09/09/2026");
    expect(normalizarDataBR("14-08-2026")).toBe("14/08/2026");
  });
  it("recusa data que não existe", () => {
    expect(lerDataBR("31/02/2026")).toBeNull();
    expect(normalizarDataBR("sem data")).toBeNull();
  });
  it("converte ISO do seletor de data e volta", () => {
    expect(isoParaBR("2026-09-25")).toBe("25/09/2026");
    expect(brParaISO("25/09/2026")).toBe("2026-09-25");
    expect(diaSeguinte("30/09/2026")).toBe("01/10/2026");
  });
  it("DI é contado em código: o dia da admissão é o D1", () => {
    expect(diasDeInternacao("25/09/2026", "25/09/2026")).toBe(1);
    expect(diasDeInternacao("09/09/26", "19/09/2026")).toBe(11);
    expect(diasDeInternacao("14/08/2026", "19/09/2026")).toBe(37);
  });
  it("DIH depois do plantão ou ilegível → sem DI, nunca número inventado", () => {
    expect(diasDeInternacao("26/09/2026", "25/09/2026")).toBeNull();
    expect(diasDeInternacao("[ilegível]", "25/09/2026")).toBeNull();
  });
});

describe("nome do arquivo (conferência, não fonte)", () => {
  it.each([
    ["L01-_ALOIZIO_VIEIRA_SILVA_18.09.26.docx", "L01", "ALOIZIO VIEIRA SILVA", "18/09/2026"],
    ["L05_-_MISSENO_EDUARDO_18.09.2026.docx", "L05", "MISSENO EDUARDO", "18/09/2026"],
    ["L04 - NARCISO BATISTA CRUZ. 24.04.pdf", "L04", "NARCISO BATISTA CRUZ", null],
    ["ISO 12 - GABRIEL CORDEIRO.docx", "ISO 12", "GABRIEL CORDEIRO", null],
    ["evolucao joao.docx", null, "EVOLUCAO JOAO", null],
  ])("%s", (arquivo, leito, nome, data) => {
    expect(lerNomeDoArquivo(arquivo)).toEqual({ leito, nome, data });
  });
  it("número do leito compara formatos diferentes", () => {
    expect(numeroDoLeito("LEITO 05")).toBe(5);
    expect(numeroDoLeito("L05")).toBe(numeroDoLeito("05"));
    expect(numeroDoLeito("sem")).toBeNull();
  });
});

describe("juntar leitos", () => {
  const linha = (leito: string, paciente = "X"): LinhaMapa => ({
    leito,
    paciente,
    dih: "",
    di: null,
    diagnostico: "",
    quadroAtual: "",
    atb: "",
    ultimoLab: "",
    condutasHoje: "",
    alertasPendencias: "",
    dispositivos: null,
    anotacoesVisita: "",
    resumoLinha: "",
    sugestoesClinicas: [],
  });
  const r = (arquivo: string, leito: string, paciente?: string): ResultadoLeito => ({
    arquivo,
    linha: linha(leito, paciente),
    alertas: [],
  });

  it("ordena pelo número do leito, isolamento no fim", () => {
    const { mapa } = juntarLeitos([r("a", "ISO 12"), r("b", "L10"), r("c", "L02")]);
    expect(mapa.pacientes.map((p) => p.leito)).toEqual(["L02", "L10", "ISO 12"]);
  });
  it("leito duplicado: fica o primeiro e o segundo vira aviso com o nome do arquivo", () => {
    const { mapa, avisos } = juntarLeitos([r("um.docx", "L05", "A"), r("dois.docx", "l 05", "B")]);
    expect(mapa.pacientes).toHaveLength(1);
    expect(mapa.pacientes[0].paciente).toBe("A");
    expect(avisos[0]).toContain("dois.docx");
    expect(avisos[0]).toContain("um.docx");
  });
  it("deduplica alertas por leito e ação", () => {
    const a = { prioridade: "!! URGENTE" as const, leito: "L1", paciente: "X", acao: "Repetir K" };
    const { mapa } = juntarLeitos([
      { ...r("a", "L1"), alertas: [a, { ...a, acao: "repetir k" }, { ...a, acao: "Outra" }] },
    ]);
    expect(mapa.alertasCriticos).toHaveLength(2);
  });
});
