import { describe, expect, it } from "vitest";
import { leitoCurto, nomeExibicao, plural } from "../../src/lib/format";

describe("nomeExibicao", () => {
  it("converte o nome em caixa alta do banco para leitura", () => {
    expect(nomeExibicao("MANOEL PEDRO FILHO")).toBe("Manoel Pedro Filho");
  });

  it("mantém partículas em minúscula no meio do nome", () => {
    expect(nomeExibicao("MARIA DAS GRAÇAS DE SOUZA")).toBe("Maria das Graças de Souza");
  });

  it("não rebaixa uma partícula que abre o nome", () => {
    expect(nomeExibicao("DA SILVA JUNIOR")).toBe("Da Silva Junior");
  });

  it("capitaliza depois de hífen e apóstrofo", () => {
    expect(nomeExibicao("ANA-MARIA D'ÁVILA")).toBe("Ana-Maria D'Ávila");
  });

  it("preserva acentuação do português", () => {
    expect(nomeExibicao("CONCEIÇÃO ANTÔNIA")).toBe("Conceição Antônia");
  });

  it("normaliza espaços sobrando", () => {
    expect(nomeExibicao("  JOÃO   PAULO  ")).toBe("João Paulo");
  });

  it("devolve string vazia para ausente", () => {
    expect(nomeExibicao(null)).toBe("");
    expect(nomeExibicao(undefined)).toBe("");
    expect(nomeExibicao("   ")).toBe("");
  });
});

describe("leitoCurto", () => {
  it("remove o prefixo L que a extração adiciona", () => {
    expect(leitoCurto("L01")).toBe("01");
    expect(leitoCurto("l7")).toBe("7");
  });

  it("não mexe quando o L não é prefixo de número", () => {
    // O replace antigo era global e transformava "UTI-L3" em "UTI-3".
    expect(leitoCurto("UTI-L3")).toBe("UTI-L3");
    expect(leitoCurto("LEITO EXTRA")).toBe("LEITO EXTRA");
  });

  it("marca leito ausente em vez de deixar vazio", () => {
    expect(leitoCurto("")).toBe("—");
    expect(leitoCurto(null)).toBe("—");
  });
});

describe("plural", () => {
  it("usa o singular para exatamente um", () => {
    expect(plural(1, "paciente", "pacientes")).toBe("1 paciente");
  });

  it("usa o plural para zero e para vários", () => {
    expect(plural(0, "paciente", "pacientes")).toBe("0 pacientes");
    expect(plural(3, "paciente", "pacientes")).toBe("3 pacientes");
  });
});
