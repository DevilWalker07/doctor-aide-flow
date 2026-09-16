import { describe, expect, it } from "vitest";
import { cidVisivel, corpoAtestado, tituloAtestado } from "../../src/lib/documentos/atestado";
import type { AtestadoDocumento } from "../../src/lib/documentos/types";

function doc(over: Partial<AtestadoDocumento> = {}): AtestadoDocumento {
  return {
    paciente: { pacienteId: null, nome: "MARIA DE SOUZA", idade: "42", sexo: "F" },
    finalidade: "afastamento",
    dias: "3",
    dataInicio: "16/09/2026",
    horaInicio: "",
    horaFim: "",
    acompanhado: "",
    cid: "",
    cidAutorizado: false,
    observacoes: "",
    data: "16/09/2026",
    ...over,
  };
}

describe("CID no atestado", () => {
  it("não expõe o CID sem autorização do paciente", () => {
    const d = doc({ cid: "J18.9", cidAutorizado: false });
    expect(cidVisivel(d)).toBeNull();
    expect(corpoAtestado(d)).not.toContain("J18.9");
  });

  it("inclui o CID quando o paciente autorizou", () => {
    const d = doc({ cid: "J18.9", cidAutorizado: true });
    expect(cidVisivel(d)).toBe("J18.9");
    expect(corpoAtestado(d)).toContain("J18.9");
    expect(corpoAtestado(d)).toContain("autorização do paciente");
  });

  it("ignora autorização marcada com CID em branco", () => {
    expect(cidVisivel(doc({ cid: "   ", cidAutorizado: true }))).toBeNull();
  });
});

describe("corpo do atestado por finalidade", () => {
  it("afastamento usa plural correto e a data de início", () => {
    expect(corpoAtestado(doc({ dias: "3" }))).toContain("por 3 dias, a contar de 16/09/2026");
    expect(corpoAtestado(doc({ dias: "1" }))).toContain("por 1 dia");
  });

  it("afastamento sem dias válidos não gera documento", () => {
    expect(corpoAtestado(doc({ dias: "" }))).toBe("");
    expect(corpoAtestado(doc({ dias: "0" }))).toBe("");
    expect(corpoAtestado(doc({ dias: "abc" }))).toBe("");
  });

  it("comparecimento inclui o intervalo de horário quando informado", () => {
    const texto = corpoAtestado(
      doc({ finalidade: "comparecimento", horaInicio: "08:00", horaFim: "10:00" }),
    );
    expect(texto).toContain("compareceu a consulta médica em 16/09/2026, das 08:00 às 10:00");
  });

  it("comparecimento com apenas a hora inicial usa 'às'", () => {
    const texto = corpoAtestado(doc({ finalidade: "comparecimento", horaInicio: "08:00" }));
    expect(texto).toContain("às 08:00");
    expect(texto).not.toContain("das");
  });

  it("acompanhante exige o nome de quem foi acompanhado", () => {
    expect(corpoAtestado(doc({ finalidade: "acompanhante" }))).toBe("");
    expect(
      corpoAtestado(doc({ finalidade: "acompanhante", acompanhado: "JOÃO DE SOUZA" })),
    ).toContain("como acompanhante de JOÃO DE SOUZA");
  });

  it("aptidão física não depende de data nem de dias", () => {
    const texto = corpoAtestado(doc({ finalidade: "atividade-fisica", dias: "", dataInicio: "" }));
    expect(texto).toContain("apto(a) para a prática de atividade física");
  });

  it("sem nome do paciente não gera documento", () => {
    expect(corpoAtestado(doc({ paciente: { pacienteId: null, nome: "  " } }))).toBe("");
  });

  it("anexa as observações como parágrafo próprio", () => {
    const texto = corpoAtestado(doc({ observacoes: "Retorno em 7 dias." }));
    expect(texto.split("\n\n").at(-1)).toBe("Retorno em 7 dias.");
  });
});

describe("tituloAtestado", () => {
  it("identifica finalidade e paciente", () => {
    expect(tituloAtestado(doc())).toBe("Atestado — Afastamento — MARIA DE SOUZA");
  });

  it("funciona sem nome preenchido", () => {
    expect(tituloAtestado(doc({ paciente: { pacienteId: null, nome: "" } }))).toBe(
      "Atestado — Afastamento",
    );
  });
});
