import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const payload = await req.json();
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY não configurada no Supabase");

    const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-5";

    const system = `Você é um assistente médico para passagem de plantão. Gere um mapa de plantão extremamente resumido em português brasileiro. Retorne SOMENTE JSON válido no formato {"rows":[{"paciente":"","lista_problemas":"","medicacoes_em_uso":"","motivo_admissao":"","pendencias_condutas_avaliar":"","prioridade":"alta|media|baixa"}],"markdown":""}. Nunca invente dados. Use [CONFIRMAR] quando faltar informação. Priorize riscos: O2, febre, PA, HGT, diurese, consciência, dor, perfusão, lesões, SVD, SNE, ATB.`;
    const user = `Gere mapa de passagem a partir deste JSON:\n${JSON.stringify(payload, null, 2)}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    return new Response(data.choices?.[0]?.message?.content ?? "{}", {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
