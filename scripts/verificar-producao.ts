/**
 * Sonda a API publicada e exige que quem responde seja a NOSSA aplicação.
 *
 * Por que isto existe: a API inteira respondeu 404 em produção por semanas
 * enquanto 231 testes e 26 specs passavam. Os testes rodam contra
 * `server/app.ts`, onde o Express faz o roteamento todo; o roteamento da
 * Vercel — a única peça quebrada — não era exercitado por nada. Verde local,
 * morto no ar.
 *
 * O critério não é o código HTTP. 404 nosso é legítimo (rota que não existe
 * para aquele método); 404 da borda da Vercel significa que a função nem
 * rodou. O que separa os dois é o cabeçalho `x-vercel-error` e o corpo: JSON
 * nosso passa, texto puro da plataforma reprova.
 *
 *   npm run verificar:producao
 *   npm run verificar:producao -- https://outra-url.vercel.app
 */

export {};

const base = (process.argv[2] ?? "https://medfluxo.vercel.app").replace(/\/$/, "");

interface Sonda {
  caminho: string;
  metodo: "GET" | "POST";
  porque: string;
}

/** Os caminhos ANINHADOS são o ponto: eram justamente os que a borda comia. */
const SONDAS: Sonda[] = [
  { caminho: "/api/health", metodo: "GET", porque: "saúde do servidor" },
  { caminho: "/api/ai/copiloto", metodo: "POST", porque: "copiloto clínico" },
  { caminho: "/api/extract/preparar-upload", metodo: "POST", porque: "envio de documento" },
  { caminho: "/api/ai/passagem-leito", metodo: "POST", porque: "passagem de plantão (um leito)" },
];

interface Resultado {
  sonda: Sonda;
  ok: boolean;
  /** Bloqueio da rede de quem executa — não diz nada sobre produção. */
  bloqueado?: boolean;
  detalhe: string;
}

/**
 * O contêiner do agente sai por um proxy com allowlist. Quando o domínio não
 * está liberado, ele devolve 403 com esta mensagem — que não tem nada a ver
 * com a aplicação. Chamar isso de "produção quebrada" seria o mesmo erro que
 * este script existe para evitar: afirmar uma conclusão sem a evidência.
 */
function ehBloqueioDeRede(status: number, corpo: string): boolean {
  return status === 403 && /not in allowlist|egress/i.test(corpo);
}

async function sondar(sonda: Sonda): Promise<Resultado> {
  const url = `${base}${sonda.caminho}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: sonda.metodo,
      headers: { "Content-Type": "application/json" },
      // Corpo vazio de propósito: queremos a resposta da NOSSA validação,
      // que já prova que a requisição chegou ao Express.
      body: sonda.metodo === "POST" ? "{}" : undefined,
    });
  } catch (err) {
    return { sonda, ok: false, detalhe: `não respondeu: ${(err as Error).message}` };
  }

  const erroDaBorda = res.headers.get("x-vercel-error");
  if (erroDaBorda) {
    return {
      sonda,
      ok: false,
      detalhe: `a função NÃO foi chamada — ${erroDaBorda} (${res.status}). É roteamento, não a aplicação.`,
    };
  }

  const tipo = res.headers.get("content-type") ?? "";
  if (!tipo.includes("application/json")) {
    const corpo = (await res.text()).slice(0, 160).replace(/\s+/g, " ");
    if (ehBloqueioDeRede(res.status, corpo)) {
      return { sonda, ok: false, bloqueado: true, detalhe: "bloqueado pela rede de saída" };
    }
    return { sonda, ok: false, detalhe: `resposta não-JSON (${res.status}): ${corpo}` };
  }

  return { sonda, ok: true, detalhe: `${res.status} — respondido pela aplicação` };
}

const resultados = await Promise.all(SONDAS.map(sondar));

console.log(`\nVerificando ${base}\n`);
for (const r of resultados) {
  console.log(`${r.ok ? "OK  " : "FALHA"}  ${r.sonda.caminho.padEnd(34)} ${r.detalhe}`);
  if (!r.ok) console.log(`       (${r.sonda.porque})`);
}

const bloqueados = resultados.filter((r) => r.bloqueado);
if (bloqueados.length === resultados.length) {
  console.error(
    "\nNão deu para verificar: a rede de saída desta máquina não alcança o domínio.\n" +
      "Isto NÃO diz nada sobre produção — rode de um lugar com acesso.\n",
  );
  process.exit(2);
}

const falhas = resultados.filter((r) => !r.ok);
if (falhas.length > 0) {
  console.error(
    `\n${falhas.length} de ${resultados.length} caminhos não chegam à aplicação.\n` +
      "Resposta da borda significa que a função nem rodou: é roteamento.\n",
  );
  process.exit(1);
}
console.log(`\nOs ${resultados.length} caminhos chegam à aplicação.\n`);
