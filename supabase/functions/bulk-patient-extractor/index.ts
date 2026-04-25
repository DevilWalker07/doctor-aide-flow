// @ts-ignore - Deno import, o VSCode do projeto Node pode reclamar, mas está correto
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
    const { text, sector } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: "No text provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY");
    }

    const prompt = `Você é um triador hospitalar especialista. O usuário vai colar abaixo o conteúdo cru de vários prontuários, sumários de alta, pdfs misturados de vários pacientes.
Sua missão é ler o texto e separar cada paciente encontrado.
Setor Padrão: ${sector || "NÃO INFORMADO"}

Retorne APENAS um JSON no exato formato:
{
  "pacientes": [
    {
      "name": "NOME DO PACIENTE COMPLETO",
      "age": 45, (numero inteiro)
      "sex": "M" ou "F",
      "bed": "LEITO, ex: L01",
      "sector": "SETOR OU O SETOR PADRÃO ACIMA",
      "hda": "RESUMO BREVE DA HISTÓRIA DA DOENÇA ATUAL EM CAIXA ALTA"
    }
  ]
}
Não invente dados. Se algo faltar (como leito ou idade), deixe null ou chute um valor genérico como L00.
O texto misturado segue abaixo:

${text}`;

    const model = Deno.env.get("OPENAI_MODEL") || "gpt-3.5-turbo-1106";

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
        temperature: 0.2,
      }),
    });

    const aiData = await response.json();
    if (aiData.error) {
      throw new Error(aiData.error.message);
    }

    const aiContent = JSON.parse(aiData.choices[0].message.content);

    return new Response(JSON.stringify(aiContent), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
