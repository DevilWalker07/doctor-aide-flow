import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    // inputText: texto colado (legado). fileBase64/fileType/fileName: imagem ou PDF (novo).
    const { inputText, patientContext, fileBase64, fileType, fileName } = body;

    if (!inputText && !fileBase64) {
      throw new Error("inputText ou fileBase64 é obrigatório");
    }

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
Preserve SEMPRE a data do exame — formato dd/mm/aa (ex: 18/05/26).

Reconheça sinônimos:
Hemoglobina/Hb/HGB; Hematócrito/Ht/HCT; VCM; HCM; CHCM; RDW;
Leucócitos/Leuco/WBC; Bastões/Bast; Segmentados/Seg/Neutrófilos;
Linfócitos/Lnf/Linfo; Monócitos/Mono; Eosinófilos/Eos; Basófilos/Baso;
Plaquetas/PLQ/PLT; Creatinina/Cr/Crea; Ureia/Ur; Sódio/Na; Potássio/K;
Cálcio/Ca; Magnésio/Mg; Fósforo/P; PCR/Proteína C Reativa; Lactato;
TGO/AST; TGP/ALT; GGT; FA/Fosfatase Alcalina; Bilirrubinas (BT/BD/BI);
INR; TP; TTPA; Albumina; Glicemia; HbA1c; TSH; T4L; Troponina; CK; CK-MB;
EAS/piócitos/leucócitos urina/nitrito/hemácias/proteínas.

FORMATO DO texto_formatado — REGRA OBRIGATÓRIA (Dr. Luan):
Prefixo "-LAB (dd/mm/aa):" sempre. Campos separados por " | ". Inclua SOMENTE os parâmetros encontrados.
Ordem fixa: HB, HT, [VCM, HCM apenas se HB anormal → anemia ou poliglobulia],
LEUCO [valor] [se leucocitose >11.000 ou leucopenia <4.000: "(às custas de X% SEG / Y% BAST / Z% LNF)" usando o diferencial — pelo menos 3 células],
PLQ, CR, UR, NA, K, PCR, e demais valores encontrados.

EXEMPLO:
-LAB (18/05/26): HB 10 | HT 33 | VCM 78 | HCM 25 | LEUCO 14.500 (às custas de 80% SEG / 4% BAST / 12% LNF) | PLQ 220.000 | CR 1.4 | UR 60 | NA 138 | K 4.2 | PCR 35

EXEMPLO SEM ANEMIA E SEM LEUCOCITOSE:
-LAB (18/05/26): HB 13.5 | HT 41 | LEUCO 7.800 | PLQ 200.000 | CR 0.9 | UR 32 | NA 140 | K 4.0 | PCR 5

Se houver EAS:
EAS (dd/mm/aa): X PIÓCITOS/CAMPO | NITRITO POSITIVO/NEGATIVO | HEMÁCIAS X | PROTEÍNAS X

REGRAS DE ANORMALIDADE:
- Anemia: HB <12 (mulher) ou <13 (homem) → incluir VCM e HCM.
- Leucocitose: LEUCO >11.000. Leucopenia: <4.000. Em ambos casos, incluir diferencial percentual.
- Bastonetose: BAST >7% → SEMPRE incluir mesmo sem leucocitose.

JSON de resposta:
{
  "data_exame": "dd/mm/aa ou null",
  "tipo_exame": [],
  "valores": {
    "hb": null, "ht": null, "vcm": null, "hcm": null, "chcm": null, "rdw": null,
    "leucocitos": null,
    "bastoes_percent": null, "segmentados_percent": null, "linfocitos_percent": null,
    "monocitos_percent": null, "eosinofilos_percent": null, "basofilos_percent": null,
    "plaquetas": null,
    "creatinina": null, "ureia": null,
    "sodio": null, "potassio": null, "calcio": null, "magnesio": null, "fosforo": null,
    "pcr": null, "lactato": null,
    "tgo": null, "tgp": null, "ggt": null, "fa": null,
    "bilirrubina_total": null, "bilirrubina_direta": null, "bilirrubina_indireta": null,
    "inr": null, "tp": null, "ttpa": null,
    "albumina": null, "glicemia": null, "hba1c": null,
    "tsh": null, "t4l": null, "troponina": null, "ck": null, "ck_mb": null,
    "eas_piocitos": null, "eas_nitrito": null, "eas_hemacias": null, "eas_proteinas": null
  },
  "texto_formatado": null,
  "eas_formatado": null,
  "alertas": [],
  "valores_duvidosos": [],
  "campos_nao_encontrados": []
}
`;

    // Monta mensagem do user — texto E/OU imagem/PDF
    const userContent: any[] = [];
    const ctx = patientContext ? `Contexto do paciente: ${JSON.stringify(patientContext)}\n\n` : "";

    if (inputText) {
      userContent.push({
        type: "text",
        text: `${ctx}Texto do laboratório:\n${inputText}`,
      });
    }

    if (fileBase64 && fileType) {
      const dataUrl = `data:${fileType};base64,${fileBase64}`;
      if (fileType.startsWith("image/")) {
        userContent.push({ type: "image_url", image_url: { url: dataUrl } });
        if (!inputText) {
          userContent.push({
            type: "text",
            text: `${ctx}Extraia os valores do exame da imagem (arquivo: ${fileName ?? "imagem"}).`,
          });
        }
      } else if (fileType === "application/pdf") {
        // gpt-5 chat/completions suporta input_file via Responses API; aqui no Chat
        // Completions o jeito mais simples é descrever — vamos usar a Responses API.
        userContent.push({
          type: "text",
          text: `${ctx}PDF anexado (${fileName ?? "documento.pdf"}). Extraia os valores do laboratório.`,
        });
      }
    }

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
          { role: "user", content: userContent.length === 1 && userContent[0].type === "text" ? userContent[0].text : userContent },
        ],
        response_format: { type: "json_object" },
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
