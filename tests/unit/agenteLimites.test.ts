import { describe, expect, it } from "vitest";
import {
  LimiteViolado,
  PORTAO,
  PROTEGIDOS_NO_DIFF,
  SCRIPTS_PERMITIDOS,
  caminhoSeguro,
  scriptPermitido,
} from "../../scripts/agentes/lib/limites.js";

/**
 * Os limites do agente de manutenção.
 *
 * São testados porque são a única coisa que impede um modelo de escrever onde
 * não deve. O prompt também pede — mas pedido não é impedimento, e é este
 * arquivo que prova qual dos dois está no caminho.
 */
describe("limites de escrita do agente", () => {
  it("recusa os caminhos que você listou", () => {
    for (const proibido of [
      ".env",
      ".env.local",
      ".env.production",
      "server/.env",
      ".git/config",
      ".git/hooks/pre-commit",
      "node_modules/react/index.js",
      "private-data/paciente.docx",
      ".github/workflows/ci.yml",
    ]) {
      expect(() => caminhoSeguro(proibido), proibido).toThrow(LimiteViolado);
    }
  });

  it("recusa os arquivos que definem o próprio portão", () => {
    // Sem isto, o agente redefiniria `typecheck` como `exit 0` e o portão
    // passaria sem checar nada. A régua não é editável por quem ela mede.
    for (const portao of [
      "package.json",
      "package-lock.json",
      "tsconfig.json",
      "tsconfig.server.json",
      "tsconfig.test.json",
      "eslint.config.js",
      "vitest.config.ts",
      ".prettierrc",
    ]) {
      expect(() => caminhoSeguro(portao), portao).toThrow(LimiteViolado);
    }
  });

  it("recusa o próprio agente — ele não reescreve os próprios limites", () => {
    expect(() => caminhoSeguro("scripts/agentes/lib/limites.ts")).toThrow(LimiteViolado);
    expect(() => caminhoSeguro("scripts/agentes/implementar.ts")).toThrow(LimiteViolado);
  });

  it("recusa fuga por caminho relativo, resolvendo antes de decidir", () => {
    // O modelo escreve a string; a checagem é no caminho resolvido. Nenhuma
    // destas parece proibida até resolver.
    for (const fuga of [
      "src/../.env",
      "src/lib/../../.env",
      "../fora-do-repo.ts",
      "../../etc/passwd",
      "src/./../../.git/config",
      "src/lib/../../package.json",
    ]) {
      expect(() => caminhoSeguro(fuga), fuga).toThrow(LimiteViolado);
    }
  });

  it("recusa caminho absoluto e caminho vazio", () => {
    expect(() => caminhoSeguro("/etc/passwd")).toThrow(LimiteViolado);
    expect(() => caminhoSeguro("")).toThrow(LimiteViolado);
    expect(() => caminhoSeguro("   ")).toThrow(LimiteViolado);
  });

  it("aceita o que o agente precisa mesmo mexer", () => {
    for (const ok of [
      "src/routes/copiloto.tsx",
      "server/services/motorLuan.service.ts",
      "shared/especialistas.ts",
      "tests/unit/novo.test.ts",
      "CLAUDE.md",
      ".env.example",
    ]) {
      expect(() => caminhoSeguro(ok), ok).not.toThrow();
    }
  });

  it("o .env.example é versionado e liberado; os outros .env não", () => {
    expect(() => caminhoSeguro(".env.example")).not.toThrow();
    expect(() => caminhoSeguro(".env")).toThrow(LimiteViolado);
    expect(() => caminhoSeguro("server/.env.example")).not.toThrow();
  });
});

describe("scripts que o agente pode rodar", () => {
  it("só a lista fechada", () => {
    expect([...SCRIPTS_PERMITIDOS]).toEqual(["typecheck", "lint", "test:unit", "format"]);
    for (const nome of SCRIPTS_PERMITIDOS) expect(scriptPermitido(nome)).toBe(true);
  });

  it("recusa qualquer outro, inclusive os que parecem inofensivos", () => {
    for (const nome of ["dev", "build", "start", "test", "test:e2e", "preview", "postinstall"]) {
      expect(scriptPermitido(nome), nome).toBe(false);
    }
  });

  it("recusa tentativa de emendar comando no nome do script", () => {
    for (const nome of [
      "typecheck && rm -rf /",
      "lint; cat .env",
      "test:unit | sh",
      "../../bin/sh",
    ]) {
      expect(scriptPermitido(nome), nome).toBe(false);
    }
  });

  it("o portão são os três que provam a mudança, e format não conta", () => {
    expect(PORTAO).toEqual(["typecheck", "lint", "test:unit"]);
    expect(PORTAO).not.toContain("format");
  });

  it("os arquivos do portão são conferidos no diff antes de confiar nele", () => {
    expect(PROTEGIDOS_NO_DIFF).toContain("package.json");
    expect(PROTEGIDOS_NO_DIFF).toContain("vitest.config.ts");
    expect(PROTEGIDOS_NO_DIFF).toContain("scripts/agentes");
    // .github entra: a primeira versão do filtro usava startsWith(".git") e
    // engolia o .github junto — esperteza em regra de segurança acaba assim.
    expect(PROTEGIDOS_NO_DIFF).toContain(".github");
    // .git e node_modules não entram: não aparecem em diff de trabalho.
    expect(PROTEGIDOS_NO_DIFF).not.toContain(".git");
    expect(PROTEGIDOS_NO_DIFF).not.toContain("node_modules");
  });
});
