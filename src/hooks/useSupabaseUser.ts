// Local-only mock user. Replaces Clerk integration.
// Generates a stable user id stored in localStorage so all data persists.

const USER_ID_KEY = "da_local_user_id";
const USER_NAME_KEY = "da_local_user_name";

function generateUUID(): string {
  // RFC4122 v4 fallback for environments without crypto.randomUUID
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // fall through
    }
  }
  // xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getOrCreateLocalUserId(): string {
  if (typeof window === "undefined") return "00000000-0000-4000-8000-000000000000";
  try {
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) {
      id = generateUUID();
      localStorage.setItem(USER_ID_KEY, id);
    }
    return id;
  } catch {
    return "00000000-0000-4000-8000-000000000000";
  }
}

function getLocalUserName(): string {
  if (typeof window === "undefined") return "Doutor";
  try {
    return localStorage.getItem(USER_NAME_KEY) || "Doutor";
  } catch {
    return "Doutor";
  }
}

export function useSupabaseUser() {
  const userId = getOrCreateLocalUserId();
  const userName = getLocalUserName();

  return {
    userId,
    userEmail: null as string | null,
    userName,
    isLoaded: true,
  };
}
