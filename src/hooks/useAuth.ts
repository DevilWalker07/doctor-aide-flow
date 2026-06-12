// Wrapper de compatibilidade. Agora auth é real via Supabase
// (não é mais mock). Mantém o shape antigo pra não quebrar consumidores
// — mas user / session viram null quando deslogado.

import { useSupabaseUser } from "./useSupabaseUser";
import { supabase } from "@/lib/supabase";

export function useAuth() {
  const { userId, userEmail, userName, isLoaded, isAuthenticated } = useSupabaseUser();

  return {
    user: userId
      ? {
          id: userId,
          email: userEmail ?? "",
          user_metadata: { name: userName },
        }
      : null,
    session: isAuthenticated ? { access_token: "supabase" } : null,
    loading: !isLoaded,
    isLoaded,
    isSignedIn: isAuthenticated,
    clerkUser: null,
    getToken: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? "";
    },
  };
}
