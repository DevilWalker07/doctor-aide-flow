import { useAuth as useClerkAuth, useUser } from "@clerk/clerk-react";

export function useAuth() {
  const { isLoaded, isSignedIn, getToken } = useClerkAuth();
  const { user } = useUser();

  return {
    user: isSignedIn
      ? {
          id: user?.id ?? "",
          email: user?.primaryEmailAddress?.emailAddress ?? "",
          user_metadata: {
            name: user?.fullName ?? "",
          },
        }
      : null,
    session: isSignedIn ? { access_token: "clerk" } : null,
    loading: !isLoaded,
    isLoaded,
    isSignedIn,
    clerkUser: user,
    getToken,
  };
}
