import { supabase } from "@/integrations/supabase/client";

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email: string, password: string, fullName?: string) {
  const result = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName ?? "" } },
  });

  const userId = result.data.user?.id;
  if (userId) {
    await (supabase as any).from("profiles").upsert([{
      id: userId,
      full_name: fullName ?? email,
      specialty: "Clínica Médica",
      default_hospital: "HNAS",
    }]);
  }

  return result;
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  return supabase.auth.getSession();
}
