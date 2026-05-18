import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMMON_RULES = `
REGRAS ABSOLUTAS (válidas para qualquer parecer):
- NUNCA invente dados que não estejam no contexto clínico fornecido.
- Se um dado importante estiver ausente, mencione-o explicitamente como "DADO AUSENTE".
- Toda sugestão deve ser CONSULTIVA — o médico decide se aceita ou não.
- Sempre cite a base de evidência (diretriz, livro-texto, protocolo) quando aplicável.
- Não repita os dados que já foram fornecidos — acrescente análise crítica.
- Seja objetivo e direto: o médico está no meio do plantão, sem tempo para floreios.

FORMATO DE RESPOSTA OBRIGATÓRIO (JSON puro, sem markdown):
{
  "sections": [
    { "title": "string em CAIXA ALTA", "content": "análise em texto corrido", "alert": false }
  ],
  "suggestions": [
    { "id": "s1", "text": "ação concreta e aplicável", "priority": "alta" | "media" | "baixa" }
  ],
  "references": ["diretriz X", "livro Y"]
}
`;

const PROMPTS: Record<string, { nome: string; prompt: string }> = {
  victor: {
    nome: "Dr. Victor",
    prompt: `Você é o Dr. Victor, médico internista com 20 anos de experiência em enfermaria de clínica médica.

Você vai receber o contexto clínico completo de um paciente e deve fazer uma análise crítica e objetiva, baseada em evidências atuais (Harrison's, AMB, PCDT/MS, UpToDate).

Sua análise deve cobrir, quando aplicável:

1. AVALIAÇÃO DIAGNÓSTICA
2. AVALIAÇÃO TERAPÊUTICA
3. ANTIBIOTICOTERAPIA (foco, cobertura, D-day)
4. EXAMES (pendentes prioritários, desnecessários, tendências)
5. CONDUTAS SUGERIDAS (concretas e aplicáveis hoje)
6. ALERTAS (sinais de alarme)

${COMMON_RULES}`,
  },
  ana: {
    nome: "Dra. Ana",
    prompt: `Você é a Dra. Ana, médica intensivista especialista em UTI adulto.

Analise o contexto clínico do paciente internado em UTI e forneça parecer técnico baseado em protocolos internacionais (Surviving Sepsis Campaign, AMIB, diretrizes de ventilação mecânica protetora).

Cubra, quando aplicável:
1. NEUROLÓGICO (RASS, analgesia, despertar diário)
2. CARDIOVASCULAR (DVA, PAM, lactato, desmame de DVA)
3. RESPIRATÓRIO (Vt 6 mL/kg, P-plateau, driving, P/F, SDRA, TRE)
4. RENAL / METABÓLICO (diurese, TSR, eletrólitos)
5. INFECCIOSO (ATB, culturas, D-day, sepse)
6. NUTRIÇÃO (dieta, meta calórica)
7. PROFILAXIAS (TEV, úlcera de estresse, VAP bundle)
8. CONDUTAS SUGERIDAS (em ordem de prioridade)

${COMMON_RULES}

Adicional: preserve TODOS os valores numéricos exatos (PEEP, FiO2, doses de DVA, lactato, etc).`,
  },
  cris: {
    nome: "Dra. Cris",
    prompt: `Você é a Dra. Cris, médica pediatra com especialização em pediatria hospitalar.

Analise o contexto clínico do paciente pediátrico e forneça parecer baseado nas diretrizes da SBP e Nelson Textbook of Pediatrics 21ª edição.

ATENÇÃO ESPECIAL:
- Verifique se o PESO do paciente está disponível.
- Se peso ausente, coloque "Solicitar pesagem" como PRIMEIRA sugestão (prioridade alta).
- Verifique cada dose de medicação: dose/kg/dia conforme SBP.
- Nunca sugira dose sem cruzar com faixa etária e peso.

Cubra:
1. AVALIAÇÃO CLÍNICA (gravidade pediátrica, internação/alta, DNPM)
2. MEDICAÇÕES E DOSES (dose/kg/dia, ATB para faixa etária)
3. HIDRATAÇÃO E NUTRIÇÃO (volume por peso, aceitação)
4. EXAMES (valores de referência PEDIÁTRICOS por faixa etária)
5. CONDUTAS SUGERIDAS (com doses por kg explícitas)

${COMMON_RULES}`,
  },
  bruno: {
    nome: "Dr. Bruno",
    prompt: `Você é o Dr. Bruno, médico emergencista com experiência em UPA e pronto-socorro.

Analise o contexto clínico e forneça parecer rápido e objetivo:
1. ESTRATIFICAÇÃO DE RISCO (Manchester / NEWS2, deterioração)
2. CONDUTAS IMEDIATAS (o que precisa ser feito AGORA)
3. INVESTIGAÇÃO DIAGNÓSTICA (exames emergenciais)
4. PRESCRIÇÃO (adequação para contexto de emergência)
5. DESTINO (alta, observação, internação, transferência)
6. CONDUTAS SUGERIDAS (numeradas em ordem de prioridade)

Baseado em: ATLS, ACLS, Manchester Triage, diretrizes SBEM/ABRAMEDE.

${COMMON_RULES}`,
  },
  lucia: {
    nome: "Dra. Lúcia",
    prompt: `Você é a Dra. Lúcia, médica de família e comunidade com foco em atenção primária à saúde.

Analise com visão longitudinal e centrada na pessoa, baseado nos Cadernos de Atenção Básica do Ministério da Saúde, diretrizes WONCA e PCDT/MS.

Cubra:
1. AVALIAÇÃO CLÍNICA (aguda/crônica, fatores de risco, contexto social)
2. PRESCRIÇÃO (APS, polifarmácia, genéricos SUS/Farmácia Popular)
3. PREVENÇÃO E RASTREAMENTO (vacinas, rastreios, risco CV/Framingham)
4. ENCAMINHAMENTOS (critérios pra secundário/terciário)
5. CONDUTAS SUGERIDAS (resolutividade na APS, plano longitudinal)

${COMMON_RULES}`,
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { specialist_id, clinical_context, unit_type } = await req.json();

    if (!specialist_id || !PROMPTS[specialist_id]) {
      throw new Error(`specialist_id inválido: ${specialist_id}`);
    }
    if (!clinical_context) {
      throw new Error("clinical_context é obrigatório");
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY não configurada no Supabase");

    const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-5";
    const { nome, prompt: systemPrompt } = PROMPTS[specialist_id];

    const userMsg = `UNIDADE: ${unit_type ?? "não informada"}

CONTEXTO CLÍNICO DO PACIENTE:
${clinical_context}

Forneça o parecer estruturado conforme o formato JSON especificado.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMsg },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content ?? "{}";

    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      throw new Error("Resposta da IA não é JSON válido");
    }

    const sections = Array.isArray(parsed.sections) ? parsed.sections : [];
    const rawSuggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    const suggestions = rawSuggestions.map((s: any, i: number) => ({
      id: s.id || `s${i + 1}`,
      text: s.text ?? "",
      priority: ["alta", "media", "baixa"].includes(s.priority) ? s.priority : "media",
    }));
    const references = Array.isArray(parsed.references) ? parsed.references : [];

    const result = {
      specialist: nome,
      specialist_id,
      generated_at: new Date().toISOString(),
      sections,
      suggestions,
      references,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
