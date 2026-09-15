import { Outlet, Link, createRootRouteWithContext, redirect } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import type { AuthApi } from "@/lib/auth/AuthContext";

export interface RouterContext {
  auth: AuthApi;
}

const PUBLIC_PATHS = new Set(["/login", "/cadastro", "/recuperar-senha", "/nova-senha"]);

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
    const isPublic = PUBLIC_PATHS.has(location.pathname);
    if (!isPublic && !auth.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    if (isPublic && auth.session && location.pathname !== "/nova-senha") {
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
