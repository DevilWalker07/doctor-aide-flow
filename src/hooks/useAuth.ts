// Local-only mock auth. Replaces Clerk integration.
// Always returns "signed in" with a stable local user.

import { useSupabaseUser } from "./useSupabaseUser";

export function useAuth() {
  const { userId, userName } = useSupabaseUser();

  return {
    user: {
      id: userId,
      email: "",
      user_metadata: {
        name: userName,
      },
    },
    session: { access_token: "local" },
    loading: false,
    isLoaded: true,
    isSignedIn: true,
    clerkUser: null,
    getToken: async () => "local",
  };
}
