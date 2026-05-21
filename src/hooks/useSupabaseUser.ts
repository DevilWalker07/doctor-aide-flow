import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  isLoaded: boolean;
}

/**
 * Hook de sessão Supabase. Retorna o usuário logado e o status de load.
 *
 * Auth real (não é mais mock): lê de supabase.auth.getSession() e ouve
 * onAuthStateChange pra sincronizar login/logout em todas as tabs.
 *
 * - userId: null se não autenticado (consumidores devem aguardar isLoaded
 *   antes de tomar decisão de fetch)
 * - userEmail / userName: derivados do user.user_metadata
 * - isLoaded: false durante o boot até o getSession resolver
 * - isAuthenticated: true se há sessão ativa
 */
export function useSupabaseUser() {
  const [state, setState] = useState<AuthState>({ user: null, isLoaded: false });

  useEffect(() => {
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
