import { createFileRoute } from "@tanstack/react-router";

/**
 * Rota interna de teste para validar o ErrorBoundary global.
 * Não está documentada e só lança quando ?force=1.
 * Mantida no build para permitir E2E reproduzível.
 */
export const Route = createFileRoute("/test-throw")({
  component: ThrowComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    force: search.force != null && String(search.force) !== "0" && String(search.force) !== "false",
  }),
});

function ThrowComponent() {
  const { force } = Route.useSearch();
  if (force) {
    throw new Error("Erro forçado pela rota de teste __test_throw");
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-xs text-muted-foreground italic">Rota de teste — adicione ?force=1 para disparar erro.</p>
    </div>
  );
}
