import { useAuth } from "@clerk/clerk-react";
import { Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useEnsureProfile } from "@/hooks/useEnsureProfile";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const [authLoadTimedOut, setAuthLoadTimedOut] = useState(false);
  useEnsureProfile();

  useEffect(() => {
    if (isLoaded) {
      setAuthLoadTimedOut(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAuthLoadTimedOut(true);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [isLoaded]);

  // If Clerk hangs while loading, route unauthenticated users back to the public login page.
  if (!isLoaded && authLoadTimedOut) {
    return <Navigate to="/login" replace />;
  }

  // If clerk is not loaded, show a minimal clean spinner to avoid flickering.
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Iniciando sessão...</p>
        </div>
      </div>
    );
  }

  // Only redirect if explicitly not signed in after loading
  if (!isSignedIn) {
    // Avoid double navigation if we are already on login
    if (window.location.pathname === "/login") {
      return null;
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
