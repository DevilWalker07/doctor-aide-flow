import { afterEach, describe, expect, it } from "vitest";
import {
  VALIDADE_MS,
  apagarSessao,
  carregarSessao,
  comEvento,
  compressorDaVez,
  novaSessao,
  salvarSessao,
} from "../../src/lib/pediatria/sessaoRcp";
import {
  desfecho,
  gerarRelatorioPdf,
  nomeArquivoRelatorio,
  textoRegistro,
} from "../../src/lib/pediatria/relatorioRcp";

const T0 = Date.UTC(2026, 9, 17, 22, 40, 0);
const paciente = {
  peso: 11,
  pesoEstimado: false,
  idade: { anos: 1, meses: 0, dias: 0 },
  alturaCm: null,
};

afterEach(() => apagarSessao());

describe("sessão de RCP no aparelho", () => {
  it("salva e retoma com o relógio absoluto intacto", () => {
    let s = novaSessao(T0, paciente);
    s = comEvento(
      { ...s, adrenalinas: 1, ultimaAdrenalina: T0 + 60_000 },
      T0 + 60_000,
      "Adrenalina 1",
    );
    salvarSessao(s);

    const r = carregarSessao(T0 + 5 * 60_000);
    expect(r).not.toBeNull();
    expect(r!.inicio).toBe(T0);
    expect(r!.ultimaAdrenalina).toBe(T0 + 60_000);
    expect(r!.eventos.map((e) => e.texto)).toEqual(["RCP iniciada", "Adrenalina 1"]);
    expect(r!.eventos[1].t).toBe(60_000);
    expect(r!.paciente?.peso).toBe(11);
  });

  it("descarta sessão velha, corrompida ou apagada", () => {
    salvarSessao(novaSessao(T0, null));
    expect(carregarSessao(T0 + VALIDADE_MS + 1)).toBeNull();

    localStorage.setItem("da_rcp_sessao", "{não é json");
    expect(carregarSessao(T0)).toBeNull();

    localStorage.setItem("da_rcp_sessao", JSON.stringify({ versao: 99 }));
    expect(carregarSessao(T0)).toBeNull();

    salvarSessao(novaSessao(T0, null));
    apagarSessao();
    expect(carregarSessao(T0)).toBeNull();
  });

  it("completa sessões antigas sem equipe", () => {
    const { equipe: _equipe, ...semEquipe } = novaSessao(T0, null);
    localStorage.setItem("da_rcp_sessao", JSON.stringify(semEquipe));
    expect(carregarSessao(T0)?.equipe.lider).toBe("");
  });

  it("alterna o compressor a cada ciclo", () => {
    const s = novaSessao(T0, null);
    const equipe = { ...s.equipe, compressorA: "Ana", compressorB: "Bruno" };
    expect(compressorDaVez({ ciclo: 0, equipe })).toBe("Ana");
    expect(compressorDaVez({ ciclo: 1, equipe })).toBe("Bruno");
    expect(compressorDaVez({ ciclo: 2, equipe })).toBe("Ana");
    expect(compressorDaVez({ ciclo: 1, equipe: s.equipe })).toBeNull();
  });
});

describe("registro para o prontuário", () => {
  const encerrada = () => {
    let s = novaSessao(T0, paciente);
    s = { ...s, equipe: { ...s.equipe, lider: "Dr. Luan", compressorA: "Ana" } };
    s = comEvento({ ...s, choques: 1 }, T0 + 130_000, "Choque 1: 22 J (2 J/kg)");
    s = comEvento(
      { ...s, fase: "fim", fim: { em: T0 + 300_000, resultado: "rce" } },
      T0 + 300_000,
      "RCE",
    );
    return s;
  };

  it("texto traz equipe, tempo de cada evento e desfecho", () => {
    const t = textoRegistro(encerrada(), T0 + 400_000);
    expect(t).toContain("11 kg");
    expect(t).toContain("Líder: Dr. Luan");
    expect(t).toContain("(02:10)  Choque 1: 22 J");
    expect(t).toContain("Duração: 05:00");
    expect(t).toContain("Retorno da circulação espontânea");
  });

  it("PDF é gerado com nome datado", () => {
    const s = encerrada();
    const pdf = gerarRelatorioPdf(s, T0 + 400_000).output();
    expect(pdf.startsWith("%PDF")).toBe(true);
    expect(pdf).toContain("Registro de RCP");
    expect(nomeArquivoRelatorio(s)).toMatch(/^rcp-pediatrica_2026-10-1[78]_\d\dh\d\d\.pdf$/);
    expect(desfecho(novaSessao(T0, null))).toBe("Em andamento");
  });
});
