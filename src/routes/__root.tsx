import { Outlet, Link, createRootRoute, useRouterState, useNavigate, Navigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import BottomNav from "@/components/BottomNav";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";

const PUBLIC_ROUTES = ["/login", "/cadastro", "/nova-senha"];

/**
 * Bypass do auth guard em testes E2E. Setado no CI via VITE_E2E=true
 * pra Playwright poder navegar livremente sem mockar sessão Supabase
 * (que é frágil — depende da chave interna do supabase-js).
 *
 * Em produção e dev este flag é undefined, então o guard funciona normal.
 */
const E2E_BYPASS = import.meta.env.VITE_E2E === "true";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAuthenticated, isLoaded } = useSupabaseUser();
  const nav = useNavigate();

  const isPublic = PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const effectiveAuth = E2E_BYPASS || isAuthenticated;

  // Guard: redireciona deslogado pra /login (exceto em rotas públicas e em E2E)
  useEffect(() => {
    if (E2E_BYPASS) return;
    if (!isLoaded) return;
    if (!isAuthenticated && !isPublic) {
      nav({ to: "/login", replace: true });
    }
  }, [isLoaded, isAuthenticated, isPublic, nav]);

  // Loading state durante boot (skip em E2E pra evitar timeout dos testes)
  if (!isLoaded && !E2E_BYPASS) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Bloqueia render em rotas privadas se deslogado (evita flash de conteúdo)
  if (!effectiveAuth && !isPublic) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <div className={isPublic ? "" : "md:pb-0 pb-16"}>
        <Outlet />
      </div>
      {effectiveAuth && !isPublic && <BottomNav />}
      <Toaster richColors position="top-right" />
    </>
  );
}
