import { describe, expect, it } from "vitest";
import {
  checkDoseAnomalies,
  cockcroftGault,
  findingsToAlerts,
  flagLabOutliers,
  mergeAlerts,
  parseAtbString,
  parseLabString,
  parseVitalsFromText,
  runPatientGuardrails,
  validateVitals,
} from "../../server/services/clinicalGuardrails.js";
import {
  classifyLab,
  normalizeLabKey,
  renderThresholdsForPrompt,
} from "../../shared/medical/labThresholds.js";

describe("parseLabString", () => {
  it("entende vírgula decimal, milhar com ponto, setas e !!", () => {
    expect(
      parseLabString(
        "HB 9,2 / HT 28 / LEUCO 14.400 / CR 1,8 / PCR 87↑!! / K 5.8↑!! / Na 128↓ / PLAQ 45.000",
      ),
    ).toEqual({
      HB: 9.2,
      HT: 28,
      LEUCO: 14400,
      CR: 1.8,
      PCR: 87,
      K: 5.8,
      NA: 128,
      PLAQ: 45000,
    });
  });
  it("ignora chaves desconhecidas e mantém a primeira ocorrência", () => {
    expect(parseLabString("TGO 40 / CR 1,1 / CR 2,9")).toEqual({ CR: 1.1 });
  });
  it("aceita aliases com acento", () => {
    expect(normalizeLabKey("Sódio")).toBe("NA");
    expect(normalizeLabKey("Potássio")).toBe("K");
    expect(normalizeLabKey("XYZ")).toBeNull();
  });
});

describe("parseVitalsFromText", () => {
  it("extrai PA, FC, FR, SpO2, temperatura e glicemia", () => {
    expect(parseVitalsFromText("REG, PA 120x80 FC 88 FR 20 SAT 94% TAX 37,8 HGT 180")).toEqual({
      pas: 120,
      pad: 80,
      fc: 88,
      fr: 20,
      spo2: 94,
      temp: 37.8,
      glicemia: 180,
    });
  });
  it("aceita PA com barra", () => {
    expect(parseVitalsFromText("PA: 90/50")).toEqual({ pas: 90, pad: 50 });
  });
});

describe("validateVitals", () => {
  it("marca valores fisiologicamente implausíveis", () => {
    const f = validateVitals({ pas: 80, pad: 120, spo2: 30, fc: 88 });
    expect(f.map((x) => x.field)).toEqual(["vitals.spo2", "vitals.pa"]);
    expect(f.every((x) => x.severity === "critical")).toBe(true);
  });
  it("não reclama de valores normais", () => {
    expect(
      validateVitals({ pas: 120, pad: 80, fc: 70, fr: 16, spo2: 97, temp: 36.5, glicemia: 100 }),
    ).toEqual([]);
  });
});

describe("flagLabOutliers / classifyLab", () => {
  it("usa os limiares únicos (crítico e atenção)", () => {
    const f = flagLabOutliers("K 5,7 / CR 1,5 / HB 6,8 / NA 140");
    expect(f.map((x) => `${x.severity}:${x.field}`)).toEqual([
      "critical:lab.K",
      "warning:lab.CR",
      "critical:lab.HB",
    ]);
  });
  it("classifyLab respeita as faixas", () => {
    expect(classifyLab("NA", 128)).toEqual({ severity: "critical", direction: "low" });
    expect(classifyLab("NA", 133)).toEqual({ severity: "warning", direction: "low" });
    expect(classifyLab("NA", 140)).toEqual({ severity: null, direction: null });
    expect(classifyLab("PCR", 150)).toEqual({ severity: "critical", direction: "high" });
  });
  it("renderThresholdsForPrompt inclui os limiares críticos do prompt original", () => {
    const s = renderThresholdsForPrompt();
    expect(s).toContain("Hemoglobina < 7");
    expect(s).toContain("Sódio < 130 ou > 155");
    expect(s).toContain("Potássio < 3 ou > 5,5");
    expect(s).toContain("Lactato > 2");
    expect(s).toContain("PCR > 100");
  });
});

describe("antibióticos", () => {
  it("parseAtbString reconhece nome, dose, via, frequência e dia", () => {
    const [a, b, c] = parseAtbString(
      "MEROPENEM 1G EV 8/8H - D5/10\nAmoxicilina 500mg 8/8h (VO) — D2/7\nCIPROFLOXACINO D9",
    );
    expect(a).toMatchObject({
      nome: "MEROPENEM",
      doseValor: 1,
      doseUnidade: "g",
      via: "EV",
      frequencia: "8/8H",
      dia: 5,
      duracao: 10,
    });
    expect(b).toMatchObject({
      nome: "Amoxicilina",
      doseValor: 500,
      doseUnidade: "mg",
      via: "VO",
      dia: 2,
      duracao: 7,
    });
    expect(c).toMatchObject({ nome: "CIPROFLOXACINO", dia: 9 });
    expect(parseAtbString("SEM ATB")).toEqual([]);
  });
  it("checkDoseAnomalies sinaliza dose alta, duração > 21 d, D além do plano e D≥7 sem plano", () => {
    const msgs = checkDoseAnomalies("Vancomicina 8g EV 12/12h — D25/20\nCipro D9").map(
      (f) => f.message,
    );
    expect(msgs.some((m) => m.includes("acima do usual"))).toBe(true);
    expect(msgs.some((m) => m.includes("ultrapassa a duração"))).toBe(true);
    expect(msgs.some((m) => m.includes("sem duração planejada"))).toBe(true);
    expect(checkDoseAnomalies("Ceftriaxona 1g EV 12/12h — D3/7")).toEqual([]);
  });
});

describe("cockcroftGault", () => {
  it("calcula ClCr com fator feminino", () => {
    expect(cockcroftGault(80, 60, 1.5, "F")).toBeCloseTo(28.3, 1);
    expect(cockcroftGault(80, 60, 1.5, "M")).toBeCloseTo(33.3, 1);
    expect(Number.isNaN(cockcroftGault(0, 60, 1.5, "M"))).toBe(true);
  });
});

describe("runPatientGuardrails / findingsToAlerts / mergeAlerts", () => {
  it("combina lab, ATB, sinais vitais e ClCr", () => {
    const f = runPatientGuardrails({
      laboratorio: "CR 2,4 / K 6,1",
      antibioticos: "Vanco 8g EV",
      quadro: "PA 70x110",
      idade: 82,
      peso: 55,
      sexo: "F",
    });
    const alerts = findingsToAlerts(f);
    expect(alerts.some((a) => a.startsWith("[CRÍTICO] POTÁSSIO"))).toBe(true);
    expect(alerts.some((a) => a.includes("CLCR ESTIMADO"))).toBe(true);
    expect(alerts.some((a) => a.includes("DIASTÓLICA"))).toBe(true);
    expect(findingsToAlerts(f, true).every((a) => a.startsWith("[CRÍTICO]"))).toBe(true);
  });
  it("mergeAlerts deduplica ignorando caixa", () => {
    expect(mergeAlerts(["A", "b"], ["a", "C"])).toEqual(["A", "b", "C"]);
  });
});
