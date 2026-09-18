/**
 * Cliente de IA das ferramentas de manutenção.
 *
 * Separado do `server/services/openaiClient.ts` de propósito: aquele serve
 * requisição de médico em plantão, com timeout curto e orçamento de tokens
 * apertado. Aqui é ferramenta de bancada, roda na sua máquina e pode demorar.
 */

import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/index";
import { RAIZ } from "./limites.js";

function carregarEnv(): void {
  for (const nome of [".env", "server/.env"]) {
    const arquivo = path.join(RAIZ, nome);
    if (!fs.existsSync(arquivo)) continue;
    for (const linha of fs.readFileSync(arquivo, "utf-8").split("\n")) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      const valor = m[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[m[1]]) process.env[m[1]] = valor;
    }
  }
}

export function modelo(): string {
  carregarEnv();
  // Ferramenta de bancada não precisa do modelo barato do app: a análise vale
  // mais que a economia, e roda uma vez por vez.
  return process.env.AGENTE_MODELO ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

export function cliente(): OpenAI {
  carregarEnv();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY não encontrada. Defina no .env da raiz ou no ambiente. " +
        "Nenhum valor é gravado em disco por este script.",
    );
  }
  return new OpenAI({ apiKey, timeout: 300_000, maxRetries: 2 });
}

export interface ChamadaFerramenta {
  id: string;
  nome: string;
  argumentos: string;
}

export interface Passo {
  texto: string | null;
  ferramentas: ChamadaFerramenta[];
  mensagem: ChatCompletionMessageParam;
}

export async function passo(
  openai: OpenAI,
  mensagens: ChatCompletionMessageParam[],
  ferramentas: ChatCompletionTool[],
): Promise<Passo> {
  const res = await openai.chat.completions.create({
    model: modelo(),
    messages: mensagens,
    tools: ferramentas,
    tool_choice: "auto",
  });
  const msg = res.choices[0]?.message;
  if (!msg) throw new Error("A IA não respondeu.");
  return {
    texto: msg.content ?? null,
    ferramentas: (msg.tool_calls ?? []).flatMap((c) =>
      "function" in c
        ? [{ id: c.id, nome: c.function.name, argumentos: c.function.arguments }]
        : [],
    ),
    mensagem: msg as ChatCompletionMessageParam,
  };
}

/** JSON estruturado com uma única resposta. Usado pelo analisar e pelo consultor. */
export async function json<T>(
  openai: OpenAI,
  system: string,
  user: string,
  valida: (v: unknown) => T,
  maxTokens = 8000,
): Promise<T> {
  const tentar = async (extra?: string): Promise<T> => {
    const res = await openai.chat.completions.create({
      model: modelo(),
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: extra ? `${user}\n\nCorrija: ${extra}` : user },
      ],
    });
    const escolha = res.choices[0];
    if (escolha?.finish_reason === "length") {
      throw new Error("Resposta truncada no limite de tokens. Reduza o escopo.");
    }
    return valida(JSON.parse(escolha?.message?.content ?? "{}"));
  };

  try {
    return await tentar();
  } catch (err) {
    // Uma tentativa de reparo, como no app. Duas seria insistir no erro.
    return await tentar(err instanceof Error ? err.message : String(err));
  }
}
