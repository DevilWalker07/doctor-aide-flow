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
Retorne exclusivamente JSON puro (sem markdown).
Nunca invente valores. Se um valor não for encontrado, retorne null.
Se um valor estiver ilegível ou duvidoso, coloque o nome do campo em valores_duvidosos.

DATA DO EXAME:
- Preserve a data se encontrada, formato dd/mm/aa.
- Se a imagem/texto NÃO TIVER DATA visível, deixe data_exame como null E use "-LAB:" (sem parênteses) no texto_formatado.
- NUNCA deixe de gerar texto_formatado por causa de data ausente.

NOTAÇÃO BRASILEIRA (importante):
- Vírgula = decimal. "8,5" significa 8.5 (escreva no JSON como 8.5).
- Notação científica: "2,1.10⁶" = 2.100.000 = 2,1 milhões. Mantenha como 2.1 em valores se for milhões; no texto_formatado escreva o valor por mil/milhões como aparece no laudo.

SINÔNIMOS (reconheça TODOS):
Hemoglobina/Hb/HGB; Hematócrito/Ht/HCT; Hemácias/Hc/Eritrócitos/RBC;
VCM/MCV; HCM/MCH; CHCM/MCHC; RDW; Leucócitos/Leuco/WBC;
Bastões/Bast; Segmentados/Seg/Neutrófilos; Linfócitos/Lnf;
Monócitos/Mono; Eosinófilos/Eos; Basófilos/Baso;
Plaquetas/PLQ/PLT; Creatinina/Cr/Crea; Ureia/Ur;
Sódio/Na; Potássio/K; Cálcio/Ca; Magnésio/Mg; Fósforo/P;
PCR/Proteína C Reativa; Lactato;
TGO/AST; TGP/ALT; GGT; FA/Fosfatase Alcalina;
Bilirrubinas (BT/BD/BI); INR; TP; TTPA; Albumina;
Glicemia; HbA1c; TSH; T4L; Troponina; CK; CK-MB;
EAS/Piócitos/Leucócitos urina/Nitrito.

FORMATO DO texto_formatado (Dr. Luan) — OBRIGATÓRIO:
- Prefixo: "-LAB (dd/mm/aa):" se tiver data, ou "-LAB:" se não tiver.
- Campos separados por " | ". Inclua SOMENTE os parâmetros encontrados.
- Ordem fixa: HB, HT, VCM, HCM (se Hb anormal), LEUCO (com diferencial se leucocitose/leucopenia), PLQ, CR, UR, NA, K, PCR.

VCM/HCM: SEMPRE incluir se anemia (Hb <12 mulher / <13 homem) OU poliglobulia.
DIFERENCIAL: incluir em pelo menos 3 células se LEUCO >11000 ou <4000, OU bastonetose isolada (Bast >7%).

EXEMPLO COM DATA:
-LAB (18/05/26): HB 10 | HT 33 | VCM 78 | HCM 25 | LEUCO 14.500 (às custas de 80% SEG / 4% BAST / 12% LNF) | PLQ 220.000 | CR 1.4 | UR 60 | NA 138 | K 4.2 | PCR 35

EXEMPLO SEM DATA:
-LAB: HB 8.5 | HT 24 | VCM 112 | HCM 26 | HEMACIAS 2.1 MI

ALERTAS:
- "anemia (Hb X)" / "anemia macrocítica (Hb X, VCM Y)" se VCM >100 / "anemia microcítica" se VCM <80
- "leucocitose" / "leucopenia" / "plaquetopenia" / "plaquetose"
- "piora renal (Cr X)" se Cr >1.3
- "hiponatremia" / "hipopotassemia" / "hiperpotassemia"

Se houver EAS:
EAS (dd/mm/aa): X PIÓCITOS/CAMPO | NITRITO POSITIVO/NEGATIVO | HEMÁCIAS X | PROTEÍNAS X

REGRA DE OURO: Mesmo que encontre APENAS 1 valor, gere o texto_formatado. NUNCA retorne texto_formatado=null se houver pelo menos 1 valor extraído.

JSON de resposta:
{
  "data_exame": "dd/mm/aa ou null",
  "tipo_exame": [],
  "valores": {
    "hb": null, "ht": null, "vcm": null, "hcm": null, "chcm": null, "rdw": null,
    "hemacias": null,
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

    const ctx = patientContext ? `Contexto do paciente: ${JSON.stringify(patientContext)}\n\n` : "";
    const isPdf = fileBase64 && fileType === "application/pdf";

    let openaiUrl: string;
    let openaiPayload: any;

    if (isPdf) {
      // PDF: usa Responses API com input_file (gpt-5 nativo, OCR + extração).
      // Antes anexávamos só o nome do arquivo no texto — a IA inventava
      // valores ou retornava vazio. Agora o PDF é REALMENTE processado.
      openaiUrl = "https://api.openai.com/v1/responses";
      const content = [
        {
          type: "input_text",
          text: `${ctx}Extraia os valores do laboratório deste PDF (arquivo: ${fileName ?? "laudo.pdf"}). Lembre: SEMPRE gere texto_formatado mesmo sem data — use "-LAB:" se não tiver data.`,
        },
        {
          type: "input_file",
          filename: fileName ?? "laudo.pdf",
          file_data: `data:application/pdf;base64,${fileBase64}`,
        },
      ];
      openaiPayload = {
        model: OPENAI_MODEL,
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content },
        ],
        text: { format: { type: "json_object" } },
      };
    } else if (fileBase64 && fileType && fileType.startsWith("image/")) {
      // Imagem: chat completions com image_url (multimodal padrão)
      openaiUrl = "https://api.openai.com/v1/chat/completions";
      const userContent = [
        { type: "image_url", image_url: { url: `data:${fileType};base64,${fileBase64}` } },
        {
          type: "text",
          text: `${ctx}Extraia os valores do exame da imagem (arquivo: ${fileName ?? "imagem"}). Lembre: SEMPRE gere texto_formatado mesmo sem data — use "-LAB:" se não tiver data.${inputText ? `\n\nTexto adicional:\n${inputText}` : ""}`,
        },
      ];
      openaiPayload = {
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      };
    } else {
      // Texto puro
      openaiUrl = "https://api.openai.com/v1/chat/completions";
      openaiPayload = {
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${ctx}Texto do laboratório:\n${inputText}` },
        ],
        response_format: { type: "json_object" },
      };
    }

    const response = await fetch(openaiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(openaiPayload),
    });

    if (!response.ok) {
      throw new Error(`OpenAI Error: ${await response.text()}`);
    }

    const data = await response.json();

    // Responses API e Chat Completions API tem shapes diferentes
    let content: string;
    if (isPdf) {
      content = data.output_text
        ?? data.output?.flatMap((o: any) => o.content ?? []).map((c: any) => c.text ?? "").join("\n")
        ?? "{}";
    } else {
      content = data.choices?.[0]?.message?.content ?? "{}";
    }

    content = content.trim();
    if (content.startsWith("```json")) {
      content = content.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (content.startsWith("```")) {
      content = content.replace(/^```/, "").replace(/```$/, "").trim();
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
