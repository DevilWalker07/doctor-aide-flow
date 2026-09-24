import fs from "node:fs/promises";
import path from "node:path";

export function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

export async function safeUnlink(filePath: string | undefined | null): Promise<void> {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    /* already gone */
  }
}

export type SniffKind = "image" | "pdf" | "docx" | "text" | "unknown";

const TEXT_EXTS = new Set([".txt", ".md"]);

/** Marcas de HEIC/HEIF que aparecem logo depois do box `ftyp`. */
const MARCAS_HEIF = new Set([
  "heic",
  "heix",
  "hevc",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
]);

function ehIgual(buf: Buffer, offset: number, bytes: number[]): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

function textoEm(buf: Buffer, inicio: number, fim: number): string {
  return buf.length >= fim ? buf.subarray(inicio, fim).toString("latin1") : "";
}

/**
 * Identifica o formato pelos primeiros bytes, sem biblioteca.
 *
 * Aqui morava o `file-type`. Ele funcionava, mas a cadeia dele
 * (`strtok3` → `@tokenizer/token`, mais `token-types` e `@tokenizer/inflate`)
 * não sobrevivia ao empacotamento da Vercel: `strtok3` declara exports
 * condicionais (`{"node": "./lib/index.js", "default": "./lib/core.js"}`), o
 * rastreador empacotou o `core.js` da condição `default` e o Node, em execução,
 * pediu o `index.js` da condição `node` — que não estava lá. Toda leitura de
 * arquivo em produção morria com `Cannot find module`, e aqui nunca falhava,
 * porque no disco o `node_modules` está inteiro.
 *
 * Os formatos que o app aceita são oito, e todos têm assinatura estável nos
 * primeiros bytes. Ler isso à mão custa vinte linhas e tira uma árvore de
 * dependências inteira do pacote da função — junto com a classe de falha que
 * ela trazia.
 */
function assinaturaDe(buf: Buffer): SniffKind | null {
  if (textoEm(buf, 0, 4) === "%PDF") return "pdf";
  // DOCX é um zip; é o único formato zipado que o app aceita.
  if (ehIgual(buf, 0, [0x50, 0x4b, 0x03, 0x04])) return "docx";
  if (ehIgual(buf, 0, [0xff, 0xd8, 0xff])) return "image";
  if (ehIgual(buf, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image";
  if (textoEm(buf, 0, 4) === "RIFF" && textoEm(buf, 8, 12) === "WEBP") return "image";
  if (textoEm(buf, 4, 8) === "ftyp" && MARCAS_HEIF.has(textoEm(buf, 8, 12))) return "image";
  return null;
}

/** Lê o cabeçalho sem carregar o arquivo inteiro na memória. */
async function cabecalho(filePath: string, bytes = 16): Promise<Buffer> {
  const handle = await fs.open(filePath, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buf, 0, bytes, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export async function sniffKind(filePath: string, originalName: string): Promise<SniffKind> {
  const ext = path.extname(originalName).toLowerCase();
  const detected = assinaturaDe(await cabecalho(filePath));

  if (detected) return detected;

  if (TEXT_EXTS.has(ext)) {
    const handle = await fs.open(filePath, "r");
    try {
      const buf = Buffer.alloc(4096);
      const { bytesRead } = await handle.read(buf, 0, 4096, 0);
      const head = buf.subarray(0, bytesRead);
      if (hasUtf16Bom(head)) return "text";
      return head.includes(0) ? "unknown" : "text";
    } finally {
      await handle.close();
    }
  }
  return "unknown";
}

function hasUtf16Bom(buf: Buffer): boolean {
  return (
    buf.length >= 2 &&
    ((buf[0] === 0xff && buf[1] === 0xfe) || (buf[0] === 0xfe && buf[1] === 0xff))
  );
}

export function decodeTextBuffer(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe)
    return buf.subarray(2).toString("utf16le");
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.from(buf.subarray(2));
    swapped.swap16();
    return swapped.toString("utf16le");
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf)
    return buf.subarray(3).toString("utf-8");
  return buf.toString("utf-8");
}

export async function readTextFile(filePath: string): Promise<string> {
  return decodeTextBuffer(await fs.readFile(filePath));
}

export function extOf(originalName: string): string {
  return path.extname(originalName).toLowerCase().replace(".", "");
}
