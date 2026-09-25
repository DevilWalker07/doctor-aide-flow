/**
 * Formato do arquivo pelos primeiros bytes — nunca pela extensão.
 *
 * O nome do arquivo é dado de entrada e não está sob o nosso controle: um Word
 * chamado `.pdf` ia para o leitor de PDF e falhava reclamando da estrutura do
 * PDF. Mesmas assinaturas de `server/lib/files.ts`, sem `Buffer`, para rodar
 * no navegador.
 */
export type Formato =
  | "docx"
  | "pdf"
  | "jpeg"
  | "png"
  | "webp"
  | "heic"
  | "doc"
  | "texto"
  | "desconhecido";

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

function igual(b: Uint8Array, offset: number, bytes: number[]): boolean {
  return b.length >= offset + bytes.length && bytes.every((x, i) => b[offset + i] === x);
}

function ascii(b: Uint8Array, inicio: number, fim: number): string {
  return b.length >= fim ? String.fromCharCode(...b.subarray(inicio, fim)) : "";
}

function extensao(nome: string): string {
  return nome.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1] ?? "";
}

export function formatoPelosBytes(inicio: Uint8Array, nome: string): Formato {
  if (ascii(inicio, 0, 4) === "%PDF") return "pdf";
  if (igual(inicio, 0, [0x50, 0x4b, 0x03, 0x04])) return "docx";
  if (igual(inicio, 0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "doc";
  if (igual(inicio, 0, [0xff, 0xd8, 0xff])) return "jpeg";
  if (igual(inicio, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (ascii(inicio, 0, 4) === "RIFF" && ascii(inicio, 8, 12) === "WEBP") return "webp";
  if (ascii(inicio, 4, 8) === "ftyp" && MARCAS_HEIF.has(ascii(inicio, 8, 12))) return "heic";
  // Texto não tem assinatura: aí, e só aí, a extensão decide.
  if (["txt", "md"].includes(extensao(nome))) return "texto";
  return "desconhecido";
}

const EXTENSOES: Record<Formato, string[]> = {
  docx: ["docx"],
  pdf: ["pdf"],
  jpeg: ["jpg", "jpeg"],
  png: ["png"],
  webp: ["webp"],
  heic: ["heic", "heif"],
  doc: ["doc"],
  texto: ["txt", "md"],
  desconhecido: [],
};

/**
 * Aviso quando a extensão diz uma coisa e o conteúdo outra. O arquivo é lido
 * pelo conteúdo; o aviso existe porque extensão errada que se repete é coisa
 * que o médico precisa saber.
 */
export function avisoDeExtensao(formato: Formato, nome: string): string | null {
  const ext = extensao(nome);
  if (!ext || formato === "desconhecido" || EXTENSOES[formato].includes(ext)) return null;
  return `${nome}: o nome diz .${ext}, mas o conteúdo é ${formato.toUpperCase()} — lido como ${formato.toUpperCase()}.`;
}

export const ehImagem = (f: Formato) => f === "jpeg" || f === "png" || f === "webp" || f === "heic";
