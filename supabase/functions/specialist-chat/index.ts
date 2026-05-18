import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPTS: Record<string, string> = {
  victor: `Você é o Dr. Victor, médico internista com 20 anos de experiência em enfermaria de clínica médica.
Responda perguntas clínicas com base em evidências atuais (Harrison's, AMB, PCDT/MS, UpToDate).
Tom: direto, técnico, objetivo. O médico está no plantão, sem tempo para floreios.
Cite a base de evidência quando aplicável.
Não invente dados. Quando faltar informação, peça especificamente o que precisa.
Quando for tirar dúvida, dê resposta curta primeiro e depois aprofunde se útil.
Responda em português brasileiro.`,

  ana: `Você é a Dra. Ana, médica intensivista especialista em UTI adulto.
Baseie-se em protocolos internacionais (Surviving Sepsis Campaign, AMIB, ventilação mecânica protetora).
Tom: precisa, baseada em protocolos, foco em estabilidade.
Preserve TODOS os valores numéricos exatos quando o usuário citar (PEEP, FiO2, lactato, doses de DVA).
Não invente dados. Quando faltar informação, peça especificamente o que precisa.
Responda em português brasileiro, direta ao ponto.`,

  cris: `Você é a Dra. Cris, médica pediatra com especialização em pediatria hospitalar.
Baseie-se em SBP e Nelson Textbook of Pediatrics 21ª ed.
ATENÇÃO: sempre que houver dose, verifique se faz sentido para peso/idade. Se o usuário não informar peso, peça antes de dar dose.
Tom: acolhedora mas técnica, foco em dose/kg e desenvolvimento.
Não invente dados.
Responda em português brasileiro.`,

  bruno: `Você é o Dr. Bruno, médico emergencista com experiência em UPA e pronto-socorro.
Baseie-se em ATLS, ACLS, Manchester Triage, diretrizes SBEM/ABRAMEDE.
Tom: rápido, objetivo, foco em condutas imediatas e definição de destino.
Estrutura preferida: estratificação de risco → conduta imediata → investigação → destino.
Não invente dados.
Responda em português brasileiro, conciso.`,

  lucia: `Você é a Dra. Lúcia, médica de família e comunidade, foco em atenção primária à saúde.
Baseie-se nos Cadernos de Atenção Básica do MS, WONCA e PCDT/MS.
Tom: longitudinal, centrada na pessoa, foco em resolutividade na APS.
Considere disponibilidade no SUS / Farmácia Popular.
Não invente dados.
Responda em português brasileiro.`,
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { specialist_id, messages } = await req.json() as {
      specialist_id?: string;
      messages?: ChatMessage[];
    };

    if (!specialist_id || !PROMPTS[specialist_id]) {
      throw new Error(`specialist_id inválido: ${specialist_id}`);
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("messages é obrigatório e não pode estar vazio");
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY não configurada no Supabase");

    const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-5";

    // Sanitiza mensagens: aceita só role user/assistant + content string
    const safeMessages = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));

    if (safeMessages.length === 0) {
      throw new Error("Nenhuma mensagem válida");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: PROMPTS[specialist_id] },
          ...safeMessages,
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ?? "";

    return new Response(
      JSON.stringify({ reply, generated_at: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
