import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { z } from "zod";
import { env, hasOpenAIKey } from "../config.js";
import { AIUnavailableError, HttpError, ModeloIndisponivelError } from "../lib/errors.js";
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

/**
 * Traduz o erro da API da OpenAI em algo que o médico possa agir sobre.
 *
 * Sem isso, qualquer falha da API escapava até o errorHandler e virava
 * "Erro interno no servidor" — inclusive o caso mais provável de todos, que é
 * um ID de modelo digitado errado na variável de ambiente.
 */
export function traduzirErroOpenAI(err: unknown, modelo: string): never {
  const status = (err as { status?: number })?.status;
  const codigo = (err as { code?: string })?.code;
  const mensagem = (err as { message?: string })?.message ?? "";

  if (status === 404 || codigo === "model_not_found") {
    throw new ModeloIndisponivelError(modelo, "a OpenAI não reconhece esse identificador.");
  }
  if (status === 403) {
    throw new ModeloIndisponivelError(modelo, "esta chave não tem acesso a ele.");
  }
  if (status === 401) {
    throw new HttpError(
      503,
      "chave_invalida",
      "A OPENAI_API_KEY foi recusada. Gere uma nova chave e atualize a variável.",
    );
  }
  if (status === 429) {
    throw new HttpError(
      503,
      "limite_openai",
      mensagem.toLowerCase().includes("quota")
        ? "A conta da OpenAI está sem crédito. Adicione saldo para voltar a usar a IA."
        : "Muitas chamadas à OpenAI agora. Tente de novo em instantes.",
    );
  }
  throw err;
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
    const response = await openai.chat.completions
      .create({
        model: modelo,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages,
      })
      .catch((err: unknown) => traduzirErroOpenAI(err, modelo));
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

  const response = await openai.chat.completions
    .create({
      model: modelo,
      temperature,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, ...messages],
    })
    .catch((err: unknown) => traduzirErroOpenAI(err, modelo));
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

  const response = await openai.chat.completions
    .create({
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
    })
    .catch((err: unknown) => traduzirErroOpenAI(err, modelo));
  return response.choices[0]?.message?.content?.trim() ?? "";
}

/**
 * Quais dos modelos configurados a OpenAI não reconhece.
 *
 * O `/health` usa isso para você conferir o valor colado na variável sem
 * disparar uma chamada clínica de verdade — o erro mais provável ao trocar de
 * modelo é colar o nome de exibição em vez do ID, e esse erro só apareceria
 * quando o médico tentasse usar o app.
 *
 * Devolve `null` quando não há como checar (sem chave, em mock, ou a própria
 * consulta falhou). Não afirmar nada é melhor que afirmar errado.
 */
const CACHE_MODELOS_MS = 5 * 60_000;
let cacheModelos: { chave: string; desconhecidos: string[] | null; em: number } | null = null;

export async function modelosDesconhecidos(ids: string[]): Promise<string[] | null> {
  const unicos = [...new Set(ids)].sort();
  const chave = unicos.join(",");

  if (cacheModelos?.chave === chave && Date.now() - cacheModelos.em < CACHE_MODELOS_MS) {
    return cacheModelos.desconhecidos;
  }

  const openai = getOpenAIClient();
  if (!openai || env.AI_MOCK) return null;

  let desconhecidos: string[] | null;
  try {
    const checagens = await Promise.all(
      unicos.map(async (id) => {
        try {
          await openai.models.retrieve(id);
          return null;
        } catch (err) {
          const status = (err as { status?: number })?.status;
          // 404/403 é resposta: o modelo não serve. Outro status é problema de
          // rede ou da conta, e aí não dá para culpar o ID.
          if (status === 404 || status === 403) return id;
          throw err;
        }
      }),
    );
    desconhecidos = checagens.filter((id): id is string => id !== null);
  } catch {
    desconhecidos = null;
  }

  cacheModelos = { chave, desconhecidos, em: Date.now() };
  return desconhecidos;
}
