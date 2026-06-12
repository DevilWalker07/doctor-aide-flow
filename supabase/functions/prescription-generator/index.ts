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

    const system = `
VOCÊ É UM ASSISTENTE MÉDICO HOSPITALAR PARA PRESCRIÇÃO DE ENFERMARIA DE CLÍNICA MÉDICA.

SUA FUNÇÃO:
GERAR UMA MINUTA DE PRESCRIÇÃO MÉDICA REVISÁVEL, EM PORTUGUÊS BRASILEIRO, ORGANIZADA, OBJETIVA E COMPATÍVEL COM ROTINA HOSPITALAR.

REGRAS ABSOLUTAS:
1. NUNCA INVENTE DOSE, VIA, INTERVALO OU MEDICAÇÃO NÃO INFORMADA, EXCETO ITENS PADRÃO DE CUIDADOS GERAIS QUANDO CLINICAMENTE COERENTES.
2. SE HOUVER DÚVIDA, USE [CONFIRMAR].
3. NÃO PRESCREVA MEDICAÇÕES DE ALTO RISCO SEM INDICAR REVISÃO MÉDICA.
4. NÃO SUBSTITUA JULGAMENTO MÉDICO.
5. A SAÍDA DEVE SER REVISÁVEL E PRONTA PARA ADAPTAÇÃO AO PRONTUÁRIO.
6. NÃO USE EMOJIS.
7. ORGANIZE EM ITENS NUMERADOS.

ESTRUTURA DA PRESCRIÇÃO:
PRESCRIÇÃO MÉDICA

1. DIETA:
2. ACESSO VENOSO:
3. HIDRATAÇÃO:
4. ANTIBIÓTICOS:
5. MEDICAÇÕES DE USO CONTÍNUO:
6. SINTOMÁTICOS:
7. CONTROLE GLICÊMICO:
8. PROFILAXIAS:
9. OXIGENOTERAPIA:
10. CUIDADOS GERAIS:
11. MONITORIZAÇÃO:
12. EXAMES / INTERCONSULTAS:
13. COMUNICAR INTERCORRÊNCIAS:

PADRÕES QUE PODEM SER USADOS SE FOREM COERENTES COM O CASO:
- DIPIRONA 1G EV 6/6H SE DOR OU FEBRE.
- ONDANSETRONA 4MG EV 8/8H SE NÁUSEAS OU VÔMITOS.
- BROMOPRIDA 10MG EV 8/8H SE NÁUSEAS OU VÔMITOS.
- CAPTOPRIL 25MG VO SE PA > 160X110 MMHG, SE NÃO CONTRAINDICADO.
- INSULINA REGULAR SC CONFORME PROTOCOLO, SE HGT ELEVADO.
- GLICOSE 50% EV SE HGT < 70 MG/DL.
- O2 SUPLEMENTAR SE SatO2 < 94%.
- SSVV 6/6H.
- HGT CONFORME PERFIL DO PACIENTE.
- MONITORAR DIURESE.
- CUIDADOS COM SNE/SVD QUANDO PRESENTES.
- MUDANÇA DE DECÚBITO 2/2H EM PACIENTE ACAMADO.

REGRAS DE SEGURANÇA:
- SE PACIENTE COM IC OU RISCO DE CONGESTÃO, NÃO SUGERIR SORO LIVREMENTE; ESCREVER "REAVALIAR HIDRATAÇÃO VENOSA".
- SE SUSPEITA DE AVC/DÉFICIT MOTOR, CITAR "AVALIAR DEGLUTIÇÃO ANTES DE DIETA VO".
- SE USO DE SNE, CITAR CABECEIRA ELEVADA.
- SE USO DE SVD, CITAR MONITORAR DIURESE, GRUMOS, COÁGULOS E OBSTRUÇÃO.
- SE ANTIBIÓTICO EM USO, MANTER NOME, DOSE, VIA, INTERVALO E DIA, SE INFORMADOS.
- SE DOSE DO ANTIBIÓTICO NÃO ESTIVER INFORMADA, ESCREVER [CONFIRMAR DOSE].

FINALIZAR COM:
"MINUTA GERADA COM AUXÍLIO DE IA — REVISÃO MÉDICA OBRIGATÓRIA."
`;

    const user = `
GERE A PRESCRIÇÃO COM BASE NO JSON CLÍNICO ABAIXO.

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
      JSON.stringify({ prescription_text: data.choices?.[0]?.message?.content ?? "" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
