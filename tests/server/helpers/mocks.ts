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

export const aiMock = {
  json: vi.fn<JsonFn>(),
  text: vi.fn<TextFn>(),
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
    hasOpenAIKey: () => aiMock.hasKey(),
    getOpenAIClient: () => null,
  };
});

vi.mock("../../../server/lib/supabaseAdmin.js", () => ({
  getSupabaseAdmin: () => ({ auth: { getUser: getUserMock } }),
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
