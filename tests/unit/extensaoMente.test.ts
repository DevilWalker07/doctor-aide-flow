import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { extractTextFromFile } from "../../server/services/textExtraction.service.js";

const FIXTURES = path.resolve(import.meta.dirname, "../fixtures");
const temporarios: string[] = [];

/** Copia a fixture para um nome MENTIROSO, como o hospital às vezes entrega. */
async function comNome(fixture: string, nomeFalso: string): Promise<string> {
  const destino = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "medfluxo-")), nomeFalso);
  await fs.copyFile(path.join(FIXTURES, fixture), destino);
  temporarios.push(destino);
  return destino;
}

afterEach(async () => {
  await Promise.all(temporarios.splice(0).map((p) => fs.rm(p, { force: true })));
});

/**
 * A rota de extração de documento já conferia magic bytes; a da passagem
 * decidia pela extensão. Um Word chamado `.pdf` ia para o leitor de PDF e
 * falhava reclamando da estrutura do PDF — erro que não aponta para a causa.
 *
 * O nome do arquivo é dado de entrada e não está sob o nosso controle. O
 * conteúdo está.
 */
describe("o leitor é escolhido pelo conteúdo, não pela extensão", () => {
  it("Word chamado .pdf é lido como Word", async () => {
    const caminho = await comNome("test.docx", "L04 - NARCISO BATISTA CRUZ. 24.04.pdf");
    const r = await extractTextFromFile(caminho, path.basename(caminho));
    expect(r.kind).toBe("docx");
    expect(r.text.length).toBeGreaterThan(0);
  });

  it("e avisa que o nome mentia, em vez de consertar calado", async () => {
    const caminho = await comNome("test.docx", "evolucao.pdf");
    const r = await extractTextFromFile(caminho, path.basename(caminho));
    expect(r.aviso).toMatch(/o nome diz PDF, o conteúdo é Word/i);
  });

  it("PDF chamado .docx é lido como PDF", async () => {
    const caminho = await comNome("test.pdf", "L01 - REGISON.docx");
    const r = await extractTextFromFile(caminho, path.basename(caminho));
    expect(r.kind).toBe("pdf");
    expect(r.aviso).toMatch(/o nome diz Word, o conteúdo é PDF/i);
  });

  it("quando nome e conteúdo batem, não inventa aviso", async () => {
    const caminho = await comNome("test.docx", "certo.docx");
    const r = await extractTextFromFile(caminho, path.basename(caminho));
    expect(r.kind).toBe("docx");
    expect(r.aviso).toBeUndefined();
  });

  it("texto puro continua sendo lido — não tem assinatura para farejar", async () => {
    const caminho = await comNome("evolucao.txt", "evolucao.txt");
    const r = await extractTextFromFile(caminho, path.basename(caminho));
    expect(r.kind).toBe("txt");
    expect(r.text.length).toBeGreaterThan(0);
    expect(r.aviso).toBeUndefined();
  });

  it("conteúdo irreconhecível diz o que chegou E o que o nome prometia", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "medfluxo-"));
    const caminho = path.join(dir, "misterio.pdf");
    await fs.writeFile(caminho, Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]));
    temporarios.push(caminho);
    await expect(extractTextFromFile(caminho, "misterio.pdf")).rejects.toThrow(
      /não reconheci o conteúdo.*sugere PDF/is,
    );
  });
});
