import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "./helpers/mocks.js";
import { getUserMock } from "./helpers/mocks.js";

vi.mock("../../server/config.js", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../../server/config.js")>();
  return { ...orig, authRequired: () => process.env.TEST_AUTH_REQUIRED === "1" };
});

const { requireAuth, clearAuthCache } = await import("../../server/middleware/auth.js");

function app() {
  const a = express();
  a.use("/api", requireAuth);
  a.get("/api/whoami", (req, res) => res.json({ userId: req.userId }));
  return a;
}

describe("requireAuth", () => {
  beforeEach(() => {
    clearAuthCache();
    getUserMock.mockClear();
  });

  it("obrigatório: sem token → 401", async () => {
    process.env.TEST_AUTH_REQUIRED = "1";
    const res = await request(app()).get("/api/whoami");
    expect(res.status).toBe(401);
  });

  it("opcional: sem token → userId null", async () => {
    process.env.TEST_AUTH_REQUIRED = "0";
    const res = await request(app()).get("/api/whoami");
    expect(res.status).toBe(200);
    expect(res.body.userId).toBeNull();
  });

  it("token válido → userId; segunda chamada usa cache", async () => {
    process.env.TEST_AUTH_REQUIRED = "1";
    const a = app();
    const r1 = await request(a).get("/api/whoami").set("Authorization", "Bearer valid-token");
    const r2 = await request(a).get("/api/whoami").set("Authorization", "Bearer valid-token");
    expect(r1.body.userId).toBe("user-1");
    expect(r2.body.userId).toBe("user-1");
    expect(getUserMock).toHaveBeenCalledTimes(1);
  });

  it("obrigatório: token inválido → 401", async () => {
    process.env.TEST_AUTH_REQUIRED = "1";
    const res = await request(app()).get("/api/whoami").set("Authorization", "Bearer nope");
    expect(res.status).toBe(401);
  });

  /**
   * Este caso mudou de resposta, de propósito.
   *
   * Antes devolvia 401 também em modo opcional. Mas com login opcional isso é
   * a trava voltando pela porta dos fundos: o navegador guarda a sessão do
   * Supabase, e uma sessão morta — de antes de rotacionar as chaves, por
   * exemplo — é mandada em toda chamada pelo apiFetch. O médico que nunca
   * pediu login perderia TODAS as ferramentas com 401, sem entender por quê.
   *
   * Não abre brecha: em modo opcional o anônimo já entra. Tratar token podre
   * como anônimo não concede nada que o anônimo não tenha.
   */
  it("opcional: token inválido entra como anônimo, não derruba as ferramentas", async () => {
    process.env.TEST_AUTH_REQUIRED = "0";
    const res = await request(app()).get("/api/whoami").set("Authorization", "Bearer nope");
    expect(res.status).toBe(200);
    expect(res.body.userId).toBeNull();
  });
});
