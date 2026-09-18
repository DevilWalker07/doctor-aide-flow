import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";

const authState = {
  user: null as User | null,
  loading: false,
  configured: true,
};

vi.mock("../../src/lib/auth/AuthContext", () => ({
  useAuth: () => authState,
}));

const { useSupabaseUser } = await import("../../src/hooks/useSupabaseUser.js");

const UUID = /^[0-9a-f-]{8,}$/i;

// O hook não tem estado nem efeito: é função pura sobre o useAuth mockado.
// Chamar direto evita depender de uma biblioteca de render que o projeto não
// tem. O nome começa com "use" porque a regra de hooks do ESLint exige isso de
// quem chama um hook — e aqui a regra está certa sobre a forma, só não se
// aplica ao caso.
const useLeitura = () => useSupabaseUser();

/**
 * Este hook decide se o app funciona ou abre em branco.
 *
 * As telas do plantão começam com `if (!userId) return;`, e o fallback de
 * localStorage delas está depois desse return. Então `userId` nulo não é um
 * detalhe: é dashboard, evolução e prescrição em branco, sem mensagem.
 */
describe("useSupabaseUser", () => {
  beforeEach(() => {
    localStorage.clear();
    authState.user = null;
    authState.loading = false;
    authState.configured = true;
  });

  it("Supabase configurado e ninguém logado: devolve id local, não nulo", () => {
    const r = useLeitura();
    expect(r.userId).toMatch(UUID);
    expect(r.localMode).toBe(true);
    expect(r.isLoaded).toBe(true);
  });

  it("o id local é o mesmo entre montagens — o plantão não troca de dono", () => {
    expect(useLeitura().userId).toBe(useLeitura().userId);
  });

  it("enquanto a sessão está sendo restaurada, NÃO cai em modo local", () => {
    // Cair em modo local aqui faria quem tem login gravar no id errado.
    authState.loading = true;
    const r = useLeitura();
    expect(r.userId).toBeNull();
    expect(r.localMode).toBe(false);
    expect(r.isLoaded).toBe(false);
  });

  it("com sessão, usa o id do Supabase e sai do modo local", () => {
    authState.user = { id: "user-real", email: "medico@exemplo.com" } as User;
    const r = useLeitura();
    expect(r.userId).toBe("user-real");
    expect(r.localMode).toBe(false);
  });

  it("sem Supabase configurado, segue em modo local como antes", () => {
    authState.configured = false;
    const r = useLeitura();
    expect(r.userId).toMatch(UUID);
    expect(r.localMode).toBe(true);
  });
});
