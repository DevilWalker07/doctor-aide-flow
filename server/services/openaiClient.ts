import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { z } from "zod";
import { env, hasOpenAIKey } from "../config.js";
import { AIUnavailableError } from "../lib/errors.js";
import { aiFixtures, type AiFixtureKey } from "../mocks/aiFixtures.js";

export const DEFAULT_MODEL = env.OPENAI_MODEL;
export { hasOpenAIKey };

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI | null {
  if (!env.OPENAI_API_KEY) return null;
  if (!client) {
    client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      timeout: env.OPENAI_TIMEOUT_MS,
      maxRetries: 2,
    });
  }
  return client;
}

export type SafeResult<T> =
  | { ok: true; data: T; usage?: { prompt: number; completion: number } }
  | { ok: false; error: string; raw?: string; issues?: z.ZodIssue[] };

export interface CompletionOpts {
  maxTokens?: number;
  temperature?: number;
  images?: { base64: string; mime: string }[];
  mockKey?: AiFixtureKey;
  repairOnce?: boolean;
  /** Sobrepõe o modelo nesta chamada. Ausente, usa `OPENAI_MODEL`. */
  modelo?: string;
}

function userContent(payload: unknown, images?: CompletionOpts["images"]) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  if (!images?.length) return text;
  return [
    ...images.map((img) => ({
      type: "image_url" as const,
      image_url: { url: `data:${img.mime};base64,${img.base64}`, detail: "high" as const },
    })),
    { type: "text" as const, text },
  ];
}

function tryParseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return { ok: true, value: JSON.parse(raw.slice(start, end + 1)) };
      } catch {
        /* fallthrough */
      }
    }
    return { ok: false };
  }
}

export async function safeJsonCompletion<T>(
  system: string,
  payload: unknown,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  opts: CompletionOpts = {},
): Promise<SafeResult<T>> {
  const {
    maxTokens = 4096,
    temperature = 0.1,
    images,
    mockKey,
    repairOnce = true,
    modelo = DEFAULT_MODEL,
  } = opts;

  if (env.AI_MOCK) {
    if (!mockKey) return { ok: false, error: "AI_MOCK ativo sem fixture para esta chamada." };
    const parsed = schema.safeParse(aiFixtures[mockKey]);
    return parsed.success
      ? { ok: true, data: parsed.data }
      : { ok: false, error: "Fixture inválida para o schema.", issues: parsed.error.issues };
  }

  const openai = getOpenAIClient();
  if (!openai) throw new AIUnavailableError();

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: userContent(payload, images) },
  ];

  const attempt = async (): Promise<SafeResult<T> & { raw?: string }> => {
    const response = await openai.chat.completions.create({
      model: modelo,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages,
    });
    const choice = response.choices[0];
    const raw = choice?.message?.content ?? "";
    const usage = response.usage
      ? { prompt: response.usage.prompt_tokens, completion: response.usage.completion_tokens }
      : undefined;

    if (choice?.finish_reason === "length") {
      return { ok: false, error: "Resposta da IA truncada (limite de tokens).", raw };
    }
    const parsed = tryParseJson(raw);
    if (!parsed.ok) return { ok: false, error: "A IA não retornou JSON válido.", raw };

    const validated = schema.safeParse(parsed.value);
    if (!validated.success) {
      return {
        ok: false,
        error: "JSON da IA fora do schema esperado.",
        raw,
        issues: validated.error.issues,
      };
    }
    return { ok: true, data: validated.data, usage };
  };

  const first = await attempt();
  if (first.ok || !repairOnce || !first.raw) return first;

  const issuesText = first.issues
    ? first.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`).join("; ")
    : first.error;
  messages.push(
    { role: "assistant", content: first.raw },
    {
      role: "user",
      content: `Resposta inválida: ${issuesText}. Retorne apenas o JSON corrigido, completo e válido, sem texto adicional.`,
    },
  );
  const second = await attempt();
  return second.ok ? second : first;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function chatCompletion(
  system: string,
  messages: ChatMessage[],
  opts: Pick<CompletionOpts, "maxTokens" | "temperature" | "mockKey" | "modelo"> = {},
): Promise<string> {
  const { maxTokens = 1200, temperature = 0.3, mockKey, modelo = DEFAULT_MODEL } = opts;

  if (env.AI_MOCK) {
    const fixture = mockKey ? aiFixtures[mockKey] : null;
    return typeof fixture === "string" ? fixture : "";
  }

  const openai = getOpenAIClient();
  if (!openai) throw new AIUnavailableError();

  const response = await openai.chat.completions.create({
    model: modelo,
    temperature,
    max_tokens: maxTokens,
    messages: [{ role: "system", content: system }, ...messages],
  });
  return response.choices[0]?.message?.content?.trim() ?? "";
}

export async function textCompletion(
  system: string,
  payload: unknown,
  opts: Pick<CompletionOpts, "maxTokens" | "temperature" | "mockKey" | "modelo"> = {},
): Promise<string> {
  const { maxTokens = 4096, temperature = 0.2, mockKey, modelo = DEFAULT_MODEL } = opts;

  if (env.AI_MOCK) {
    const fixture = mockKey ? aiFixtures[mockKey] : null;
    return typeof fixture === "string" ? fixture : "";
  }

  const openai = getOpenAIClient();
  if (!openai) throw new AIUnavailableError();

  const response = await openai.chat.completions.create({
    model: modelo,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      },
    ],
  });
  return response.choices[0]?.message?.content?.trim() ?? "";
}
