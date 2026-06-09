import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractText } from "../_shared/fileToText.ts";

/**
 * lab-extractor v9 — agora com pre-extração de texto sem IA.
 *
 * Fluxo:
 *   1. Se fileBase64 + fileType: tenta extractText() (unpdf/mammoth/sheetjs)
 *      que usa cache SHA-256. Se conseguir texto, manda pro gpt-5 como TEXTO
 *      (input barato).
 *   2. Se for imagem (JPG/PNG/HEIC), usa vision do gpt-5 (caminho atual).
 *   3. Se for PDF que unpdf não conseguiu (scanneado), fallback pra
 *      Responses API com input_file (vision interno).
 *   4. Texto puro vai direto pro chat completions.
 *
 * Economia esperada: PDF/docx/xlsx ~10x mais barato (texto vs image_url).
 *
 * IMPORTANTE: o deploy via MCP precisa do fileToText.ts incluído como
 * segundo arquivo (mesmo dir). O import "../_shared/" funciona local mas
 * é substituído por "./fileToText.ts" no payload do deploy. Ver
 * supabase/functions/_shared/fileToText.ts pra fonte de verdade.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { inputText, patientContext, fileBase64, fileType, fileName } = body;

    if (!inputText && !fileBase64) {
      throw new Error("inputText ou fileBase64 é obrigatório");
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-5";
    if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY secret");

    const systemPrompt = `Você é um extrator de exames laboratoriais para o sistema médico DOUTOR AJUDA.
Retorne exclusivamente JSON puro (sem markdown).
Nunca invente valores. Se um valor não for encontrado, retorne null.
Se um valor estiver ilegível ou duvidoso, coloque o nome do campo em valores_duvidosos.

DATA DO EXAME:
- Preserve a data se encontrada, formato dd/mm/aa.
- Se a imagem/texto NÃO TIVER DATA visível, deixe data_exame como null E use "-LAB:" no texto_formatado.
- NUNCA deixe de gerar texto_formatado por causa de data ausente.

NOTAÇÃO BRASILEIRA: vírgula = decimal. Notação científica "2,1.10⁶" = 2.100.000.

SINÔNIMOS: Hb/HGB/Hemoglobina; Ht/HCT/Hematócrito; Hc/Hemácias/Eritrócitos;
VCM/MCV; HCM/MCH; CHCM/MCHC; RDW; Leuco/WBC; Bastões/Bast; Seg/Neutrófilos;
Lnf/Linfócitos; Mono; Eos; Baso; PLQ/PLT/Plaquetas; Cr/Crea/Creatinina; Ur/Ureia;
Na/Sódio; K/Potássio; Ca; Mg; P; PCR; Lactato; TGO/AST; TGP/ALT; GGT; FA;
BT/BD/BI; INR; TP; TTPA; Albumina; Glicemia; HbA1c; TSH; T4L; Troponina; CK; CK-MB;
EAS/Piócitos/Nitrito.

FORMATO texto_formatado (Dr. Luan): "-LAB (dd/mm/aa):" se tiver data, senão "-LAB:". Campos por " | ".
Ordem: HB, HT, VCM/HCM se anemia, LEUCO (com diferencial se >11k ou <4k), PLQ, CR, UR, NA, K, PCR.

EXEMPLOS:
-LAB (18/05/26): HB 10 | HT 33 | VCM 78 | HCM 25 | LEUCO 14.500 (às custas de 80% SEG / 4% BAST / 12% LNF) | PLQ 220.000 | CR 1.4 | UR 60 | NA 138 | K 4.2 | PCR 35
-LAB: HB 8.5 | HT 24 | VCM 112 | HCM 26

ALERTAS: "anemia (Hb X)" / "macrocítica" se VCM >100 / "microcítica" se VCM <80 /
"leucocitose" / "plaquetopenia" / "piora renal (Cr X)" / "hiponatremia" / "hiperpotassemia".

REGRA DE OURO: SEMPRE gere texto_formatado mesmo com 1 valor.

JSON: { data_exame, tipo_exame:[], valores:{hb,ht,vcm,hcm,chcm,rdw,hemacias,leucocitos,bastoes_percent,segmentados_percent,linfocitos_percent,monocitos_percent,eosinofilos_percent,basofilos_percent,plaquetas,creatinina,ureia,sodio,potassio,calcio,magnesio,fosforo,pcr,lactato,tgo,tgp,ggt,fa,bilirrubina_total,bilirrubina_direta,bilirrubina_indireta,inr,tp,ttpa,albumina,glicemia,hba1c,tsh,t4l,troponina,ck,ck_mb,eas_piocitos,eas_nitrito,eas_hemacias,eas_proteinas}, texto_formatado, eas_formatado, alertas:[], valores_duvidosos:[], campos_nao_encontrados:[] }`;

    const ctx = patientContext ? `Contexto do paciente: ${JSON.stringify(patientContext)}\n\n` : "";

    // 1. Pre-extração sem IA (unpdf/mammoth/sheetjs + cache)
    let preExtracted: string | null = null;
    let preExtractedSource = "";
    if (fileBase64 && fileType) {
      try {
        const result = await extractText({ fileBase64, fileType, fileName });
        if (result) {
          preExtracted = result.text;
          preExtractedSource = result.cached ? "cache" : result.extractor;
          console.log(`[lab-extractor] ${preExtractedSource}: ${preExtracted.length} chars, ${fileName ?? fileType}`);
        }
      } catch (e) {
        console.warn("Pre-extract falhou, fallback vision", e);
      }
    }

    let openaiUrl: string;
    let openaiPayload: any;

    if (preExtracted) {
      openaiUrl = "https://api.openai.com/v1/chat/completions";
      const combinedText = inputText ? `${preExtracted}\n\n--- TEXTO ADICIONAL ---\n${inputText}` : preExtracted;
      openaiPayload = {
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${ctx}Texto do laboratório (extraído de ${fileName ?? fileType}):\n${combinedText}` },
        ],
        response_format: { type: "json_object" },
      };
    } else if (fileBase64 && fileType && fileType.startsWith("image/")) {
      openaiUrl = "https://api.openai.com/v1/chat/completions";
      openaiPayload = {
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${fileType};base64,${fileBase64}` } },
              { type: "text", text: `${ctx}Extraia os valores do exame da imagem. SEMPRE gere texto_formatado.${inputText ? `\n\nTexto adicional:\n${inputText}` : ""}` },
            ],
          },
        ],
        response_format: { type: "json_object" },
      };
    } else if (fileBase64 && fileType === "application/pdf") {
      // PDF scanneado (unpdf retornou null): Responses API com input_file
      openaiUrl = "https://api.openai.com/v1/responses";
      openaiPayload = {
        model: OPENAI_MODEL,
        input: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "input_text", text: `${ctx}Extraia valores do PDF ${fileName ?? "laudo.pdf"}. SEMPRE gere texto_formatado.` },
              { type: "input_file", filename: fileName ?? "laudo.pdf", file_data: `data:application/pdf;base64,${fileBase64}` },
            ],
          },
        ],
        text: { format: { type: "json_object" } },
      };
    } else {
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
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(openaiPayload),
    });

    if (!response.ok) throw new Error(`OpenAI Error: ${await response.text()}`);
    const data = await response.json();

    const isResponsesApi = openaiUrl.includes("/v1/responses");
    let content: string;
    if (isResponsesApi) {
      content = data.output_text
        ?? data.output?.flatMap((o: any) => o.content ?? []).map((c: any) => c.text ?? "").join("\n")
        ?? "{}";
    } else {
      content = data.choices?.[0]?.message?.content ?? "{}";
    }

    content = content.trim();
    if (content.startsWith("```json")) content = content.replace(/^```json/, "").replace(/```$/, "").trim();
    else if (content.startsWith("```")) content = content.replace(/^```/, "").replace(/```$/, "").trim();

    const parsed = JSON.parse(content);
    if (preExtractedSource) parsed._extractor = preExtractedSource;

    return new Response(JSON.stringify(parsed), {
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
</content>
</invoke>