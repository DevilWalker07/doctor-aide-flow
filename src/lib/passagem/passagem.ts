import { Packer } from "docx";
import { ApiError, apiJson } from "@/lib/apiClient";
import { montarMapaDocx, nomeDoArquivoMapa } from "../../../shared/passagem/docx";
import { juntarLeitos, type ResultadoLeito } from "../../../shared/passagem/juntar";
import { lerNomeDoArquivo } from "../../../shared/passagem/nomeArquivo";
import type {
  AlertaCritico,
  CabecalhoMapa,
  Consolidacao,
  LinhaMapa,
} from "../../../shared/passagem/tipos";
import type { Documento, Transcritor } from "./normalizar";

/**
 * As três chamadas de IA da passagem e a montagem do DOCX.
 *
 * Cada chamada é curta e independente: um leito que falha não derruba os
 * outros, e tentar de novo repete só ele.
 */

export interface LeitoLido {
  linha: LinhaMapa;
  alertas: AlertaCritico[];
  avisos: string[];
  fonte: string;
}

/** O motivo que o servidor deu — com os campos recusados, quando houver. */
export function motivoDoErro(err: unknown): string {
  if (err instanceof ApiError) {
    const detalhes = Array.isArray(err.details)
      ? (err.details as { path?: string; message?: string }[])
          .map((d) => [d.path, d.message].filter(Boolean).join(": "))
          .filter(Boolean)
      : [];
    const base = `${err.message}${detalhes.length ? ` (${detalhes.join("; ")})` : ""}`;
    return err.status ? `${base} [${err.status}]` : base;
  }
  return err instanceof Error ? err.message : String(err);
}

export const transcreverNoServidor: Transcritor = (imagem, pagina, paginas) =>
  apiJson("/api/ai/transcrever", { imagem, pagina, paginas });

export function lerLeitoNoServidor(
  doc: Documento,
  arquivo: string,
  dataPlantao: string,
  setor: string,
): Promise<LeitoLido> {
  return apiJson("/api/ai/passagem-leito", {
    markdown: doc.markdown,
    arquivo,
    dataPlantao,
    setor,
    lidoDeImagem: doc.lidoDeImagem,
  });
}

export function consolidarNoServidor(
  linhas: LinhaMapa[],
  dataPlantao: string,
  passagemPara?: string,
): Promise<Consolidacao> {
  return apiJson("/api/ai/passagem-consolidar", {
    dataPlantao,
    ...(passagemPara ? { passagemPara } : {}),
    // Só a linha pronta — o texto das evoluções não sai de novo.
    leitos: linhas.map((l) => ({
      leito: l.leito,
      paciente: l.paciente,
      di: l.di,
      diagnostico: l.diagnostico,
      quadroAtual: l.quadroAtual,
      atb: l.atb,
      ultimoLab: l.ultimoLab,
      condutasHoje: l.condutasHoje,
      alertasPendencias: l.alertasPendencias,
    })),
  });
}

export interface Falha {
  arquivo: string;
  motivo: string;
}

export interface MapaPronto {
  blob: Blob;
  nome: string;
  pacientes: number;
  avisos: string[];
}

/**
 * Junta os leitos lidos, consolida e gera o DOCX. A consolidação que falha
 * não impede o mapa: as duas listas saem com o aviso de falha, nunca
 * inventadas.
 */
export async function gerarMapa(opts: {
  lidos: ResultadoLeito[];
  falhas: Falha[];
  setor: string;
  dataPlantao: string;
  cabecalho: CabecalhoMapa;
  consolidar?: typeof consolidarNoServidor;
}): Promise<MapaPronto> {
  const { mapa, avisos: avisosJuntar } = juntarLeitos(opts.lidos);
  const avisos = [
    ...opts.falhas.map((f) => `${f.arquivo} não foi lido: ${f.motivo}`),
    ...avisosJuntar,
  ];

  let consolidacao: Consolidacao | null = null;
  try {
    consolidacao = await (opts.consolidar ?? consolidarNoServidor)(
      mapa.pacientes,
      opts.dataPlantao,
      opts.cabecalho.passagemPara,
    );
  } catch (err) {
    avisos.push(`Prioridades e pendências gerais não foram consolidadas: ${motivoDoErro(err)}`);
  }

  const doc = montarMapaDocx(mapa, {
    setor: opts.setor,
    dataPlantao: opts.dataPlantao,
    cabecalho: opts.cabecalho,
    consolidacao,
    leitosComFalha: opts.falhas.map((f) => lerNomeDoArquivo(f.arquivo).leito ?? f.arquivo),
    avisos,
  });
  return {
    blob: await Packer.toBlob(doc),
    nome: nomeDoArquivoMapa(opts.setor, opts.dataPlantao),
    pacientes: mapa.pacientes.length,
    avisos,
  };
}
