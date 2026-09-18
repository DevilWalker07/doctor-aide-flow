/**
 * Passagem de plantão como job encadeado, um lote por invocação.
 *
 * O caminho síncrono (`gerarMapaPlantao`) continua existindo e é o que o
 * contêiner usa. Este aqui existe por causa do teto de 60 s por invocação no
 * plano hobby da Vercel: 15 arquivos viram 3 lotes, e três chamadas de IA numa
 * requisição só encostam nesse teto. Se estourar, o médico fica sem nada no
 * meio do plantão — então cada invocação faz um lote, grava o parcial e agenda
 * a próxima.
 */

import crypto from "node:crypto";
import { HttpError } from "../lib/errors.js";
import {
  apagarDoBucket,
  baixarParaTemporario,
  guardarSaida,
  validarCaminho,
} from "../lib/storageDocumentos.js";
import { safeUnlink, sanitizeFilename } from "../lib/files.js";
import type { PassagemPlantaoBatch } from "../schemas/ai.schemas.js";
import { gerarMapaPlantaoDocx, type CabecalhoMapa } from "./docxGenerator.service.js";
import type { JobStore } from "./jobStore.js";
import {
  chunkEvolucoes,
  consolidar,
  processarLote,
  type EvolucaoInput,
} from "./passagemPlantao.service.js";
import { extractTextFromFile } from "./textExtraction.service.js";

/** Estado do job. Vive no `result` do jobStore entre uma invocação e outra. */
export interface EstadoPassagem {
  tipo: "passagem-plantao";
  setor: string;
  data: string;
  cabecalho: CabecalhoMapa;
  lotes: EvolucaoInput[][];
  proximo: number;
  parciais: PassagemPlantaoBatch[];
  falhas: number;
  warnings: string[];
  /** Preenchido no fim. O cliente baixa por aqui. */
  docx: { caminho: string; nome: string } | null;
  contagem: { pacientes: number; alertas: number } | null;
}

export function ehEstadoPassagem(v: unknown): v is EstadoPassagem {
  return typeof v === "object" && v !== null && (v as EstadoPassagem).tipo === "passagem-plantao";
}

function etapa(e: EstadoPassagem): string {
  if (e.docx) return "Mapa pronto";
  return `Lendo lote ${Math.min(e.proximo + 1, e.lotes.length)} de ${e.lotes.length}`;
}

export interface IniciarArgs {
  storagePaths: string[];
  setor: string;
  data: string;
  cabecalho?: CabecalhoMapa;
  userId: string | null;
  jobStore: JobStore;
}

/**
 * Baixa, extrai o texto e monta os lotes. Não chama a IA — esta invocação
 * precisa devolver 202 rápido.
 */
export async function iniciarPassagem({
  storagePaths,
  setor,
  data,
  cabecalho = {},
  userId,
  jobStore,
}: IniciarArgs): Promise<{ jobId: string; lotes: number; arquivos: number; warnings: string[] }> {
  const caminhos = storagePaths.map((p) => validarCaminho(p, userId));
  const warnings: string[] = [];
  const items: EvolucaoInput[] = [];

  for (const caminho of caminhos) {
    const nome = caminho.split("/").pop() ?? caminho;
    let local: string | null = null;
    try {
      const baixado = await baixarParaTemporario(caminho);
      local = baixado.filePath;
      const { text, kind } = await extractTextFromFile(local, nome);
      if (text.trim()) {
        items.push({ fileName: nome, text: text.trim() });
      } else {
        warnings.push(
          `${nome}: ${kind === "pdf" ? "PDF sem texto selecionável" : "nenhum texto extraído"}`,
        );
      }
    } catch (err) {
      warnings.push(`${nome}: ${err instanceof Error ? err.message : "erro na leitura"}`);
    } finally {
      await safeUnlink(local);
      await apagarDoBucket(caminho);
    }
  }

  if (items.length === 0) {
    throw new HttpError(
      422,
      "no_text",
      "Não foi possível extrair texto de nenhum arquivo.",
      warnings,
    );
  }

  const lotes = chunkEvolucoes(items);
  const jobId = crypto.randomUUID();
  const estado: EstadoPassagem = {
    tipo: "passagem-plantao",
    setor,
    data,
    cabecalho,
    lotes,
    proximo: 0,
    parciais: [],
    falhas: 0,
    warnings,
    docx: null,
    contagem: null,
  };

  await jobStore.create({ job_id: jobId, user_id: userId, file_name: `${setor} ${data}` });
  await jobStore.update(jobId, { status: "processing", stage: etapa(estado), result: estado });

  return { jobId, lotes: lotes.length, arquivos: items.length, warnings };
}

/**
 * Processa o próximo lote e devolve se ainda falta algum.
 *
 * Uma invocação, um lote. Falha de lote vira aviso e não derruba o resto — o
 * plantão com 12 dos 15 leitos lidos ainda vale muito mais que nenhum.
 */
export async function processarProximoLote(
  jobId: string,
  jobStore: JobStore,
): Promise<{ falta: boolean }> {
  const job = await jobStore.get(jobId);
  if (!job || !ehEstadoPassagem(job.result)) return { falta: false };

  const e = job.result;
  if (e.docx || e.proximo >= e.lotes.length) return { falta: false };

  const indice = e.proximo;
  const lote = e.lotes[indice];

  try {
    const parcial = await processarLote(lote, indice, e.lotes.length, e.setor, e.data);
    e.parciais.push(parcial);
  } catch (err) {
    e.falhas += 1;
    const arquivos = lote.map((b) => b.fileName).join(", ");
    e.warnings.push(
      `Lote ${indice + 1} falhou (${arquivos}): ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  e.proximo = indice + 1;
  const falta = e.proximo < e.lotes.length;

  if (falta) {
    await jobStore.update(jobId, { status: "processing", stage: etapa(e), result: e });
    return { falta: true };
  }

  if (e.falhas === e.lotes.length) {
    await jobStore.update(jobId, {
      status: "error",
      stage: "Erro na passagem",
      result: e,
      error:
        "A IA não retornou dados válidos para nenhum lote. " + e.warnings.slice(0, 3).join(" | "),
    });
    return { falta: false };
  }

  const resultado = consolidar(e.parciais, e.warnings, e.lotes.length, e.falhas);
  const buffer = await gerarMapaPlantaoDocx(resultado.data, e.setor, e.data, e.cabecalho);
  const nome = sanitizeFilename(`MAPA_PASSAGEM_${e.setor}_${e.data.replace(/\//g, "-")}.docx`);
  const caminho = await guardarSaida(job.user_id, nome, buffer);

  e.docx = { caminho, nome };
  e.contagem = {
    pacientes: resultado.data.pacientes.length,
    alertas: resultado.data.alertasCriticos.length,
  };
  // Os lotes já serviram; guardá-los inflaria a linha do banco sem serventia.
  e.lotes = [];
  e.parciais = [];

  await jobStore.update(jobId, { status: "done", stage: etapa(e), result: e, error: null });
  return { falta: false };
}

/** Encadeia os lotes até acabar. Cada passo é uma invocação curta. */
export async function processarAteOFim(jobId: string, jobStore: JobStore): Promise<void> {
  for (;;) {
    const { falta } = await processarProximoLote(jobId, jobStore);
    if (!falta) return;
  }
}
