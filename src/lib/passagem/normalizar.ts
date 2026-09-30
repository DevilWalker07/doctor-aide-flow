import { documentoEmMarkdown, lerCabecalhosDocx } from "../../../shared/passagem/cabecalhosDocx";
import { avisoDeExtensao, ehImagem, formatoPelosBytes } from "../../../shared/passagem/formato";

/**
 * Todo arquivo da passagem vira Markdown aqui, no navegador.
 *
 * A passagem nunca mais sabe o que é Word, PDF ou foto — só lê `.md`. Word e
 * PDF com texto são convertidos por código: instantâneo, sem custo, e nenhum
 * número muda de lugar. Só o que não tem texto (foto, print, PDF escaneado)
 * passa pela IA, página por página, reduzida a ~1600 px.
 *
 * O arquivo do paciente não vai para o Storage: Word e PDF digital nem saem
 * do aparelho; imagem sai só como a página reduzida, na chamada de
 * transcrição, e não é guardada.
 */

export interface Documento {
  markdown: string;
  /** Veio do transcritor de imagem: o DOCX marca o leito para conferência. */
  lidoDeImagem: boolean;
  avisos: string[];
}

export interface PaginaImagem {
  base64: string;
  mime: "image/jpeg";
}

/** A chamada de IA, injetada — a tela passa a real, o teste passa um dublê. */
export type Transcritor = (
  imagem: PaginaImagem,
  pagina: number,
  paginas: number,
) => Promise<{ markdown: string; trechos_ilegiveis: string[] }>;

export class ArquivoNaoLido extends Error {}

/** Lado maior da página enviada à IA: legível para o modelo e abaixo do limite de corpo. */
const LADO_MAXIMO = 1600;
/** PDF com menos texto que isto por página é tratado como escaneado. */
const TEXTO_MINIMO_POR_PAGINA = 40;
/** Teto de páginas de imagem por arquivo: cada uma é uma chamada de ~10–20 s. */
const PAGINAS_MAXIMAS = 8;

export async function normalizarArquivo(file: File, transcrever: Transcritor): Promise<Documento> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const formato = formatoPelosBytes(bytes.subarray(0, 16), file.name);
  const avisos: string[] = [];
  const avisoExt = avisoDeExtensao(formato, file.name);
  if (avisoExt) avisos.push(avisoExt);

  if (formato === "docx")
    return { markdown: await docxParaMarkdown(bytes), lidoDeImagem: false, avisos };
  if (formato === "texto")
    return { markdown: new TextDecoder().decode(bytes), lidoDeImagem: false, avisos };
  if (formato === "doc") {
    throw new ArquivoNaoLido("Word antigo (.doc) não é lido — abra no Word e salve como .docx.");
  }
  if (formato === "pdf") return pdfParaMarkdown(bytes, transcrever, avisos);
  if (ehImagem(formato)) {
    const pagina = await imagemReduzida(
      new Blob([bytes], { type: file.type || `image/${formato}` }),
      formato,
    );
    const { markdown, trechos_ilegiveis } = await transcrever(pagina, 1, 1);
    return {
      markdown: exigirTexto(markdown),
      lidoDeImagem: true,
      avisos: [...avisos, ...ilegiveis(trechos_ilegiveis)],
    };
  }
  throw new ArquivoNaoLido(
    "Formato não reconhecido. Envie Word (.docx), PDF, foto (JPG, PNG, WEBP) ou texto.",
  );
}

function ilegiveis(trechos: string[]): string[] {
  return trechos.length ? [`Trechos ilegíveis na imagem: ${trechos.join("; ")}`] : [];
}

function exigirTexto(markdown: string): string {
  if (!markdown.trim()) throw new ArquivoNaoLido("Nenhum texto legível no arquivo.");
  return markdown;
}

async function docxParaMarkdown(bytes: Uint8Array): Promise<string> {
  const { default: mammoth } = await import("mammoth/mammoth.browser.js");
  // O mammoth ignora cabeçalho e rodapé — e é no cabeçalho que está a
  // identificação do paciente. Os cabeçalhos são lidos à parte, rotulados.
  const buffer = bytes.slice().buffer;
  const [{ value: corpo }, cabecalhos] = await Promise.all([
    mammoth.extractRawText({ arrayBuffer: buffer }),
    lerCabecalhosDocx(bytes),
  ]);
  return exigirTexto(documentoEmMarkdown(cabecalhos, corpo.replace(/\n{3,}/g, "\n\n")));
}

/**
 * Build `legacy` de propósito. O build padrão do pdf.js 5 usa APIs de
 * JavaScript recém-lançadas (`Map.prototype.getOrInsertComputed`) e morre com
 * "is not a function" em navegador que ainda não as tem — o Safari do iPhone
 * entre eles. O legacy traz os polyfills.
 */
async function carregarPdfJs() {
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

async function pdfParaMarkdown(
  bytes: Uint8Array,
  transcrever: Transcritor,
  avisos: string[],
): Promise<Documento> {
  const pdfjs = await carregarPdfJs();
  const pdf = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  try {
    const paginas: string[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const conteudo = await page.getTextContent();
      let texto = "";
      for (const item of conteudo.items) {
        if (!("str" in item)) continue;
        texto += item.str + (item.hasEOL ? "\n" : " ");
      }
      paginas.push(texto.replace(/[ \t]+\n/g, "\n").trim());
    }
    const letras = paginas.join("").replace(/\s/g, "").length;
    if (letras >= TEXTO_MINIMO_POR_PAGINA * pdf.numPages) {
      return { markdown: paginas.join("\n\n"), lidoDeImagem: false, avisos };
    }

    // Escaneado: cada página vira imagem e passa pelo transcritor.
    const total = Math.min(pdf.numPages, PAGINAS_MAXIMAS);
    if (pdf.numPages > PAGINAS_MAXIMAS) {
      avisos.push(
        `PDF escaneado com ${pdf.numPages} páginas: só as ${PAGINAS_MAXIMAS} primeiras foram lidas.`,
      );
    }
    const partes: string[] = [];
    const trechos: string[] = [];
    for (let n = 1; n <= total; n++) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const escala = LADO_MAXIMO / Math.max(base.width, base.height);
      const viewport = page.getViewport({ scale: escala });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new ArquivoNaoLido("O navegador não conseguiu desenhar a página do PDF.");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const r = await transcrever(await canvasEmJpeg(canvas), n, total);
      if (r.markdown.trim()) partes.push(r.markdown.trim());
      trechos.push(...r.trechos_ilegiveis);
    }
    return {
      markdown: exigirTexto(partes.join("\n\n")),
      lidoDeImagem: true,
      avisos: [...avisos, ...ilegiveis(trechos)],
    };
  } finally {
    void pdf.destroy();
  }
}

async function imagemReduzida(blob: Blob, formato: string): Promise<PaginaImagem> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new ArquivoNaoLido(
      formato === "heic"
        ? "Formato HEIC não é lido neste navegador — exporte a foto como JPG (ou envie pelo iPhone, que já converte)."
        : "Não foi possível abrir a imagem.",
    );
  }
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * escala));
  canvas.height = Math.max(1, Math.round(bitmap.height * escala));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ArquivoNaoLido("O navegador não conseguiu desenhar a imagem.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvasEmJpeg(canvas);
}

async function canvasEmJpeg(canvas: HTMLCanvasElement): Promise<PaginaImagem> {
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
  if (!blob) throw new ArquivoNaoLido("O navegador não conseguiu converter a página em imagem.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return { base64: btoa(binario), mime: "image/jpeg" };
}
