import { describe, expect, it } from "vitest";
import { hostDoSupabase, motivoSeguro } from "../../server/lib/supabaseAdmin.js";

describe("diagnóstico do Supabase no /health", () => {
  it("mostra só o host de SUPABASE_URL", () => {
    expect(hostDoSupabase("https://nxnkmgdoyvnifeuaxkdp.supabase.co")).toBe(
      "nxnkmgdoyvnifeuaxkdp.supabase.co",
    );
    expect(hostDoSupabase(undefined)).toBeNull();
  });

  it("URL malformada aparece como tal, em vez de virar 'inalcançável' mudo", () => {
    expect(hostDoSupabase("nxnkmgdoyvnifeuaxkdp.supabase.co")).toMatch(/^URL inválida/);
  });

  it("nenhuma chave vaza no motivo", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abc_DEF-123";
    expect(motivoSeguro(`Invalid API key ${jwt}`)).toBe("Invalid API key <jwt>");
    expect(motivoSeguro("chave sb_secret_AbC123-x recusada")).toBe("chave <chave> recusada");
  });
});
