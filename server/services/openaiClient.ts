import OpenAI from "openai";

export const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAIClient() {
  return process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
}

export async function jsonCompletion(system: string, payload: unknown) {
  const client = getOpenAIClient();
  if (!client) return null;
  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(payload, null, 2) },
    ],
  });
  return JSON.parse(response.choices[0]?.message?.content || "{}");
}

export async function textCompletion(system: string, payload: unknown) {
  const client = getOpenAIClient();
  if (!client) return null;
  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(payload, null, 2) },
    ],
  });
  return response.choices[0]?.message?.content || "";
}
