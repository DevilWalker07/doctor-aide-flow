import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useSupabaseUser } from "./useSupabaseUser";

export function useEnsureProfile() {
  const { userId, userName } = useSupabaseUser();

  useEffect(() => {
    if (!userId) return;

    async function ensureProfile() {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!data) {
        await supabase.from("profiles").insert({
          user_id: userId,
          name: userName,
        });
      }

      localStorage.setItem("da_nome_medico", userName ?? "Medico");
    }

    ensureProfile();
  }, [userId, userName]);
}
