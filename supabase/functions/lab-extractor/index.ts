import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { inputText, patientContext } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-5";

    if (!OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY secret");
    }

    const systemPrompt = `Você é um extrator de exames laboratoriais para o sistema médico DOUTOR AJUDA.
Retorne exclusivamente JSON puro (sem markdown \`\`\`json ou texto extra).
Nunca invente valores.
Se um valor não for encontrado, retorne null.
Se um valor estiver ilegível ou duvidoso, coloque em valores_duvidosos.
Preserve a data do exame se encontrada.
Use padrão brasileiro de laboratório.
Reconheça sinônimos:
Hemoglobina, Hb, HGB
Hematócrito, Ht, HCT
Leucócitos, Leuco, WBC
Plaquetas, PLQ, PLT
Creatinina, Cr, Crea
Ureia, Ur
Sódio, Na
Potássio, K
PCR, Proteína C Reativa
EAS, piócitos, leucócitos na urina, nitrito.
Gere texto_formatado no padrão:
LAB ATUAL ([DATA]): HB [X] / HT [X] / LEUCO [X] ([X]% SEG / [X]% BAST) / PLQ [X] / CR [X] / UR [X] / NA [X] / K [X] / PCR [X]
Se houver EAS:
EAS ([DATA]): [X] PIÓCITOS/CAMPO / NITRITO [POSITIVO/NEGATIVO]

O JSON de resposta DEVE ter exatamente este formato:
{
  "data_exame": null,
  "tipo_exame": [],
  "valores": {
    "hb": null,
    "ht": null,
    "leucocitos": null,
    "segmentados_percent": null,
    "bastoes_percent": null,
    "plaquetas": null,
    "creatinina": null,
    "ureia": null,
    "sodio": null,
    "potassio": null,
    "pcr": null,
    "eas_piocitos": null,
    "eas_nitrito": null
  },
  "texto_formatado": null,
  "eas_formatado": null,
  "alertas": [],
  "valores_duvidosos": [],
  "campos_nao_encontrados": []
}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Contexto do paciente: ${JSON.stringify(patientContext)}\n\nTexto do laboratório:\n${inputText}` }
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI Error: ${await response.text()}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    if (content.startsWith("```json")) {
      content = content.replace(/^```json/, "").replace(/```$/, "").trim();
    }

    const parsedJson = JSON.parse(content);

    return new Response(JSON.stringify(parsedJson), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
