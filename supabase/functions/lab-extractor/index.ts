// Edge function: lab-extractor
// Extrai valores de exames laboratoriais de texto livre usando Lovable AI Gateway
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um extrator de exames laboratoriais para o sistema médico DOUTOR AJUDA.
Retorne EXCLUSIVAMENTE via tool call estruturada.
Nunca invente valores. Se um valor não for encontrado, retorne null.
Se um valor estiver ilegível ou duvidoso, coloque o nome do campo em valores_duvidosos.
Preserve a data do exame (formato YYYY-MM-DD) se encontrada.
Use padrão brasileiro de laboratório (vírgula como separador decimal na origem, mas na saída use número JSON com ponto).

Reconheça sinônimos:
- Hemoglobina, Hb, HGB → hb
- Hematócrito, Ht, HCT → ht
- Leucócitos, Leuco, WBC → leucocitos (use o número absoluto, ex: 12800)
- Segmentados, Segs → segmentados_percent
- Bastões, Bast → bastoes_percent
- Plaquetas, PLQ, PLT → plaquetas
- Creatinina, Cr, Crea → creatinina
- Ureia, Ur → ureia
- Sódio, Na → sodio
- Potássio, K → potassio
- PCR, Proteína C Reativa → pcr
- EAS piócitos/leucócitos na urina → eas_piocitos (ex: "38 piócitos/campo")
- EAS nitrito → eas_nitrito ("POSITIVO" ou "NEGATIVO")

Gere texto_formatado neste padrão exato (em CAIXA ALTA), omitindo campos null:
LAB ATUAL (DD/MM/AAAA): HB X / HT X / LEUCO X (X% SEG / X% BAST) / PLQ X / CR X / UR X / NA X / K X / PCR X

Se houver EAS, gere eas_formatado:
EAS (DD/MM/AAAA): X PIÓCITOS/CAMPO / NITRITO POSITIVO|NEGATIVO

Se PCR > 50, adicione alerta "PCR ELEVADA". Se creatinina > 1.3, adicione alerta "CREATININA ELEVADA".`;

const tool = {
  type: "function",
  function: {
    name: "extract_lab",
    description: "Extrai valores de exames laboratoriais",
    parameters: {
      type: "object",
      properties: {
        data_exame: { type: ["string", "null"], description: "Data do exame em formato YYYY-MM-DD" },
        tipo_exame: { type: "array", items: { type: "string" } },
        valores: {
          type: "object",
          properties: {
            hb: { type: ["number", "null"] },
            ht: { type: ["number", "null"] },
            leucocitos: { type: ["number", "null"] },
            segmentados_percent: { type: ["number", "null"] },
            bastoes_percent: { type: ["number", "null"] },
            plaquetas: { type: ["number", "null"] },
            creatinina: { type: ["number", "null"] },
            ureia: { type: ["number", "null"] },
            sodio: { type: ["number", "null"] },
            potassio: { type: ["number", "null"] },
            pcr: { type: ["number", "null"] },
            eas_piocitos: { type: ["string", "null"] },
            eas_nitrito: { type: ["string", "null"] },
          },
          required: ["hb","ht","leucocitos","segmentados_percent","bastoes_percent","plaquetas","creatinina","ureia","sodio","potassio","pcr","eas_piocitos","eas_nitrito"],
          additionalProperties: false,
        },
        texto_formatado: { type: ["string", "null"] },
        eas_formatado: { type: ["string", "null"] },
        alertas: { type: "array", items: { type: "string" } },
        valores_duvidosos: { type: "array", items: { type: "string" } },
        campos_nao_encontrados: { type: "array", items: { type: "string" } },
      },
      required: ["data_exame","tipo_exame","valores","texto_formatado","eas_formatado","alertas","valores_duvidosos","campos_nao_encontrados"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { inputText, patientContext } = await req.json();
    if (!inputText || typeof inputText !== "string") {
      return new Response(JSON.stringify({ error: "inputText é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const userMsg = `Contexto do paciente: ${JSON.stringify(patientContext ?? {})}\n\nTexto do laboratório a extrair:\n${inputText}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "extract_lab" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos em Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await resp.text();
      console.error("AI gateway error:", resp.status, errText);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("IA não retornou tool call estruturada");
    }
    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lab-extractor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});