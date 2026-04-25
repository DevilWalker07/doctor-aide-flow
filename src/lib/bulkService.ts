import { supabase, hasSupabaseConfig } from "./supabase";
import { type Patient } from "./store";

function getSettings() {
  const engine = localStorage.getItem("ai_engine") || "openai";
  const apiKey = localStorage.getItem("ai_api_key") || import.meta.env.VITE_OPENAI_API_KEY || "";
  return { engine, apiKey };
}

function buildPrompt(text: string, sector: string, filename: string) {
  // Tenta extrair leito e nome do padrão do nome do arquivo: "OK - L01 - NOME DO PACIENTE"
  const filenameHint = filename
    ? `\nDICA IMPORTANTE: O nome do arquivo é "${filename}". Se seguir o padrão "L01 - NOME", use isso para confirmar o leito e o nome.`
    : "";

  return `Você é um médico assistente especialista em leitura de evoluções hospitalares brasileiras.
Vou te enviar o conteúdo de UM arquivo de evolução médica de UM paciente.
Seu trabalho é extrair os dados desse paciente com máxima precisão.${filenameHint}

ATENÇÃO — Campos a buscar no texto:
- NOME: Procure por "Paciente:", "Nome:", cabeçalho do documento, ou referência ao paciente
- LEITO: Procure por "Leito:", "Lto:", "L-" ou o número do leito (ex: L01, L-3, leito 5)
- IDADE: Procure por "anos de idade", "y/o", "/ anos", data de nascimento para calcular
- SEXO: Procure por "masculino", "feminino", "M", "F", "homem", "mulher"
- HDA: Resumo da queixa principal e história da doença atual. Procure por "HDA:", "história:", diagnóstico principal, hipóteses diagnósticas, motivo da internação
- SETOR: Procure por "Setor:", "Enfermaria:", "Ala:", ou use o padrão: ${sector}

Retorne APENAS um JSON válido:
{
  "pacientes": [
    {
      "name": "NOME COMPLETO EM MAIÚSCULO",
      "age": 65,
      "sex": "M",
      "bed": "L01",
      "sector": "${sector}",
      "hda": "RESUMO CLÍNICO OBJETIVO EM MAIÚSCULO: DIAGNÓSTICO PRINCIPAL, COMORBIDADES RELEVANTES, MOTIVO DA INTERNAÇÃO"
    }
  ]
}

Regras absolutas:
- Retorne SEMPRE exatamente 1 paciente no array (o arquivo é de 1 paciente)
- NUNCA invente dados — use apenas o que está no texto
- Se não encontrar algum campo, use: bed="L00", age=0, sex="M"
- O campo "hda" deve ser um resumo clínico REAL extraído do documento, não genérico

Conteúdo do arquivo:
${text}`;
}

async function callOpenAI(text: string, sector: string, apiKey: string, filename: string, model = "gpt-3.5-turbo-1106") {
  const prompt = buildPrompt(text, sector, filename);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `Erro HTTP ${response.status} na OpenAI`);
  }

  const data = await response.json();
  const content = JSON.parse(data.choices[0].message.content);
  return content.pacientes || [];
}

async function callGroq(text: string, sector: string, apiKey: string, filename: string) {
  // Free tier do Groq: limite de 6000 TPM. Trunca o texto para ~8000 chars
  const MAX_CHARS = 8000;
  const truncated = text.length > MAX_CHARS
    ? text.slice(0, MAX_CHARS) + "\n[...truncado...]"
    : text;

  const prompt = buildPrompt(truncated, sector, filename);

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `Erro HTTP ${response.status} no Groq`);
  }

  const data = await response.json();
  const content = JSON.parse(data.choices[0].message.content);
  return content.pacientes || [];
}

export async function extractBulkPatientsWithAI(
  text: string,
  sector: string,
  filename = ""
): Promise<Omit<Patient, "id" | "status">[]> {

  // Prioridade 1: Supabase Edge Function (produção)
  if (hasSupabaseConfig) {
    const { data, error } = await supabase.functions.invoke("bulk-patient-extractor", {
      body: { text, sector, filename },
    });
    if (error) throw new Error(error.message);
    return data.pacientes;
  }

  const { engine, apiKey } = getSettings();

  if (engine === "openai") {
    if (!apiKey) throw new Error("Configure sua chave OpenAI nas Configurações do app.");
    return await callOpenAI(text, sector, apiKey, filename);
  }

  if (engine === "groq") {
    if (!apiKey) throw new Error("Configure sua chave Groq nas Configurações do app.");
    return await callGroq(text, sector, apiKey, filename);
  }

  throw new Error("Motor MOCK selecionado. Mude para OpenAI ou Groq nas Configurações.");
}
