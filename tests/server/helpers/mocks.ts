import type { RequestHandler } from "express";
import { vi } from "vitest";
import type { z } from "zod";
import { aiFixtures, type AiFixtureKey } from "../../../server/mocks/aiFixtures.js";
import type { CompletionOpts, SafeResult } from "../../../server/services/openaiClient.js";

type JsonFn = (
  system: string,
  payload: unknown,
  schema: z.ZodType<unknown, z.ZodTypeDef, unknown>,
  opts?: CompletionOpts,
) => Promise<SafeResult<unknown>>;
type TextFn = (
  system: string,
  payload: unknown,
  opts?: { mockKey?: AiFixtureKey },
) => Promise<string>;
type ChatFn = (
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  opts?: { mockKey?: AiFixtureKey },
) => Promise<string>;

export const aiMock = {
  json: vi.fn<JsonFn>(),
  text: vi.fn<TextFn>(),
  // O copiloto usa chatCompletion, que não estava mockado — por isso qualquer
  // teste dele caía no cliente real e devolvia 500.
  chat: vi.fn<ChatFn>(),
  hasKey: vi.fn(() => true),
};

export function resetAiMock() {
  aiMock.json.mockReset();
  aiMock.text.mockReset();
  aiMock.hasKey.mockReset().mockReturnValue(true);
  aiMock.json.mockImplementation(async (_s, _p, schema, opts) => {
    const key = opts?.mockKey;
    if (!key) return { ok: false, error: "sem mockKey" };
    return { ok: true, data: schema.parse(aiFixtures[key]) };
  });
  aiMock.text.mockImplementation(async (_s, _p, opts) => {
    const fixture = opts?.mockKey ? aiFixtures[opts.mockKey] : "";
    return typeof fixture === "string" ? fixture : "";
  });
  aiMock.chat.mockReset();
  aiMock.chat.mockImplementation(async (_s, _m, opts) => {
    const fixture = opts?.mockKey ? aiFixtures[opts.mockKey] : "";
    return typeof fixture === "string" ? fixture : "";
  });
}

export const authUsers = new Map<string, string>([
  ["valid-token", "user-1"],
  ["other-token", "user-2"],
]);
export const getUserMock = vi.fn(async (token: string) => {
  const id = authUsers.get(token);
  return id
    ? { data: { user: { id } }, error: null }
    : { data: { user: null }, error: { message: "invalid" } };
});

const passthrough: RequestHandler = (_req, _res, next) => next();

vi.mock("../../../server/services/openaiClient.js", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../../../server/services/openaiClient.js")>();
  return {
    ...orig,
    safeJsonCompletion: (...args: Parameters<JsonFn>) => aiMock.json(...args),
    textCompletion: (...args: Parameters<TextFn>) => aiMock.text(...args),
    chatCompletion: (...args: Parameters<ChatFn>) => aiMock.chat(...args),
    hasOpenAIKey: () => aiMock.hasKey(),
    getOpenAIClient: () => null,
  };
});

/**
 * Supabase Storage em memória.
 *
 * O upload não passa mais pelo servidor — o navegador envia direto ao bucket e
 * a rota só recebe o caminho. Então o teste põe o arquivo aqui e manda o
 * caminho, que é exatamente o que o navegador faz.
 */
export const storageMock = {
  objetos: new Map<string, Buffer>(),
  removidos: [] as string[],
  put(caminho: string, conteudo: Buffer) {
    this.objetos.set(caminho, conteudo);
    return caminho;
  },
  reset() {
    this.objetos.clear();
    this.removidos = [];
  },
};

const storageApi = {
  from: () => ({
    download: async (caminho: string) => {
      const buf = storageMock.objetos.get(caminho);
      if (!buf) return { data: null, error: { message: "not found" } };
      return {
        data: {
          arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length),
        },
        error: null,
      };
    },
    upload: async (caminho: string, conteudo: Buffer | Uint8Array) => {
      storageMock.objetos.set(caminho, Buffer.from(conteudo));
      return { data: { path: caminho }, error: null };
    },
    createSignedUploadUrl: async (caminho: string) => ({
      data: {
        path: caminho,
        token: `token-de-${caminho}`,
        signedUrl: `https://storage.teste/${caminho}`,
      },
      error: null,
    }),
    createSignedUrl: async (caminho: string) => {
      if (!storageMock.objetos.has(caminho)) {
        return { data: null, error: { message: "not found" } };
      }
      return { data: { signedUrl: `https://storage.teste/${caminho}?assinada` }, error: null };
    },
    remove: async (caminhos: string[]) => {
      for (const c of caminhos) {
        storageMock.objetos.delete(c);
        storageMock.removidos.push(c);
      }
      return { data: null, error: null };
    },
  }),
};

vi.mock("../../../server/lib/supabaseAdmin.js", () => ({
  getSupabaseAdmin: () => ({ auth: { getUser: getUserMock }, storage: storageApi }),
  hasSupabase: () => true,
}));

vi.mock("../../../server/middleware/security.js", () => ({
  buildCors: () => passthrough,
  buildRateLimiters: () => ({
    ai: passthrough,
    upload: passthrough,
    poll: passthrough,
    passagem: passthrough,
  }),
}));
