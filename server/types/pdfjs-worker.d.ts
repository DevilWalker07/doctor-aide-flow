/**
 * O `pdfjs-dist` não publica tipos para o bundle do worker — só para o
 * `pdf.mjs`. Importamos o worker de propósito (veja `loadPdfJs` em
 * `server/services/pdf.service.ts`): é o que faz o empacotador da Vercel
 * incluí-lo na função, já que o import de dentro da biblioteca vem marcado
 * como "ignore" para bundlers.
 *
 * Só o que usamos está declarado. `any` aqui seria mentir sobre uma forma que
 * conhecemos.
 */
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
