import { useUser } from "@clerk/clerk-react";

export function useSupabaseUser() {
  const { user, isLoaded } = useUser();

  return {
    userId: user?.id ?? null,
    userEmail: user?.primaryEmailAddress?.emailAddress ?? null,
    userName: user?.fullName ?? user?.firstName ?? "Medico",
    isLoaded,
  };
}
