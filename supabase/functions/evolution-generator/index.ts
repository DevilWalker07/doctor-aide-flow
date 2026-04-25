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
    const payload = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-3.5-turbo";

    if (!OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY secret");
    }

    const systemPrompt = `Você é o gerador de evolução médica do DOUTOR AJUDA.
Gere uma evolução médica em português brasileiro, técnica, objetiva, em CAIXA ALTA.
Nunca invente dados.
Se dado ausente, use "NÃO REFERIDO".
Use linguagem médica hospitalar.
Siga exatamente o modelo:

EVOLUÇÃO MÉDICA

#LISTA DE PROBLEMAS:
[ATIVOS]
1.
[RESOLVIDOS]
1.

MEDICAÇÕES EM USO:
- ANTIBIÓTICO:
- SINTOMÁTICOS:
- PROFILAXIAS:
- USO CONTÍNUO:
- SE NECESSÁRIO:

#ADMISSÃO / HISTÓRIA DA DOENÇA ATUAL:

#ANTECEDENTES PATOLÓGICOS:

#MEDICAÇÕES DE USO CONTÍNUO:

#EVOLUÇÃO DIÁRIA:

#EXAME FÍSICO:
ECT:
ACV:
AR:
ABD:
EXT:

#EXAMES COMPLEMENTARES:

* LABORATÓRIO

ANÁLISE:

TFGe (CKD-EPI 2021):

* EXAMES DE IMAGEM

#AVALIAÇÃO DE ESPECIALIDADE:

#IMPRESSÃO DIAGNÓSTICA:

CONDUTAS:

PENDÊNCIAS:

INTERCORRÊNCIAS:
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
          { role: "user", content: `Dados do paciente preenchidos na interface para gerar a evolução:\n\n${JSON.stringify(payload, null, 2)}` }
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI Error: ${await response.text()}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    return new Response(JSON.stringify({ evolution_text: content }), {
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
