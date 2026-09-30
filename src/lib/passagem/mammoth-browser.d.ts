// O build de navegador do mammoth (UMD, sem `fs` nem `path`). A API é a mesma
// do pacote principal.
declare module "mammoth/mammoth.browser.js" {
  import mammoth from "mammoth";
  export default mammoth;
}
