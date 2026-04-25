// Edge function: evolution-generator
// Gera evolução médica padrão-ouro a partir dos dados estruturados do paciente
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o gerador de evolução médica do DOUTOR AJUDA.
Gere uma evolução médica em português brasileiro, técnica, objetiva, em CAIXA ALTA.
Nunca invente dados. Se dado ausente, use "NÃO REFERIDO".
Use linguagem médica hospitalar.

Siga EXATAMENTE este modelo, preservando títulos, seções e formatação:

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

Retorne APENAS o texto da evolução, sem markdown, sem comentários, sem explicações.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const userMsg = `Dados estruturados do paciente para gerar a evolução:\n\n${JSON.stringify(payload, null, 2)}`;

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
    const text = data?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ evolution_text: text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evolution-generator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});