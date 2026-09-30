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
 * Perfil do que este modelo aceita, descoberto em execução.
 *
 * Modelos novos recusam ajustes que os antigos aceitavam, cada um com uma
 * mensagem 400 diferente:
 *
 *   Unsupported parameter: 'max_tokens' is not supported with this model.
 *   Unsupported value: 'temperature' does not support 0.1 with this model.
 *
 * Eu já consertei o primeiro sozinho, e o segundo apareceu na tentativa
 * seguinte do médico. Consertar um por vez gasta uma rodada dele a cada
 * parâmetro — e ainda faltariam `top_p`, `frequency_penalty` e o que mais a
 * OpenAI decidir travar.
 *
 * Lista de nomes de modelo também não serve: o identificador vem de variável de
 * ambiente e muda quando o modelo muda. Então o código usa o que a **própria
 * API diz**: a mensagem nomeia o parâmetro, e o perfil do modelo é montado a
 * partir disso, uma vez por processo.
 */
interface PerfilModelo {
  /** Como este modelo chama o limite de saída. */
  limite: "max_completion_tokens" | "max_tokens";
  /** Ajustes que ele recusou e que passam a ser omitidos. */
  omitir: Set<string>;
}

const perfis = new Map<string, PerfilModelo>();

function perfilDe(modelo: string): PerfilModelo {
  let perfil = perfis.get(modelo);
  if (!perfil) {
    perfil = { limite: "max_completion_tokens", omitir: new Set() };
    perfis.set(modelo, perfil);
  }
  return perfil;
}

/**
 * Ajustes que podem ser descartados sem mudar o contrato da resposta.
 *
 * `response_format` NÃO está aqui, de propósito. Ele é o que garante que a
 * saída venha em JSON; sem ele a IA devolve texto livre, o schema rejeita, e o
 * app ficaria tentando reparar algo que nunca ia validar. Descartar em silêncio
 * um parâmetro que sustenta o contrato de dado clínico é o tipo de esperteza
 * que o guia do projeto proíbe: quando a IA não pode cumprir o contrato, a
 * chamada falha.
 */
const AJUSTES_DESCARTAVEIS = new Set([
  "temperature",
  "top_p",
  "frequency_penalty",
  "presence_penalty",
  "max_tokens",
  "max_completion_tokens",
]);

/** O parâmetro que a API nomeou na recusa, quando ela nomeia algum. */
function parametroRecusado(err: unknown): string | null {
  if ((err as { status?: number })?.status !== 400) return null;
  const mensagem = (err as { message?: string })?.message ?? "";
  const m = mensagem.match(/Unsupported (?:parameter|value): '([^']+)'/i);
  return m?.[1] ?? null;
}

/** Quantas vezes uma única chamada pode se adaptar antes de desistir. */
const MAX_ADAPTACOES = 3;

/**
 * Executa a chamada montando os ajustes conforme o perfil do modelo, e
 * adaptando o perfil quando a API recusa um parâmetro pelo nome.
 */
async function chamarModelo<T>(
  modelo: string,
  maxTokens: number,
  temperature: number,
  criar: (ajustes: Record<string, unknown>) => Promise<T>,
): Promise<T> {
  for (let tentativa = 0; ; tentativa++) {
    const perfil = perfilDe(modelo);
    const ajustes: Record<string, unknown> = {};
    if (!perfil.omitir.has(perfil.limite)) ajustes[perfil.limite] = maxTokens;
    if (!perfil.omitir.has("temperature")) ajustes.temperature = temperature;

    try {
      return await criar(ajustes);
    } catch (err) {
      const parametro = parametroRecusado(err);
      // Sem nome de parâmetro, ou fora da lista do que é seguro descartar, o
      // erro sobe — retentativa cega esconderia a causa real.
      if (!parametro || !AJUSTES_DESCARTAVEIS.has(parametro)) throw err;
      if (tentativa >= MAX_ADAPTACOES) throw err;

      if (parametro === perfil.limite) {
        // A API recusou o NOME do limite: o outro é o certo para este modelo.
        perfil.limite =
          parametro === "max_completion_tokens" ? "max_tokens" : "max_completion_tokens";
      } else {
        perfil.omitir.add(parametro);
      }
    }
  }
}

/** Só para teste: o perfil aprendido para o modelo. */
export function perfilAprendido(modelo: string): { limite: string; omitir: string[] } | undefined {
  const p = perfis.get(modelo);
  return p ? { limite: p.limite, omitir: [...p.omitir] } : undefined;
}

/** Só para teste: esquece o que foi aprendido. */
export function esquecerLimites(): void {
  perfis.clear();
}

/**
 * Traduz o erro da API da OpenAI em algo que o médico possa agir sobre.
 *
 * Sem isso, qualquer falha da API escapava até o errorHandler e virava
 * "Erro interno no servidor" — inclusive o caso mais provável de todos, que é
 * um ID de modelo digitado errado na variável de ambiente.
 */
export function traduzirErroOpenAI(err: unknown, modelo: string, comImagem = false): never {
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
  // 400 com imagem na chamada é quase sempre um modelo que só aceita texto.
  // O ID existe e o /health não reclama — só a leitura de foto quebra. Sem
  // esta mensagem, virava "Erro interno no servidor" e ninguém ligaria o
  // defeito à variável que acabou de ser configurada.
  if (status === 400 && comImagem) {
    throw new ModeloIndisponivelError(
      modelo,
      "ele recusou a imagem — provavelmente não aceita imagem na entrada. " +
        "Para OPENAI_MODEL_VISAO use um modelo que liste imagem em 'Entrada'.",
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
    const fixture: unknown = aiFixtures[mockKey];
    const parsed = schema.safeParse(typeof fixture === "function" ? fixture(payload) : fixture);
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
    const response = await chamarModelo(modelo, maxTokens, temperature, (ajustes) =>
      openai.chat.completions.create({
        model: modelo,
        ...ajustes,
        response_format: { type: "json_object" },
        messages,
      }),
    ).catch((err: unknown) => traduzirErroOpenAI(err, modelo, Boolean(images?.length)));
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

  const response = await chamarModelo(modelo, maxTokens, temperature, (ajustes) =>
    openai.chat.completions.create({
      model: modelo,
      ...ajustes,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  ).catch((err: unknown) => traduzirErroOpenAI(err, modelo));
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

  const response = await chamarModelo(modelo, maxTokens, temperature, (ajustes) =>
    openai.chat.completions.create({
      model: modelo,
      ...ajustes,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
        },
      ],
    }),
  ).catch((err: unknown) => traduzirErroOpenAI(err, modelo));
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
