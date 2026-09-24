import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sniffKind } from "../../server/lib/files.js";

const FIXTURES = path.resolve(import.meta.dirname, "../fixtures");
const temporarios: string[] = [];

async function arquivoCom(bytes: Buffer, nome = "arquivo.bin"): Promise<string> {
  const destino = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "medfluxo-")), nome);
  await fs.writeFile(destino, bytes);
  temporarios.push(destino);
  return destino;
}

/** Cabeçalho sintético: assinatura + enchimento, como um arquivo de verdade. */
function cabecalho(...partes: (number[] | string)[]): Buffer {
  const bytes = partes.flatMap((p) => (typeof p === "string" ? [...Buffer.from(p, "latin1")] : p));
  return Buffer.concat([Buffer.from(bytes), Buffer.alloc(32)]);
}

afterEach(async () => {
  await Promise.all(temporarios.splice(0).map((p) => fs.rm(p, { force: true })));
});

/**
 * `sniffKind` decide o leitor de TODO arquivo que entra no app, e não tinha
 * teste nenhum. Foi por isso que a troca do `file-type` por leitura própria de
 * assinatura pôde quebrar produção sem nada acusar aqui.
 *
 * O `file-type` saiu porque a cadeia dele (`strtok3` e companhia) não sobrevive
 * ao empacotamento da Vercel: exports condicionais fazem o rastreador levar um
 * arquivo e o Node pedir outro.
 */
describe("assinatura do arquivo", () => {
  it("PDF de verdade", async () => {
    expect(await sniffKind(path.join(FIXTURES, "test.pdf"), "test.pdf")).toBe("pdf");
  });

  it("DOCX de verdade", async () => {
    expect(await sniffKind(path.join(FIXTURES, "test.docx"), "test.docx")).toBe("docx");
  });

  it("texto de verdade", async () => {
    expect(await sniffKind(path.join(FIXTURES, "evolucao.txt"), "evolucao.txt")).toBe("text");
  });

  it("o nome não muda o veredito — só os bytes", async () => {
    // O mesmo PDF com nome de Word continua sendo PDF.
    expect(await sniffKind(path.join(FIXTURES, "test.pdf"), "mentira.docx")).toBe("pdf");
    expect(await sniffKind(path.join(FIXTURES, "test.docx"), "mentira.pdf")).toBe("docx");
  });

  it("JPEG, PNG, WEBP e HEIC são imagem", async () => {
    expect(await sniffKind(await arquivoCom(cabecalho([0xff, 0xd8, 0xff, 0xe0])), "f")).toBe(
      "image",
    );
    expect(
      await sniffKind(
        await arquivoCom(cabecalho([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
        "f",
      ),
    ).toBe("image");
    expect(await sniffKind(await arquivoCom(cabecalho("RIFF", [0, 0, 0, 0], "WEBP")), "f")).toBe(
      "image",
    );
    // HEIC é o formato padrão da câmera do iPhone — foto de prontuário cai aqui.
    expect(await sniffKind(await arquivoCom(cabecalho([0, 0, 0, 0x20], "ftyp", "heic")), "f")).toBe(
      "image",
    );
  });

  it("RIFF que não é WEBP não vira imagem", async () => {
    // Um .wav também começa com RIFF; a marca em 8..11 é o que decide.
    expect(await sniffKind(await arquivoCom(cabecalho("RIFF", [0, 0, 0, 0], "WAVE")), "f")).toBe(
      "unknown",
    );
  });

  it("ftyp com marca desconhecida não vira imagem", async () => {
    expect(await sniffKind(await arquivoCom(cabecalho([0, 0, 0, 0x20], "ftyp", "qt  ")), "f")).toBe(
      "unknown",
    );
  });

  it("bytes aleatórios sem extensão conhecida: unknown", async () => {
    expect(await sniffKind(await arquivoCom(Buffer.from([1, 2, 3, 4, 5])), "x.bin")).toBe(
      "unknown",
    );
  });

  it("arquivo vazio não quebra", async () => {
    expect(await sniffKind(await arquivoCom(Buffer.alloc(0)), "vazio.bin")).toBe("unknown");
  });

  it("arquivo vazio com nome .txt continua sendo texto", async () => {
    expect(await sniffKind(await arquivoCom(Buffer.alloc(0), "v.txt"), "v.txt")).toBe("text");
  });

  it("binário com nome .txt não passa por texto", async () => {
    // Byte nulo denuncia: texto de verdade não tem.
    const bytes = Buffer.concat([Buffer.from("olá"), Buffer.from([0x00]), Buffer.from("mundo")]);
    expect(await sniffKind(await arquivoCom(bytes, "falso.txt"), "falso.txt")).toBe("unknown");
  });
});
