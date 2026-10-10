// Um "Supabase" que aceita a conexão e nunca responde.
//
// É o defeito de produção: o projeto está no ar, o endereço está certo, e
// nenhuma chamada volta. Falha que dá erro na hora é fácil; falha que pendura
// é a que trava o plantão. Este servidor reproduz a segunda.
import http from "node:http";

const porta = Number(process.env.PORTA_SUPABASE_MUDO ?? 54399);
http
  .createServer((req, res) => {
    // A sonda de prontidão do Playwright precisa de resposta; o resto, não.
    if (req.url === "/__pronto") return res.end("ok");
  })
  .listen(porta, "127.0.0.1");
