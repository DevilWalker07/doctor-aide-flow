import { describe, expect, it } from "vitest";
import { DROGAS_BOLUS } from "../../shared/pediatria/drogas.js";
import {
  calcularBolus,
  energiaChoque,
  energiaDesfibrilacaoN,
  formatarMl,
  pesoDestoaDaIdade,
  pesoEstimado,
  superficieCorporal,
} from "../../shared/pediatria/calculos.js";
import {
  DROGAS_INFUSAO,
  doseParaVazao,
  montarSeringa,
  seringaPreparada,
  textoPrescricao,
  vazaoParaDose,
} from "../../shared/pediatria/infusoes.js";
import { sinaisVitais } from "../../shared/pediatria/sinaisVitais.js";
import { viaAerea } from "../../shared/pediatria/viaAerea.js";
import { estadoAdrenalina, formatarTempo, sugestoes } from "../../shared/pediatria/pcr.js";

const droga = (id: string) => {
  const d = DROGAS_BOLUS.find((x) => x.id === id);
  if (!d) throw new Error(id);
  return d;
};
const umAno = { anos: 1, meses: 0, dias: 0 };

/**
 * Teste de ouro: criança de 11 kg / 1 ano, coluna "Total - ml" da planilha.
 * Adenosina diverge de propósito: a planilha mostra 0,363/0,726 mL, mas
 * 0,1 × 11 ÷ 3 = 0,367 — o código faz a conta exata.
 */
describe("ficha de parada — 11 kg, igual à planilha", () => {
  const esperado: Record<string, number> = {
    "adrenalina-iv": 1.1,
    "adrenalina-im": 0.11,
    "adrenalina-et": 1.1,
    "adenosina-1": 1.1 / 3,
    "adenosina-2": 2.2 / 3,
    amiodarona: 1.1,
    atropina: 1.1,
    bicarbonato: 22,
    "cetamina-iv": 1.1,
    "cetamina-im": 1.1,
    cisatracurio: 1.1,
    "diazepam-iv": 1.1,
    "diazepam-vr": 1.1,
    fentanil: 2.2,
    flumazenil: 1.1,
    "glicose-25": 22,
    "gluconato-calcio": 22,
    lidocaina: 1.1,
    "midazolam-iv": 1.1,
    "midazolam-in": 1.1,
    morfina: 1.1,
    naloxona: 5.5,
    neostigmina: 1.54,
    pancuronio: 1.1,
    propofol: 1.1,
    rocuronio: 1.1,
  };

  it("cobre as 26 drogas da planilha", () => {
    expect(DROGAS_BOLUS).toHaveLength(26);
    expect(Object.keys(esperado).sort()).toEqual(DROGAS_BOLUS.map((d) => d.id).sort());
  });

  for (const [id, ml] of Object.entries(esperado)) {
    it(`${id}: ${ml.toFixed(3)} mL`, () => {
      expect(calcularBolus(droga(id), 11).volumeMl).toBeCloseTo(ml, 6);
    });
  }

  it("adrenalina IV: 0,11 mg, diluição 1 + 9 mL, seringa de 3 mL", () => {
    const r = calcularBolus(droga("adrenalina-iv"), 11);
    expect(r.dose).toBeCloseTo(0.11, 6);
    expect(r.preparo).toEqual({ drogaMl: 1, diluenteMl: 9 });
    expect(r.seringaMl).toBe(3);
    expect(r.atingiuTeto).toBe(false);
  });
});

describe("teto de dose", () => {
  it("adrenalina IM trava em 0,5 mL (0,5 mg) a partir de 50 kg", () => {
    const r = calcularBolus(droga("adrenalina-im"), 60);
    expect(r.volumeMl).toBe(0.5);
    expect(r.dose).toBeCloseTo(0.5, 6);
    expect(r.atingiuTeto).toBe(true);
    expect(r.volumeCalculadoMl).toBeCloseTo(0.6, 6);
  });

  it("adrenalina endotraqueal trava em 2,5 mL acima de 25 kg", () => {
    const r = calcularBolus(droga("adrenalina-et"), 30);
    expect(r.volumeMl).toBe(2.5);
    expect(r.atingiuTeto).toBe(true);
  });

  it("droga sem teto definido não é limitada", () => {
    const r = calcularBolus(droga("propofol"), 70);
    expect(r.atingiuTeto).toBe(false);
    expect(r.volumeMl).toBeCloseTo(7, 6);
  });
});

describe("choque", () => {
  it("cardioversão e desfibrilação de 11 kg batem com a planilha", () => {
    expect([0.5, 1, 2].map((j) => energiaChoque(j, 11).joules)).toEqual([5, 11, 22]);
    expect([1, 2, 3, 4, 5].map((n) => energiaDesfibrilacaoN(n, 11).joules)).toEqual([
      22, 44, 66, 88, 110,
    ]);
  });

  it("arredonda para baixo e respeita o teto de 200 J", () => {
    expect(energiaChoque(2, 10.7).joules).toBe(21);
    const r = energiaDesfibrilacaoN(5, 40);
    expect(r.joules).toBe(200);
    expect(r.atingiuTeto).toBe(true);
    expect(energiaDesfibrilacaoN(9, 11).joules).toBe(110);
  });
});

describe("dados derivados", () => {
  it("superfície corporal de 11 kg = 0,505 m² (planilha)", () => {
    expect(superficieCorporal(11)).toBeCloseTo(0.50495, 4);
    expect(superficieCorporal(11, 76)).toBeCloseTo(Math.sqrt((76 * 11) / 3600), 6);
  });

  it("peso estimado: 10,5 kg aos 12 meses (planilha) e fórmulas por faixa", () => {
    expect(pesoEstimado({ anos: 0, meses: 12, dias: 0 })).toBe(10.5);
    expect(pesoEstimado({ anos: 0, meses: 11, dias: 0 })).toBe(10);
    expect(pesoEstimado({ anos: 0, meses: 6, dias: 0 })).toBe(7.5);
    expect(pesoEstimado(umAno)).toBe(10.5);
    expect(pesoEstimado({ anos: 2, meses: 0, dias: 0 })).toBe(12);
    expect(pesoEstimado({ anos: 5, meses: 0, dias: 0 })).toBe(18);
    expect(pesoEstimado({ anos: 10, meses: 0, dias: 0 })).toBe(32.5);
    expect(pesoEstimado({ anos: 14, meses: 0, dias: 0 })).toBeNull();
  });

  it("acusa peso que destoa da idade", () => {
    expect(pesoDestoaDaIdade(25, umAno)).toBe(true);
    expect(pesoDestoaDaIdade(11, umAno)).toBe(false);
    expect(pesoDestoaDaIdade(25, null)).toBe(false);
  });

  it("via aérea por idade", () => {
    expect(viaAerea(umAno)).toMatchObject({ tuboComCuff: 3.5, tuboSemCuff: 4 });
    expect(viaAerea({ anos: 6, meses: 0, dias: 0 })).toMatchObject({
      tuboComCuff: 5,
      tuboSemCuff: 5.5,
      profundidadeCm: 15,
    });
    expect(viaAerea({ anos: 0, meses: 0, dias: 10 }).avisoNeonato).toBe(true);
  });

  it("sinais vitais de 1 ano = os da planilha", () => {
    expect(sinaisVitais(umAno)).toMatchObject({
      fc: [98, 140],
      fr: [22, 37],
      pas: [86, 106],
      pad: [42, 63],
      pam: [49, 62],
    });
  });
});

describe("infusões contínuas", () => {
  const nora = DROGAS_INFUSAO.find((d) => d.id === "noradrenalina")!;
  const dex = DROGAS_INFUSAO.find((d) => d.id === "dexmedetomidina")!;

  it("cobre as 13 drogas da planilha", () => {
    expect(DROGAS_INFUSAO).toHaveLength(13);
  });

  it("noradrenalina 0,05 mcg/kg/min, 11 kg, 2 mL/h, seringa de 50 mL", () => {
    const s = montarSeringa(nora, 1000, 0.05, 11, 2, 50);
    expect(s.drogaMl).toBeCloseTo(0.825, 6);
    expect(s.diluenteMl).toBeCloseTo(49.175, 6);
    expect(s.concentracao).toBeCloseTo(16.5, 6);
    expect(s.invalida).toBe(false);
  });

  it("dose e vazão são inversas", () => {
    const s = montarSeringa(nora, 1000, 0.3, 11, 2, 50);
    expect(vazaoParaDose(0.3, 11, "mcg/kg/min", s.concentracao)).toBeCloseTo(2, 6);
    expect(doseParaVazao(4, 11, "mcg/kg/min", s.concentracao)).toBeCloseTo(0.6, 6);
  });

  it("dexmedetomidina padrão 2 + 48 mL = 4 mcg/mL", () => {
    const s = seringaPreparada(dex.apresentacao, 2, 50);
    expect(s.concentracao).toBe(4);
    expect(vazaoParaDose(0.5, 11, "mcg/kg/h", s.concentracao)).toBeCloseTo(1.375, 6);
  });

  it("seringa que não cabe é inválida", () => {
    expect(montarSeringa(nora, 1000, 2, 40, 0.5, 50).invalida).toBe(true);
  });

  it("gera texto de prescrição sem #N/A", () => {
    const s = montarSeringa(nora, 1000, 0.05, 11, 2, 50);
    const t = textoPrescricao({
      droga: nora,
      apresentacaoTexto: "1 mg/mL",
      seringa: s,
      vazao: 2,
      dose: 0.05,
      diluente: "SF 0,9%",
    });
    expect(t).toBe(
      "Noradrenalina (1 mg/mL) 0,83 mL + SF 0,9% 49,2 mL (total 50 mL; 16,5 mcg/mL). " +
        "Infundir em bomba a 2 mL/h = 0,05 mcg/kg/min.",
    );
  });
});

describe("PCR", () => {
  it("janela da adrenalina: 3 a 5 min", () => {
    expect(estadoAdrenalina(null)).toBe("pode");
    expect(estadoAdrenalina(2 * 60_000)).toBe("aguardando");
    expect(estadoAdrenalina(4 * 60_000)).toBe("pode");
    expect(estadoAdrenalina(6 * 60_000)).toBe("atrasada");
  });

  it("ritmo chocável: adrenalina após o 2º choque, amiodarona após o 3º", () => {
    const base = {
      ritmo: "chocavel" as const,
      adrenalinas: 0,
      amiodaronas: 0,
      adrenalinaLiberada: true,
    };
    expect(sugestoes({ ...base, choques: 1 }).join(" ")).not.toMatch(/Adrenalina/);
    expect(sugestoes({ ...base, choques: 2 }).join(" ")).toMatch(/Adrenalina/);
    expect(sugestoes({ ...base, choques: 2 }).join(" ")).not.toMatch(/Amiodarona/);
    expect(sugestoes({ ...base, choques: 3 }).join(" ")).toMatch(/Amiodarona/);
  });

  it("formata o cronômetro", () => {
    expect(formatarTempo(125_400)).toBe("02:05");
    expect(formatarMl(1.1)).toBe("1,1");
    expect(formatarMl(1.1 / 3)).toBe("0,37");
  });
});

describe("kits do modo RCP", () => {
  it("magnésio: 50 mg/kg, teto de 2 g (4 mL a 50%)", async () => {
    const { MAGNESIO } = await import("../../shared/pediatria/kits.js");
    expect(calcularBolus(MAGNESIO, 11).volumeMl).toBeCloseTo(1.1, 6);
    const r = calcularBolus(MAGNESIO, 50);
    expect(r.volumeMl).toBe(4);
    expect(r.dose).toBe(2000);
    expect(r.atingiuTeto).toBe(true);
  });

  it("todos os itens dos kits apontam para drogas existentes", async () => {
    const k = await import("../../shared/pediatria/kits.js");
    for (const kit of [k.KIT_INTUBACAO, k.KIT_SEDOANALGESIA, k.KIT_CARDIOVERSAO, k.KIT_OUTRAS]) {
      expect(kit.length).toBeGreaterThan(0);
      for (const it of kit) expect(it.droga.dosePorKg).toBeGreaterThan(0);
    }
    expect(k.KIT_INTUBACAO.map((i) => i.droga.id)).toContain("rocuronio");
  });
});
