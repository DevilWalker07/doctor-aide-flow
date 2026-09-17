import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  SERVIDOR_INALCANCAVEL,
  apiFetch,
  setTokenProvider,
} from "../../src/lib/apiClient";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  setTokenProvider(async () => null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function resposta(status = 200, corpo: unknown = { ok: true }) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiFetch", () => {
  it("segue a chamada quando obter o token falha", async () => {
    // Sessão guardada que não casa mais com a chave do Supabase faz
    // getSession() lançar. Antes a exceção escapava do apiFetch e o hook de
    // saúde a contava como "servidor fora do ar" — mentira apresentada com
    // confiança. /health não precisa de token nenhum.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    setTokenProvider(async () => {
      throw new Error("Invalid Refresh Token");
    });
    fetchMock.mockResolvedValue(resposta());

    const res = await apiFetch("/health");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // E sem cabeçalho de autorização, já que não houve token.
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBeNull();
  });

  it("anexa o token quando existe", async () => {
    setTokenProvider(async () => "token-123");
    fetchMock.mockResolvedValue(resposta());

    await apiFetch("/api/ai/copiloto");
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token-123");
  });

  it("falha de rede vira ApiError marcado como inalcançável", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const erro = await apiFetch("/health").catch((e: unknown) => e as ApiError);
    expect(erro).toBeInstanceOf(ApiError);
    expect((erro as ApiError).code).toBe(SERVIDOR_INALCANCAVEL);
    expect((erro as ApiError).status).toBe(0);
    expect((erro as ApiError).inalcancavel).toBe(true);
  });

  it("chama sempre o mesmo domínio, sem base configurável", async () => {
    // A base vinha de VITE_CLINICAL_AGENTS_URL. Com a variável sobrando
    // apontando para o Railway morto, todo fetch do navegador ia para um
    // serviço inexistente e o app acusava "servidor fora do ar" — estando
    // certo, mas sobre o servidor errado.
    fetchMock.mockResolvedValue(resposta());
    await apiFetch("/health");
    expect(fetchMock.mock.calls[0][0]).toBe("/health");

    await apiFetch("/api/ai/copiloto");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/ai/copiloto");
  });

  it("503 também conta como inalcançável para a faixa de aviso", async () => {
    fetchMock.mockResolvedValue(resposta(503, { ok: false }));
    const res = await apiFetch("/health");
    expect(res.status).toBe(503);
    expect(new ApiError(503, "config_indisponivel", "x").inalcancavel).toBe(true);
  });
});
