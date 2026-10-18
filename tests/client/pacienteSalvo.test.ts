import { afterEach, describe, expect, it } from "vitest";
import {
  carregarAba,
  carregarPaciente,
  salvarAba,
  salvarPaciente,
} from "../../src/lib/pediatria/pacienteSalvo";

const p = {
  peso: 14,
  pesoEstimado: true,
  idade: { anos: 3, meses: 0, dias: 0 },
  alturaCm: null,
  sexo: "F" as const,
};

afterEach(() => localStorage.clear());

describe("criança e aba lembradas no aparelho", () => {
  it("salva, carrega e expira em 12 h", () => {
    salvarPaciente(p, 1_000);
    expect(carregarPaciente(1_000 + 60_000)).toEqual(p);
    expect(carregarPaciente(1_000 + 13 * 3_600_000)).toBeNull();
    salvarPaciente(null);
    expect(carregarPaciente()).toBeNull();
  });

  it("ignora dado corrompido e aba desconhecida", () => {
    localStorage.setItem("da_ped_paciente", "{x");
    expect(carregarPaciente()).toBeNull();
    expect(carregarAba()).toBe("drogas");
    salvarAba("iot");
    expect(carregarAba()).toBe("iot");
    localStorage.setItem("da_ped_aba", "qualquer");
    expect(carregarAba()).toBe("drogas");
  });
});
