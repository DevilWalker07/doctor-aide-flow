import { mapLimit } from "../lib/concurrency.js";
import { PASSAGEM_PLANTAO_BATCH_PROMPT } from "../prompts/passagemPlantaoBatch.prompt.js";
import {
  PassagemPlantaoBatchSchema,
  type AlertaCritico,
  type MapaPlantaoData,
  type PassagemPlantaoBatch,
  type PatientRow,
} from "../schemas/ai.schemas.js";
import { flagLabOutliers } from "./clinicalGuardrails.js";
import { safeJsonCompletion } from "./openaiClient.js";

export interface EvolucaoInput {
  fileName: string;
  text: string;
}

export interface ChunkOpts {
  maxCharsPerBatch: number;
  maxItemsPerBatch: number;
  maxCharsPerItem: number;
}

const DEFAULT_CHUNK: ChunkOpts = {
  maxCharsPerBatch: 12_000,
  maxItemsPerBatch: 6,
  maxCharsPerItem: 20_000,
};

export function chunkEvolucoes(
  items: EvolucaoInput[],
  opts: Partial<ChunkOpts> = {},
): EvolucaoInput[][] {
  const { maxCharsPerBatch, maxItemsPerBatch, maxCharsPerItem } = { ...DEFAULT_CHUNK, ...opts };
  const batches: EvolucaoInput[][] = [];
  let current: EvolucaoInput[] = [];
  let currentChars = 0;

  for (const raw of items) {
    const item =
      raw.text.length > maxCharsPerItem
        ? { ...raw, text: raw.text.slice(0, maxCharsPerItem) }
        : raw;
    const fits =
      current.length < maxItemsPerBatch && currentChars + item.text.length <= maxCharsPerBatch;
    if (!fits && current.length > 0) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(item);
    currentChars += item.text.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

export function normalizeLeito(s: string): string {
  const compact = s.toUpperCase().replace(/\s+/g, "");
  return /^\d/.test(compact) ? `L${compact}` : compact;
}

function leitoSortKey(leito: string): [number, string] {
  const m = normalizeLeito(leito).match(/(\d+)/);
  return [m ? Number(m[1]) : Number.MAX_SAFE_INTEGER, leito];
}

export function mergeBatchResults(batches: PassagemPlantaoBatch[]): MapaPlantaoData {
  const byLeito = new Map<string, PatientRow>();
  const alertas: AlertaCritico[] = [];
  const seenAlert = new Set<string>();

  for (const batch of batches) {
    for (const row of batch.pacientes) {
      const key = normalizeLeito(row.leito);
      if (!byLeito.has(key)) byLeito.set(key, row);
    }
    for (const alerta of batch.alertasCriticos) {
      const key = `${normalizeLeito(alerta.leito ?? "")}|${alerta.acao.toUpperCase()}`;
      if (seenAlert.has(key)) continue;
      seenAlert.add(key);
      alertas.push(alerta);
    }
  }

  const pacientes = [...byLeito.values()].sort((a, b) => {
    const [na, sa] = leitoSortKey(a.leito);
    const [nb, sb] = leitoSortKey(b.leito);
    return na - nb || sa.localeCompare(sb);
  });

  return applyLabGuardrails({ pacientes, alertasCriticos: alertas });
}

export function applyLabGuardrails(data: MapaPlantaoData): MapaPlantaoData {
  const alertas = [...data.alertasCriticos];
  const seen = new Set(
    alertas.map((a) => `${normalizeLeito(a.leito ?? "")}|${a.acao.toUpperCase()}`),
  );

  const pacientes = data.pacientes.map((row) => {
    const criticos = flagLabOutliers(row.ultimoLab).filter((f) => f.severity === "critical");
    if (criticos.length === 0) return row;

    const resumo = criticos.map((f) => f.message).join("; ");
    const linha = `!! LAB CRÍTICO: ${resumo} — REAVALIAR`;
    const jaTem = row.alertasPendencias.toUpperCase().includes("LAB CRÍTICO");
    const alertasPendencias = jaTem
      ? row.alertasPendencias
      : [linha, row.alertasPendencias].filter(Boolean).join("\n");

    const acao = `LAB CRÍTICO: ${resumo} — REAVALIAR`;
    const key = `${normalizeLeito(row.leito)}|${acao.toUpperCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      alertas.unshift({ prioridade: "!! URGENTE", leito: row.leito, paciente: row.paciente, acao });
    }
    return { ...row, alertasPendencias };
  });

  return { pacientes, alertasCriticos: alertas };
}

/**
 * Processa UM lote.
 *
 * Extraído de `gerarMapaPlantao` porque o fluxo assíncrono precisa chamar um
 * lote por invocação: na Vercel do plano hobby o teto é 60 s, e 15 arquivos
 * numa requisição só encostam nele. Se estourar, o médico fica sem nada no
 * meio do plantão.
 */
export async function processarLote(
  batch: EvolucaoInput[],
  index: number,
  total: number,
  setor: string,
  data: string,
): Promise<PassagemPlantaoBatch> {
  const payload = {
    setor,
    data,
    lote: `${index + 1}/${total}`,
    total_arquivos_no_lote: batch.length,
    evolucoes: batch.map((b) => `=== ARQUIVO: ${b.fileName} ===\n${b.text.trim()}`).join("\n\n"),
  };
  const result = await safeJsonCompletion(
    PASSAGEM_PLANTAO_BATCH_PROMPT,
    payload,
    PassagemPlantaoBatchSchema,
    { maxTokens: 8000, mockKey: "passagemBatch" },
  );
  if (!result.ok) {
    throw new Error(
      `${result.error}${result.issues ? ` (${result.issues.length} campos inválidos)` : ""}`,
    );
  }
  return result.data;
}

/** Consolida os lotes que deram certo. Mesma função nos dois fluxos. */
export function consolidar(
  ok: PassagemPlantaoBatch[],
  warnings: string[],
  batchesTotal: number,
  batchesFailed: number,
): GerarMapaResult {
  return { data: mergeBatchResults(ok), warnings, batchesTotal, batchesFailed };
}

export interface GerarMapaResult {
  data: MapaPlantaoData;
  warnings: string[];
  batchesTotal: number;
  batchesFailed: number;
}

export async function gerarMapaPlantao(
  items: EvolucaoInput[],
  setor: string,
  data: string,
  opts: { concurrency?: number; chunk?: Partial<ChunkOpts> } = {},
): Promise<GerarMapaResult> {
  const { concurrency = 3, chunk } = opts;
  const batches = chunkEvolucoes(items, chunk);
  const warnings: string[] = [];

  const settled = await mapLimit(batches, concurrency, (batch, index) =>
    processarLote(batch, index, batches.length, setor, data),
  );

  const ok: PassagemPlantaoBatch[] = [];
  let failed = 0;
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      ok.push(r.value);
    } else {
      failed++;
      const files = batches[i].map((b) => b.fileName).join(", ");
      const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
      warnings.push(`Lote ${i + 1} falhou (${files}): ${reason}`);
    }
  });

  return consolidar(ok, warnings, batches.length, failed);
}
