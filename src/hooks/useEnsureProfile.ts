import { useEffect } from "react";
import { getProfile, upsertProfile } from "@/lib/db";
import { storage } from "@/lib/storage";
import { useSupabaseUser } from "./useSupabaseUser";

export function useEnsureProfile() {
  const { userId, userName, isLoaded } = useSupabaseUser();

  useEffect(() => {
    if (!isLoaded || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await getProfile(userId);
        if (cancelled) return;
        if (!profile?.name) await upsertProfile({ name: userName }, userId);
        if (profile?.name) storage.setNomeMedico(profile.name);
        if (profile?.crm) storage.setCRM(profile.crm);
        if (profile?.specialty) storage.setEspecialidade(profile.specialty);
        if (profile?.hospital) storage.setHospitalPadrao(profile.hospital);
      } catch {
        /* offline ou tabela indisponível — localStorage continua como fonte */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, userId, userName]);
}
