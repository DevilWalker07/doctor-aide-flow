import { supabase, hasSupabaseConfig } from "./supabase";

function getSettings() {
  const engine = localStorage.getItem("ai_engine") || "openai";
  const apiKey = localStorage.getItem("ai_api_key") || (import.meta as any).env?.VITE_OPENAI_API_KEY || "";
  return { engine, apiKey };
}

const LAB_PROMPT = `Você é um assistente médico especializado em estruturar resultados de exames laboratoriais para evoluções hospitalares brasileiras.

REGRAS ABSOLUTAS:
1. NUNCA invente valores. Se um exame NÃO está no texto, NÃO o inclua.
2. Use APENAS os valores que estão explícitos no texto fornecido.
3. Se um valor não consta, NÃO coloque. Simplesmente omita.
4. Formate o resultado no padrão médico brasileiro de evolução.

FORMATO DE SAÍDA — retorne JSON:
{
  "data_exame": "25/04/2026",
  "valores": {
    "Hemoglobina": "8,5",
    "Hematócrito": "24",
    "VCM": "112"
  },
  "texto_formatado": "HB 8,5 | HT 24 (ANEMIA SEVERA MACROCÍTICA VCM 112) | LEUCO 12.000 (SEG 85% BAST 0% LINF 10%) | PLQ 332.000 | PCR 85",
  "alertas": ["ANEMIA SEVERA", "PCR ELEVADA"],
  "interpretacao": "ANEMIA MACROCÍTICA COM HB 8,5 E VCM 112. LEUCOCITOSE NEUTROFÍLICA. PCR ELEVADA."
}

REGRAS DO texto_formatado:
- Use o formato compacto: EXAME VALOR | EXAME VALOR
- Use separadores | entre exames
- Adicione comentários clínicos entre parênteses quando pertinente: (ANEMIA SEVERA MACROCÍTICA VCM 112)
- Para hemograma: inclua diferencial se disponível: LEUCO 12.000 (SEG 85% BAST 0%)
- Valores ALTERADOS devem ser sinalizados nos alertas
- Se a data do exame não estiver no texto, use a data de hoje

REGRAS do campo "valores":
- Inclua SOMENTE exames que existem no texto
- Chave = nome do exame (ex: "Hemoglobina", "Creatinina", "PCR")
- Valor = string com o valor exato do texto

REGRAS do campo "alertas":
- Liste apenas alertas baseados em valores REAIS do texto
- Exemplos: "ANEMIA SEVERA", "LEUCOCITOSE", "PCR ELEVADA", "TROMBOCITOPENIA", "HIPONATREMIA"
- NÃO gere alertas para exames que não constam

VALORES DE REFERÊNCIA para gerar alertas:
- HB < 7: ANEMIA GRAVE | HB < 10: ANEMIA
- HT < 30: HEMATÓCRITO BAIXO
- LEUCO > 12.000: LEUCOCITOSE | LEUCO < 4.000: LEUCOPENIA
- PLQ < 100.000: TROMBOCITOPENIA | PLQ < 50.000: TROMBOCITOPENIA GRAVE
- CR > 1.5: ELEVAÇÃO DE CREATININA
- K > 5.5: HIPERCALEMIA | K < 3.5: HIPOCALEMIA
- NA < 135: HIPONATREMIA | NA > 145: HIPERNATREMIA
- PCR > 10: PCR ELEVADA

Texto dos exames do paciente:`;

async function callAIForLab(text: string, patientContext: any) {
  const { engine, apiKey } = getSettings();
  
  if (!apiKey) {
    throw new Error("Sem chave de API. Configure nas Configurações.");
  }

  const url = engine === "groq" 
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  
  const model = engine === "groq" ? "llama-3.1-8b-instant" : "gpt-3.5-turbo-1106";

  const contextNote = patientContext?.name 
    ? `\nContexto do paciente: ${patientContext.name}, ${patientContext.age} anos, ${patientContext.sex === "F" ? "feminino" : "masculino"}.`
    : "";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: "user",
        content: `${LAB_PROMPT}${contextNote}\n\n${text}`
      }],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `Erro HTTP ${response.status}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

export async function extractLabWithAI(inputText: string, patientContext: any) {
  // Prioridade 1: Supabase Edge Function (produção)
  if (hasSupabaseConfig) {
    try {
      const { data, error } = await supabase.functions.invoke("lab-extractor", {
        body: { inputText, patientContext },
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Falha na Edge Function, tentando API direta:", err);
    }
  }

  // Prioridade 2: API direta (OpenAI ou Groq)
  const { apiKey } = getSettings();
  if (apiKey) {
    return await callAIForLab(inputText, patientContext);
  }

  // Prioridade 3: Fallback local (parseia o texto literalmente, nunca inventa)
  return fallbackLabExtraction(inputText);
}

export async function generateEvolutionWithAI(payload: any) {
  const { engine, apiKey } = getSettings();
  
  if (!apiKey) {
    throw new Error("API Key não configurada. Vá em configurações.");
  }

  const url = engine === "groq" 
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  
  const model = engine === "groq" ? "llama-3.1-70b-versatile" : "gpt-4o-mini";

  const prompt = `Você é um médico preceptor de clínica médica de um hospital de elite. 
Sua tarefa é gerar uma EVOLUÇÃO MÉDICA PADRÃO-OURO baseada nos dados estruturados abaixo.

REGRAS:
1. Use terminologia médica técnica e precisa (ex: "eupneico", "normotenso", "abdome plano e flácido").
2. Estruture em seções: # LISTA DE PROBLEMAS, # SITUAÇÃO ATUAL (S), # EXAME FÍSICO (O), # EXAMES COMPLEMENTARES, # AVALIAÇÃO E CONDUTAS (A/P).
3. Seja conciso mas completo.
4. Se houver alertas (como PCR subindo ou Cr alta), destaque na seção de AVALIAÇÃO.
5. Se houver antibióticos, especifique o dia do ciclo (D-dia).
6. TUDO EM CAIXA ALTA (LETRA MAIÚSCULA).

DADOS DO PACIENTE:
${JSON.stringify(payload, null, 2)}

SAÍDA: Apenas o texto da evolução formatado, sem comentários adicionais.`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Você é um assistente médico de elite." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Erro na IA");
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// Fallback: parseia o texto bruto SEM inventar dados
function fallbackLabExtraction(text: string) {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const upper = text.toUpperCase();
  const valores: Record<string, string> = {};
  const alertas: string[] = [];

  // Padrões comuns de exames brasileiros
  const patterns: [RegExp, string][] = [
    [/(?:HB|HEMOGLOBINA)[:\s]*(\d+[.,]\d+|\d+)/i, "Hemoglobina"],
    [/(?:HT|HEMAT[OÓ]CRITO)[:\s]*(\d+[.,]?\d*)/i, "Hematócrito"],
    [/VCM[:\s]*(\d+[.,]?\d*)/i, "VCM"],
    [/HCM[:\s]*(\d+[.,]?\d*)/i, "HCM"],
    [/CHCM[:\s]*(\d+[.,]?\d*)/i, "CHCM"],
    [/(?:LEUCO|LEUC[OÓ]CITOS?)[:\s]*(\d+[.,]?\d*)/i, "Leucócitos"],
    [/(?:PLQ|PLAQUETAS?)[:\s]*(\d+[.,]?\d*)/i, "Plaquetas"],
    [/(?:CR|CREATININA)[:\s]*(\d+[.,]\d+|\d+)/i, "Creatinina"],
    [/(?:UR|UR[EÉ]IA)[:\s]*(\d+[.,]?\d*)/i, "Ureia"],
    [/(?:NA|S[OÓ]DIO)[:\s]*(\d+[.,]?\d*)/i, "Sódio"],
    [/(?:K|POT[AÁ]SSIO)[:\s]*(\d+[.,]\d+|\d+)/i, "Potássio"],
    [/(?:PCR|PROTE[IÍ]NA C REATIVA)[:\s]*(\d+[.,]?\d*)/i, "PCR"],
    [/(?:SEG|SEGMENTADOS)[:\s]*(\d+[.,]?\d*)\s*%?/i, "Segmentados"],
    [/(?:BAST|BAST[OÕ]ES)[:\s]*(\d+[.,]?\d*)\s*%?/i, "Bastões"],
    [/(?:LINF|LINF[OÓ]CITOS)[:\s]*(\d+[.,]?\d*)\s*%?/i, "Linfócitos"],
    [/(?:HEM[AÁ]CIAS|HC)[:\s]*(\d+[.,]?\d*)/i, "Hemácias"],
    [/(?:TGO|AST)[:\s]*(\d+[.,]?\d*)/i, "TGO"],
    [/(?:TGP|ALT)[:\s]*(\d+[.,]?\d*)/i, "TGP"],
    [/(?:BT|BILIRRUBINA TOTAL)[:\s]*(\d+[.,]?\d*)/i, "Bilirrubina Total"],
    [/(?:BD|BILIRRUBINA DIRETA)[:\s]*(\d+[.,]?\d*)/i, "Bilirrubina Direta"],
    [/(?:LACTATO)[:\s]*(\d+[.,]?\d*)/i, "Lactato"],
    [/(?:ALBUMINA)[:\s]*(\d+[.,]?\d*)/i, "Albumina"],
    [/(?:GLICEMIA|GLI)[:\s]*(\d+[.,]?\d*)/i, "Glicemia"],
  ];

  for (const [regex, name] of patterns) {
    const match = upper.match(regex);
    if (match) {
      valores[name] = match[1].replace(".", ",");
    }
  }

  // Gerar alertas baseados nos valores encontrados
  const hb = parseFloat((valores["Hemoglobina"] || "").replace(",", "."));
  if (hb && hb < 7) alertas.push("ANEMIA GRAVE");
  else if (hb && hb < 10) alertas.push("ANEMIA");

  const leuco = parseFloat((valores["Leucócitos"] || "").replace(",", "."));
  if (leuco && leuco > 12000) alertas.push("LEUCOCITOSE");
  else if (leuco && leuco < 4000) alertas.push("LEUCOPENIA");

  const pcr = parseFloat((valores["PCR"] || "").replace(",", "."));
  if (pcr && pcr > 10) alertas.push("PCR ELEVADA");

  const cr = parseFloat((valores["Creatinina"] || "").replace(",", "."));
  if (cr && cr > 1.5) alertas.push("ELEVAÇÃO DE CREATININA");

  // Formatar texto compacto
  const parts: string[] = [];
  if (valores["Hemoglobina"]) {
    let hbPart = `HB ${valores["Hemoglobina"]}`;
    if (valores["Hematócrito"]) hbPart += ` | HT ${valores["Hematócrito"]}`;
    const vcm = valores["VCM"];
    if (vcm) {
      const vcmNum = parseFloat(vcm.replace(",", "."));
      if (vcmNum > 98) hbPart += ` (ANEMIA MACROCÍTICA VCM ${vcm})`;
      else if (vcmNum < 82) hbPart += ` (ANEMIA MICROCÍTICA VCM ${vcm})`;
    }
    parts.push(hbPart);
  }

  if (valores["Leucócitos"]) {
    let leucPart = `LEUCO ${valores["Leucócitos"]}`;
    const diffs: string[] = [];
    if (valores["Segmentados"]) diffs.push(`SEG ${valores["Segmentados"]}%`);
    if (valores["Bastões"]) diffs.push(`BAST ${valores["Bastões"]}%`);
    if (valores["Linfócitos"]) diffs.push(`LINF ${valores["Linfócitos"]}%`);
    if (diffs.length > 0) leucPart += ` (${diffs.join(" ")})`;
    parts.push(leucPart);
  }

  if (valores["Plaquetas"]) parts.push(`PLQ ${valores["Plaquetas"]}`);
  if (valores["Creatinina"]) parts.push(`CR ${valores["Creatinina"]}`);
  if (valores["Ureia"]) parts.push(`UR ${valores["Ureia"]}`);
  if (valores["Sódio"]) parts.push(`NA ${valores["Sódio"]}`);
  if (valores["Potássio"]) parts.push(`K ${valores["Potássio"]}`);
  if (valores["PCR"]) parts.push(`PCR ${valores["PCR"]}`);
  if (valores["TGO"]) parts.push(`TGO ${valores["TGO"]}`);
  if (valores["TGP"]) parts.push(`TGP ${valores["TGP"]}`);
  if (valores["Glicemia"]) parts.push(`GLI ${valores["Glicemia"]}`);
  if (valores["Lactato"]) parts.push(`LACTATO ${valores["Lactato"]}`);
  if (valores["Albumina"]) parts.push(`ALB ${valores["Albumina"]}`);

  const formatted = parts.length > 0
    ? `LAB (${hoje}): ${parts.join(" | ")}`
    : `LAB (${hoje}): NENHUM VALOR IDENTIFICADO NO TEXTO — REVISAR MANUALMENTE`;

  return {
    data_exame: hoje,
    valores,
    texto_formatado: formatted,
    alertas,
    interpretacao: alertas.length > 0 ? alertas.join(". ") + "." : "SEM ALERTAS IDENTIFICADOS.",
  };
}
