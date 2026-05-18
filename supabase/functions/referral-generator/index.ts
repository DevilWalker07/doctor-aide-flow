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
    const destination = payload.destination ?? "UBS";

    const system = `
VOCÊ É UM ASSISTENTE MÉDICO HOSPITALAR PARA ELABORAÇÃO DE ENCAMINHAMENTOS.

SUA FUNÇÃO:
GERAR ENCAMINHAMENTO FORMAL, OBJETIVO E PRONTO PARA IMPRESSÃO, EM PORTUGUÊS BRASILEIRO, PARA UBS, CAPS AD OU ESPECIALISTAS.

REGRAS:
1. NUNCA INVENTE DADOS AUSENTES.
2. USE [CONFIRMAR] QUANDO FALTAR INFORMAÇÃO.
3. NÃO USE LINGUAGEM MORALIZANTE.
4. NÃO USE EMOJIS.
5. NÃO EXAGERE O TEXTO.
6. FOQUE EM CONTINUIDADE DO CUIDADO.
7. SE O DESTINO FOR CAPS AD, USAR LINGUAGEM DE ACOLHIMENTO, REDUÇÃO DE DANOS, PREVENÇÃO DE RECAÍDAS E PLANO TERAPÊUTICO SINGULAR.
8. SE O DESTINO FOR UBS, FOCO EM SEGUIMENTO CLÍNICO, REAVALIAÇÃO DE EXAMES, MEDICAÇÕES E SINAIS DE ALARME.
9. SE O DESTINO FOR ESPECIALISTA, DEIXAR CLARO O MOTIVO DA AVALIAÇÃO.

ESTRUTURA:
ENCAMINHAMENTO PARA [DESTINO]

À EQUIPE DO(A) [DESTINO],

ENCAMINHO O(A) PACIENTE [NOME], [IDADE], [SEXO], COM HISTÓRICO DE INTERNAÇÃO POR [MOTIVO], PARA SEGUIMENTO E AVALIAÇÃO.

# RESUMO DA INTERNAÇÃO:
DESCREVER MOTIVO DA ADMISSÃO, PRINCIPAIS ACHADOS, CONDUTA HOSPITALAR E EVOLUÇÃO.

# EXAMES RELEVANTES:
LISTAR LABORATÓRIOS E IMAGENS IMPORTANTES.

# SITUAÇÃO ATUAL:
DESCREVER ESTADO NO MOMENTO DO ENCAMINHAMENTO.

# MOTIVO DO ENCAMINHAMENTO:
EXPLICAR OBJETIVAMENTE.

# SOLICITAÇÕES AO SERVIÇO:
LISTAR O QUE A UBS/CAPS/ESPECIALISTA DEVE ACOMPANHAR.

# DIAGNÓSTICOS / PROBLEMAS:
LISTAR PROBLEMAS ATIVOS E RESOLVIDOS.

ATENCIOSAMENTE,
[ASSINATURA / CARIMBO]
`;

    const user = `
GERE UM ENCAMINHAMENTO FORMAL COM BASE NO JSON CLÍNICO ABAIXO.

DESTINO:
${destination}

INSTRUÇÕES:
- SE FOR UBS: FOQUE EM SEGUIMENTO CLÍNICO, EXAMES, MEDICAÇÕES, SINAIS DE ALARME E RETORNO.
- SE FOR CAPS AD: FOQUE EM ETILISMO/USO DE SUBSTÂNCIAS, ACOLHIMENTO, REDUÇÃO DE DANOS, PREVENÇÃO DE RECAÍDAS E ARTICULAÇÃO COM UBS.
- SE FOR ESPECIALISTA: FOQUE NA PERGUNTA CLÍNICA E NO MOTIVO DA AVALIAÇÃO.
- NÃO INVENTE DADOS.
- USE [CONFIRMAR] QUANDO NECESSÁRIO.

JSON CLÍNICO:
${JSON.stringify(payload, null, 2)}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.2,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    return new Response(
      JSON.stringify({ referral_text: data.choices?.[0]?.message?.content ?? "" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
