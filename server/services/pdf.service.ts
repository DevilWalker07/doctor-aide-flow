import { createRequire } from "node:module";
import path from "node:path";

/**
 * O canvas é nativo (@napi-rs/canvas) e só o OCR de PDF escaneado precisa dele.
 *
 * Era importado no topo, e `documentExtractor.service.ts` importa este módulo
 * estaticamente: se o binário não carregasse na função serverless, a rota de
 * extração morria no import — levando com ela TXT, DOCX e PDF com texto, que
 * não usam canvas nenhum. Agora a carga é preguiçosa e a falha fica contida no
 * único caminho que depende dela.
 */
type Canvas = typeof import("@napi-rs/canvas");
let canvasPromise: Promise<Canvas> | null = null;

function loadCanvas(): Promise<Canvas> {
  if (!canvasPromise) {
    canvasPromise = import("@napi-rs/canvas").catch(() => {
      throw new Error(
        "Não foi possível processar PDF escaneado neste ambiente. " +
          "Envie o PDF com texto selecionável, ou fotografe as páginas.",
      );
    });
  }
  return canvasPromise;
}

/**
 * O caminho das fontes do pdfjs também é preguiçoso: resolvê-lo na carga do
 * módulo quebra o import inteiro quando o empacotamento muda o layout de
 * `node_modules`.
 */
let standardFonts: string | null = null;

function standardFontsDir(): string | undefined {
  if (standardFonts === null) {
    try {
      const require = createRequire(import.meta.url);
      const pdfjsDir = path.dirname(require.resolve("pdfjs-dist/package.json"));
      standardFonts = path.join(pdfjsDir, "standard_fonts/") + path.sep;
    } catch {
      standardFonts = "";
    }
  }
  return standardFonts || undefined;
}

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjsPromise: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjsPromise;
}

async function openDocument(buf: Buffer) {
  const pdfjs = await loadPdfJs();
  return pdfjs.getDocument({
    data: new Uint8Array(buf),
    standardFontDataUrl: standardFontsDir(),
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
}

export async function extractPdfText(buf: Buffer): Promise<{ text: string; numPages: number }> {
  const doc = await openDocument(buf);
  try {
    const parts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      parts.push(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      );
      page.cleanup();
    }
    return { text: parts.filter(Boolean).join("\n\n"), numPages: doc.numPages };
  } finally {
    await doc.destroy();
  }
}

const MAX_SIDE = 1800;

export async function renderPdfPagesToJpeg(
  buf: Buffer,
  maxPages: number,
): Promise<{ images: Buffer[]; totalPages: number; rendered: number }> {
  const doc = await openDocument(buf);
  try {
    const total = doc.numPages;
    const count = Math.min(total, maxPages);
    const images: Buffer[] = [];

    for (let i = 1; i <= count; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2.5, MAX_SIDE / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });
      const { createCanvas } = await loadCanvas();
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        canvas: canvas as unknown as HTMLCanvasElement,
        viewport,
      }).promise;

      images.push(await canvas.encode("jpeg", 88));
      page.cleanup();
    }
    return { images, totalPages: total, rendered: count };
  } finally {
    await doc.destroy();
  }
}
