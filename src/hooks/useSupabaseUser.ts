import { useAuth } from "@/lib/auth/AuthContext";

const LOCAL_USER_ID_KEY = "da_local_user_id";

// Sem Supabase configurado o app roda em modo local (sem login): mantém um id estável por dispositivo.
function getLocalUserId(): string {
  try {
    let id = localStorage.getItem(LOCAL_USER_ID_KEY);
    if (!id) {
      id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `local-${Date.now()}`;
      localStorage.setItem(LOCAL_USER_ID_KEY, id);
    }
    return id;
  } catch {
    return "00000000-0000-4000-8000-000000000000";
  }
}

export function useSupabaseUser() {
  const { user, loading, configured } = useAuth();

  if (!configured) {
    return { userId: getLocalUserId(), userEmail: null as string | null, userName: "Doutor", isLoaded: true, localMode: true };
  }

  const meta = (user?.user_metadata ?? {}) as { name?: string };
  return {
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
    userName: meta.name || user?.email?.split("@")[0] || "Doutor",
    isLoaded: !loading,
    localMode: false,
  };
}
