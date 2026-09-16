import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/cadastro")({
  component: CadastroRedirect,
  head: () => ({ meta: [{ title: "MEDFLUXO" }] }),
});

function CadastroRedirect() {
  return <Navigate to="/" replace />;
}
