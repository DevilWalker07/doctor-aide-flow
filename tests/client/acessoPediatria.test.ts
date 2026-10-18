import { beforeEach, describe, expect, it } from "vitest";
import {
  VALIDADE_ACESSO_MS,
  aparelhoLiberado,
  liberarAparelho,
  podeEntrarNaPediatria,
  revogarAparelho,
} from "../../src/lib/pediatria/acesso";

describe("acesso à emergência pediátrica", () => {
  beforeEach(() => localStorage.clear());

  it("sem Supabase configurado a aba é livre", () => {
    expect(podeEntrarNaPediatria({ configured: false, session: null })).toBe(true);
  });

  it("com Supabase, sem sessão e sem liberação, tranca", () => {
    expect(podeEntrarNaPediatria({ configured: true, session: null })).toBe(false);
  });

  it("sessão ativa entra", () => {
    expect(podeEntrarNaPediatria({ configured: true, session: { user: {} } })).toBe(true);
  });

  it("aparelho liberado entra sem sessão (offline, token vencido)", () => {
    const agora = 1_000_000;
    liberarAparelho("u1", agora);
    expect(podeEntrarNaPediatria({ configured: true, session: null }, agora + 3_600_000)).toBe(
      true,
    );
  });

  it("liberação vence em 30 dias", () => {
    const agora = 1_000_000;
    liberarAparelho("u1", agora);
    expect(aparelhoLiberado(agora + VALIDADE_ACESSO_MS - 1)).toBe(true);
    expect(aparelhoLiberado(agora + VALIDADE_ACESSO_MS + 1)).toBe(false);
  });

  it("sair revoga", () => {
    liberarAparelho("u1");
    revogarAparelho();
    expect(aparelhoLiberado()).toBe(false);
  });

  it("valor corrompido não libera", () => {
    localStorage.setItem("da_ped_acesso", "{lixo");
    expect(aparelhoLiberado()).toBe(false);
    localStorage.setItem("da_ped_acesso", JSON.stringify({ ate: Date.now() + 1e9 }));
    expect(aparelhoLiberado()).toBe(false);
  });
});
