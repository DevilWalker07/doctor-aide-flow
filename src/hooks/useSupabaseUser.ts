import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  isLoaded: boolean;
}

/**
 * Bypass pra testes E2E (VITE_E2E=true). Lê o userId/name do localStorage
 * em vez do Supabase. Evita ter que mockar sessão Supabase nos testes,
 * que é frágil — depende da chave interna do supabase-js.
 *
 * Em produção e dev, VITE_E2E é undefined e o caminho normal (Supabase
 * Auth real) roda. Esse branch nunca executa em runtime de usuário real.
 */
const E2E_BYPASS = import.meta.env.VITE_E2E === "true";

function readE2EUser(): User | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem("da_local_user_id");
  if (!id) return null;
  const name = localStorage.getItem("da_local_user_name") || "Doutor";
  return {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "e2e@test.local",
    user_metadata: { name },
    app_metadata: {},
    created_at: new Date().toISOString(),
  } as User;
}

/**
 * Hook de sessão Supabase. Retorna o usuário logado e o status de load.
 *
 * Auth real: lê de supabase.auth.getSession() e ouve onAuthStateChange
 * pra sincronizar login/logout em todas as tabs.
 *
 * - userId: null se não autenticado (consumidores devem aguardar isLoaded
 *   antes de tomar decisão de fetch)
 * - userEmail / userName: derivados do user.user_metadata
 * - isLoaded: false durante o boot até o getSession resolver
 * - isAuthenticated: true se há sessão ativa
 */
export function useSupabaseUser() {
  const [state, setState] = useState<AuthState>(() => {
    if (E2E_BYPASS) {
      return { user: readE2EUser(), isLoaded: true };
    }
    return { user: null, isLoaded: false };
  });

  useEffect(() => {
    if (E2E_BYPASS) return; // pula Supabase Auth em E2E

    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setState({ user: data.session?.user ?? null, isLoaded: true });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, isLoaded: true });
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const user = state.user;
  const userName =
    (user?.user_metadata?.name as string | undefined) ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Doutor";

  return {
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
    userName,
    isLoaded: state.isLoaded,
    isAuthenticated: !!user,
  };
}
