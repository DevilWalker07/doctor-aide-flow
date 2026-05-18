import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function safeJson(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(cleaned); } catch (_) { return { raw_summary: cleaned, parse_error: true }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { fileName, fileType, fileBase64, text } = await req.json();
    if (!fileName && !text) throw new Error("fileName ou text é obrigatório");

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY não configurada no Supabase");

    const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-5";

    const systemPrompt = `
VOCÊ É UM EXTRATOR OCR/IA DE DOCUMENTOS CLÍNICOS HOSPITALARES BRASILEIROS.

OBJETIVO:
LER PDF, IMAGEM, FOTO DE PRONTUÁRIO, TXT OU DOCUMENTO CONVERTIDO E EXTRAIR TODOS OS DADOS POSSÍVEIS PARA PREENCHER EVOLUÇÃO MÉDICA, PRESCRIÇÃO, MAPA DE PLANTÃO E ENCAMINHAMENTOS.

REGRAS ABSOLUTAS:
1. NUNCA INVENTE DADOS.
2. SE NÃO TIVER CERTEZA, USE "[CONFIRMAR]".
3. SE ESTIVER ILEGÍVEL, USE "[DADO POUCO LEGÍVEL]".
4. SE NÃO EXISTIR NO DOCUMENTO, USE null OU [].
5. DIFERENCIE DADO EXTRAÍDO DE INFERÊNCIA.
6. PRESERVE DOSE, VIA, INTERVALO E DATA EXATAMENTE COMO APARECEM.
7. RETORNE SOMENTE JSON VÁLIDO, SEM MARKDOWN.
8. EXTRAIA LABORATÓRIOS EM FORMATO COMPACTO COM BARRAS VERTICAIS.
9. ORGANIZE ANTIBIÓTICOS COM DATA DE INÍCIO, DATA DE FIM, DOSE, VIA, INTERVALO E STATUS.
10. EXTRAIA PENDÊNCIAS E CONDUTAS.

REGRAS CRÍTICAS PARA ANTIBIÓTICOS (LEIA COM ATENÇÃO):
O documento PODE conter ATBs em estados diferentes:
  (a) ATB EM USO AGORA → status="ativo", end_date=null
  (b) ATB JÁ FINALIZADO/COMPLETADO → status="finalizado", end_date=DATA EM QUE TERMINOU
  (c) ATB SUSPENSO POR INTOLERÂNCIA/TROCA → status="suspenso", end_date=DATA EM QUE FOI SUSPENSO

EXEMPLOS DE PISTAS QUE INDICAM ATB FINALIZADO/SUSPENSO:
- "Ceftriaxona D7/7 — concluído", "ceftriaxona finalizada em 18/05"
- "Sus pendeu meropenem em 10/05", "trocado por X em 12/05"
- "ATB prévio: ceftriaxona 10–18/05 (8 dias)"
- Frases em evolução de dias passados mencionando ATB que NÃO aparece mais na prescrição atual

REGRA DE OURO: Se um ATB aparece SÓ no histórico/evolução anterior mas NÃO aparece na prescrição ATUAL, ele provavelmente está finalizado.
NUNCA marque um ATB já finalizado como "ativo" — isso faz o sistema contar D-day errado.
Se houver QUALQUER dúvida sobre estado, marque end_date como null mas adicione um item em uncertain_fields explicando.

JSON OBRIGATÓRIO:
{
  "document_category": "EVOLUCAO_ANTERIOR|PRESCRICAO_ATIVA|LABORATORIO|IMAGEM_LAUDO|ANAMNESE|ALTA|ENCAMINHAMENTO|OUTRO",
  "confidence": 0,
  "patient_identification": {
    "name": null,
    "mother_name": null,
    "sex": null,
    "birth_date": null,
    "age": null,
    "admission_date": null,
    "medical_record": null,
    "unit": null,
    "ward": null,
    "bed": null
  },
  "clinical_data": {
    "reason_for_admission": null,
    "history": null,
    "comorbidities": [],
    "problem_list_active": [],
    "problem_list_resolved": [],
    "current_evolution": null,
    "physical_exam": {
      "general": null,
      "cardiovascular": null,
      "respiratory": null,
      "abdomen": null,
      "neuro": null,
      "extremities": null,
      "skin": null,
      "genitourinary": null
    },
    "labs": [
      { "date": null, "compact_text": "", "values": {} }
    ],
    "imaging": [
      { "date": null, "type": "", "result": "", "impression": "" }
    ],
    "medications": [
      { "name": "", "dose": null, "route": null, "frequency": null, "indication": null }
    ],
    "antibiotics": [
      { "name": "", "dose": null, "route": null, "frequency": null, "start_date": null, "end_date": null, "start_time": null, "status": "ativo" }
    ],
    "diet": null,
    "devices": [],
    "oxygen": null,
    "pending_issues": [],
    "conducts": []
  },
  "suggested_patient": {
    "name": null,
    "age": null,
    "sex": null,
    "bed": null,
    "sector": null,
    "admission": null,
    "hda": null
  },
  "safety_alerts": [],
  "uncertain_fields": [],
  "raw_summary": ""
}

ALERTAS A PROCURAR:
SNE/risco de broncoaspiração; SVD/grumos/coágulos/obstrução; idoso/acamadado/risco LPP; déficit motor/AVC/disfagia; IC/sobrecarga; celulite/erisipela com bolhas, necrose, dor desproporcional, PCR/leuco alto; ATB com tempo prolongado; febre persistente; piora renal.
`;

    const userText = `Extraia todos os dados clínicos possíveis deste documento para preencher evolução médica no modelo do Dr. Luan Carvalho. Arquivo: ${fileName ?? "texto"}. Tipo: ${fileType ?? "text/plain"}.`;

    const content: any[] = [
      { type: "input_text", text: systemPrompt + "\n\n" + userText + (text ? `\n\nTEXTO:\n${text}` : "") },
    ];

    if (fileBase64 && fileName) {
      const mime = fileType || "application/octet-stream";
      if (mime.startsWith("image/")) {
        content.push({ type: "input_image", image_url: `data:${mime};base64,${fileBase64}` });
      } else {
        content.push({ type: "input_file", filename: fileName, file_data: `data:${mime};base64,${fileBase64}` });
      }
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [{ role: "user", content }],
        text: { format: { type: "json_object" } },
      }),
    });

    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    const outputText =
      data.output_text ??
      data.output?.flatMap((o: any) => o.content ?? []).map((c: any) => c.text ?? "").join("\n") ??
      "{}";
    const parsed = safeJson(outputText);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
