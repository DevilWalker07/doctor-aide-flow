import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { useEffect } from "react";
import { getRouter } from "./router";
import { AuthProvider, useAuth } from "./lib/auth/AuthContext";
import "./styles.css";

const router = getRouter();

function Splash() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-10 w-10 rounded-2xl bg-primary animate-pulse" aria-label="Carregando" />
    </div>
  );
}

function App() {
  const auth = useAuth();
  const userId = auth.user?.id ?? null;

  useEffect(() => {
    void router.invalidate();
  }, [userId, auth.loading]);

  if (auth.loading) return <Splash />;
  return <RouterProvider router={router} context={{ auth }} />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
