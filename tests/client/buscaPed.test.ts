import { describe, expect, it } from "vitest";
import { buscar } from "../../src/lib/pediatria/busca";

const ids = (q: string) =>
  buscar(q).map((r) => `${r.tipo}:${"id" in r ? r.id : "aba" in r ? r.aba : "rcp"}`);

describe("busca única", () => {
  it("acha droga pelo genérico, comercial e sem acento", () => {
    expect(ids("adrenalina")[0]).toBe("droga:adrenalina-iv");
    expect(ids("esmeron")).toContain("droga:rocuronio");
    expect(ids("narcan")).toContain("droga:naloxona");
    expect(ids("cisatracurio")).toContain("droga:cisatracurio");
  });

  it("acha infusão, conduta e seção por palavra-chave", () => {
    expect(ids("noradrenalina")).toContain("infusao:noradrenalina");
    expect(ids("pericardiocentese")).toContain("causa:tamponamento");
    expect(ids("intoxicação")).toContain("causa:toxinas");
    expect(ids("tubo")).toContain("secao:iot");
    expect(ids("cardioversao")).toContain("secao:choque");
    expect(ids("parada")[0]).toBe("rcp:rcp");
  });

  it("casa pelo começo da palavra, não pelo meio", () => {
    expect(ids("pa")).toContain("secao:choque");
    expect(ids("ronio")).not.toContain("droga:rocuronio");
    expect(buscar("")).toEqual([]);
    expect(buscar("xyzw")).toEqual([]);
  });
});
