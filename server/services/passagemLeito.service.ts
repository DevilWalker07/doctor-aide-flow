import { modeloVisao } from "../config.js";
import { PASSAGEM_CONSOLIDAR_PROMPT } from "../prompts/passagemConsolidar.prompt.js";
import { PASSAGEM_LEITO_PROMPT } from "../prompts/passagemLeito.prompt.js";
import { TRANSCRICAO_PROMPT } from "../prompts/transcricao.prompt.js";
import {
  ConsolidacaoSchema,
  PassagemLeitoSchema,
  TranscricaoSchema,
  type PassagemConsolidarBody,
  type PassagemLeitoBody,
  type TranscreverBody,
  type Transcricao,
} from "../schemas/ai.schemas.js";
import { HttpError } from "../lib/errors.js";
import { diasDeInternacao, normalizarDataBR } from "../../shared/passagem/datas.js";
import { lerNomeDoArquivo, numeroDoLeito } from "../../shared/passagem/nomeArquivo.js";
import {
  CATEGORIAS_PENDENCIA,
  type AlertaCritico,
  type Consolidacao,
  type LinhaMapa,
  type Prioridade,
} from "../../shared/passagem/tipos.js";
import { flagLabOutliers } from "./clinicalGuardrails.js";
import { safeJsonCompletion, type SafeResult } from "./openaiClient.js";

/**
 * A passagem de plantão no servidor: só as chamadas de IA.
 *
 * Tudo o mais — ler o arquivo, juntar os leitos, gerar o DOCX — roda no
 * navegador. O que fica aqui é o que não pode sair daqui (a chave e os
 * prompts) e o que o modelo não decide: DI, conferência do leito com o nome
 * do arquivo e o potássio crítico.
 */

function falhar(result: Extract<SafeResult<unknown>, { ok: false }>, oQue: string): never {
  const campos = result.issues?.length ? ` (${result.issues.length} campos inválidos)` : "";
  throw new HttpError(
    502,
    "ia_invalida",
    `A IA não devolveu ${oQue} válido: ${result.error}${campos}`,
  );
}

/** `01` → `L01`, `LEITO 5` → `L05`, `ISOLAMENTO 12` → `ISO 12`. Outro formato fica como veio. */
export function normalizarLeito(valor: string): string {
  const v = valor.trim().toUpperCase().replace(/\s+/g, " ");
  const iso = v.match(/^ISO(?:LAMENTO)?\s*[-_.]?\s*0*(\d{1,3})$/);
  if (iso) return `ISO ${Number(iso[1])}`;
  const leito = v.match(/^(?:L|LEITO)?\s*[-_.]?\s*0*(\d{1,3})$/);
  if (leito) return `L${String(Number(leito[1])).padStart(2, "0")}`;
  return v;
}

/** Linhas de alerta entram no topo da célula, acima do "— PENDÊNCIAS —". */
function comAlertas(celula: string, linhas: string[]): string {
  return [...linhas, celula].filter(Boolean).join("\n");
}

export interface LeitoLido {
  linha: LinhaMapa;
  alertas: AlertaCritico[];
  /** O que a tela mostra ao lado do leito: conflito de cabeçalho, leito divergente… */
  avisos: string[];
  fonte: string;
}

export async function lerLeito(body: PassagemLeitoBody): Promise<LeitoLido> {
  const payload = {
    setor: body.setor,
    dataPlantao: body.dataPlantao,
    arquivo: body.arquivo,
    documento: body.markdown,
  };
  const result = await safeJsonCompletion(PASSAGEM_LEITO_PROMPT, payload, PassagemLeitoSchema, {
    maxTokens: 4000,
    mockKey: "passagemLeito",
  });
  if (!result.ok) falhar(result, "a linha do leito");
  const ia = result.data;
  const id = ia.identificacao;
  const doArquivo = lerNomeDoArquivo(body.arquivo);
  const avisos: string[] = [];
  const alertasDoLeito: string[] = [];

  // Leito: o do cabeçalho vale; o nome do arquivo confere. Discordância não é
  // resolvida em silêncio — vai para a coluna de alertas.
  let leito: string;
  if (id.leito) {
    leito = normalizarLeito(id.leito);
    const nCab = numeroDoLeito(id.leito);
    const nArq = numeroDoLeito(doArquivo.leito);
    if (doArquivo.leito && nCab != null && nArq != null && nCab !== nArq) {
      const msg = `Leito divergente: cabeçalho diz ${leito}, arquivo diz ${doArquivo.leito} — confira`;
      alertasDoLeito.push(`!! ${msg}`);
      avisos.push(msg);
    }
  } else if (doArquivo.leito) {
    leito = doArquivo.leito;
    avisos.push("Leito tirado do nome do arquivo — o documento não traz leito no cabeçalho.");
  } else {
    leito = "LEITO NÃO IDENTIFICADO";
    alertasDoLeito.push("!! Leito não identificado no documento nem no nome do arquivo");
    avisos.push("Leito não identificado no documento nem no nome do arquivo.");
  }

  let nome = id.nome?.toUpperCase() ?? null;
  if (!nome && doArquivo.nome) {
    nome = doArquivo.nome;
    avisos.push("Nome tirado do nome do arquivo — o documento não traz identificação.");
  }
  const paciente = [nome ?? "NÃO REFERIDO", id.idade].filter(Boolean).join(", ");

  const dih = normalizarDataBR(id.dih);
  const di = dih ? diasDeInternacao(dih, body.dataPlantao) : null;

  for (const c of id.conflitos) {
    avisos.push(`Cabeçalhos divergentes: ${c}`);
  }
  if (id.conflitos.length) {
    alertasDoLeito.push(`! Cabeçalhos divergentes: ${id.conflitos.join("; ")}`);
  }

  // Guardrail determinístico: o modelo não decide se um potássio é crítico.
  const alertas: AlertaCritico[] = ia.alertasCriticos.map((a) => ({
    prioridade: a.prioridade,
    leito,
    paciente,
    acao: a.acao,
  }));
  const criticos = flagLabOutliers(ia.ultimoLab).filter((f) => f.severity === "critical");
  if (criticos.length && !ia.alertasPendencias.toUpperCase().includes("LAB CRÍTICO")) {
    const resumo = criticos.map((f) => f.message).join("; ");
    alertasDoLeito.unshift(`!! LAB CRÍTICO: ${resumo} — REAVALIAR`);
    alertas.unshift({
      prioridade: "!! URGENTE",
      leito,
      paciente,
      acao: `LAB CRÍTICO: ${resumo} — REAVALIAR`,
    });
  }

  const linha: LinhaMapa = {
    leito,
    paciente,
    dih: dih ?? "NÃO REFERIDO",
    di,
    diagnostico: ia.diagnostico,
    quadroAtual: ia.quadroAtual,
    atb: ia.atb,
    ultimoLab: ia.ultimoLab,
    condutasHoje: ia.condutasHoje,
    alertasPendencias: comAlertas(ia.alertasPendencias, alertasDoLeito),
    dispositivos: ia.dispositivos,
    anotacoesVisita: "",
    resumoLinha: ia.resumoLinha,
    sugestoesClinicas: ia.sugestoesClinicas,
    ...(body.lidoDeImagem ? { lidoDeImagem: true } : {}),
  };
  return { linha, alertas, avisos, fonte: id.fonte };
}

/** Uma página de imagem → Markdown literal. Usa o modelo de visão. */
export async function transcrever(body: TranscreverBody): Promise<Transcricao> {
  const onde = body.pagina
    ? `Página ${body.pagina}${body.paginas ? ` de ${body.paginas}` : ""}.`
    : "";
  const result = await safeJsonCompletion(
    TRANSCRICAO_PROMPT,
    `${onde} Transcreva a imagem.`.trim(),
    TranscricaoSchema,
    {
      maxTokens: 4000,
      images: [body.imagem],
      modelo: modeloVisao(),
      mockKey: "transcricao",
    },
  );
  if (!result.ok) falhar(result, "a transcrição");
  return result.data;
}

const ORDEM: Record<Prioridade, number> = {
  "!! URGENTE": 0,
  "! HOJE": 1,
  "PENDÊNCIA SOCIAL": 2,
  PALIATIVO: 3,
};

/**
 * Prioridades e pendências gerais, a partir das linhas prontas.
 *
 * Duas travas em código: prioridade para leito que não está no mapa é
 * descartada (a IA não pode trazer paciente que não foi lido), e todo alerta
 * "!!" de leito que a IA deixou sem prioridade entra como "!! URGENTE".
 */
export async function consolidarPassagem(body: PassagemConsolidarBody): Promise<Consolidacao> {
  const result = await safeJsonCompletion(PASSAGEM_CONSOLIDAR_PROMPT, body, ConsolidacaoSchema, {
    maxTokens: 3000,
    mockKey: "passagemConsolidar",
  });
  if (!result.ok) falhar(result, "a consolidação");

  const porNumero = new Map(body.leitos.map((l) => [normalizarLeito(l.leito), l]));
  const prioridades = result.data.prioridades
    .map((p) => ({ ...p, leito: normalizarLeito(p.leito) }))
    .filter((p) => porNumero.has(p.leito));

  const comPrioridade = new Set(prioridades.map((p) => p.leito));
  for (const l of body.leitos) {
    const chave = normalizarLeito(l.leito);
    if (comPrioridade.has(chave)) continue;
    const urgente = l.alertasPendencias
      .split("\n")
      .map((s) => s.trim())
      .find((s) => s.startsWith("!!"));
    if (urgente) {
      prioridades.push({
        prioridade: "!! URGENTE",
        leito: l.leito,
        paciente: l.paciente.split(/[ ,]/)[0] ?? l.paciente,
        texto: urgente.replace(/^!!\s*/, "").toUpperCase(),
      });
    }
  }
  prioridades.sort((a, b) => ORDEM[a.prioridade] - ORDEM[b.prioridade]);

  const pendencias = Object.fromEntries(
    CATEGORIAS_PENDENCIA.map((c) => [c, result.data.pendencias[c]]),
  ) as Consolidacao["pendencias"];
  return { prioridades, pendencias };
}
