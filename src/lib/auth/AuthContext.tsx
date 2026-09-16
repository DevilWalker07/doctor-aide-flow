import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { setTokenProvider, setUnauthorizedHandler } from "@/lib/apiClient";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export interface AuthApi {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configured: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, name: string): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
  getToken(): Promise<string | null>;
}

const AuthContext = createContext<AuthApi | null>(null);

function traduzErro(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("user already registered")) return "Já existe uma conta com este e-mail.";
  if (m.includes("password should be at least")) return "A senha deve ter pelo menos 8 caracteres.";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde um instante.";
  if (m.includes("fetch") || m.includes("network"))
    return "Sem conexão com o servidor de autenticação.";
  return message;
}

async function getAccessToken(): Promise<string | null> {
  if (!hasSupabaseConfig) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(hasSupabaseConfig);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    if (hasSupabaseConfig) await supabase.auth.signOut();
    setSession(null);
  }, []);

  useEffect(() => {
    setTokenProvider(getAccessToken);
    setUnauthorizedHandler(() => {
      void signOut().then(() => {
        if (!window.location.pathname.startsWith("/login")) window.location.assign("/login");
      });
    });
  }, [signOut]);

  const api = useMemo<AuthApi>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      configured: hasSupabaseConfig,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(traduzErro(error.message));
      },
      async signUp(email, password, name) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() } },
        });
        if (error) throw new Error(traduzErro(error.message));
        return { needsConfirmation: !data.session };
      },
      signOut,
      async resetPassword(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/nova-senha`,
        });
        if (error) throw new Error(traduzErro(error.message));
      },
      async updatePassword(newPassword) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw new Error(traduzErro(error.message));
      },
      getToken: getAccessToken,
    }),
    [session, loading, signOut],
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>.");
  return ctx;
}
