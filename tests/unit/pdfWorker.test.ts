import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { extractPdfText, workerRegistrado } from "../../server/services/pdf.service.js";

const FIXTURE = path.resolve(import.meta.dirname, "../fixtures/test.pdf");

/**
 * Este teste existe por causa de uma falha em produção que não aparecia aqui.
 *
 * A função da Vercel quebrava com `Cannot find module
 * '/var/task/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'`. O pdf.js,
 * quando `globalThis.pdfjsWorker` não está definido, monta um "fake worker"
 * fazendo `import(workerSrc)` — e esse import, no fonte da biblioteca, vem
 * marcado com `webpackIgnore: true` e `@vite-ignore`. A própria biblioteca
 * manda o empacotador ignorar o arquivo, então a função foi publicada sem ele.
 *
 * Localmente nunca falhou: o `node_modules` está inteiro no disco e o import
 * dinâmico resolve. Por isso a asserção não é "extraiu texto" — é **que o
 * worker foi registrado**, que é a diferença entre depender ou não daquele
 * import que ninguém rastreia.
 */
describe("worker do pdf.js", () => {
  it("extrai texto de PDF com texto selecionável", async () => {
    const texto = await extractPdfText(await fs.readFile(FIXTURE));
    expect(texto.numPages).toBeGreaterThan(0);
    expect(typeof texto.text).toBe("string");
  });

  it("registra o worker em globalThis — não usa o import que o bundler ignora", async () => {
    await extractPdfText(await fs.readFile(FIXTURE));
    expect(workerRegistrado()).toBe(true);
  });
});
