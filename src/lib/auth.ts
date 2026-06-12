/**
 * Helpers de autenticação Supabase — email/senha + Google OAuth.
 *
 * Decisões tomadas (enquete):
 * - Email/senha + Google OAuth
 * - Sem confirmação de email (login imediato)
 * - Limpa localStorage no logout (começar limpo)
 */
import { supabase } from "./supabase";

export interface AuthError {
  message: string;
  code?: string;
}

export async function signUpWithEmail(email: string, password: string, name?: string) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: name ? { name: name.trim() } : undefined,
    },
  });
  if (error) throw normalizeError(error);
  return data;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw normalizeError(error);
  return data;
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });
  if (error) throw normalizeError(error);
  return data;
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/nova-senha`,
  });
  if (error) throw normalizeError(error);
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw normalizeError(error);
}

/**
 * Logout: limpa sessão Supabase + localStorage (preservando preferências
 * neutras como tema). Redireciona pra /login.
 */
export async function signOutAndClear() {
  await supabase.auth.signOut();

  try {
    const keysToKeep = new Set<string>(["da_theme"]);
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && !keysToKeep.has(k)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore quota */ }

  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

function normalizeError(err: any): AuthError {
  const raw = (err?.message || "Erro desconhecido").toLowerCase();
  if (raw.includes("invalid login credentials")) {
    return { message: "Email ou senha incorretos.", code: "invalid_credentials" };
  }
  if (raw.includes("user already registered") || raw.includes("already exists")) {
    return { message: "Este email já tem conta. Faça login.", code: "user_exists" };
  }
  if (raw.includes("password should be") || raw.includes("weak password")) {
    return { message: "Senha muito fraca. Use ao menos 6 caracteres.", code: "weak_password" };
  }
  if (raw.includes("rate limit") || raw.includes("too many")) {
    return { message: "Muitas tentativas. Aguarde alguns minutos.", code: "rate_limit" };
  }
  if (raw.includes("network") || raw.includes("failed to fetch")) {
    return { message: "Sem conexão. Verifique sua internet.", code: "network" };
  }
  if (raw.includes("email") && raw.includes("invalid")) {
    return { message: "Email inválido.", code: "invalid_email" };
  }
  return { message: err?.message || "Erro desconhecido", code: err?.code };
}
