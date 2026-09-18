import { Outlet, Link, createRootRouteWithContext, redirect } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import type { AuthApi } from "@/lib/auth/AuthContext";

export interface RouterContext {
  auth: AuthApi;
}

/**
 * Telas que só fazem sentido para quem NÃO tem sessão. Ficavam no mesmo
 * conjunto das públicas, e por isso qualquer caminho público com sessão ativa
 * era jogado para o dashboard — o que agora tiraria o médico logado do hub.
 */
const AUTH_ONLY_PATHS = new Set(["/login", "/cadastro"]);

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

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: ({ context, location }) => {
    const { auth } = context;
    if (!auth.configured) return;
    const { pathname } = location;
    // Sem trava de login: o app é de uso próprio, em plantão, e a tela de
    // login só atrapalhava. /login e /cadastro continuam existindo para quem
    // quiser entrar — mas nada exige sessão para funcionar.
    if (AUTH_ONLY_PATHS.has(pathname) && auth.session) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  return (
    <>
      <Outlet />
      <Toaster richColors position="top-right" />
    </>
  );
}
