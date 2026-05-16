import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/cadastro")({
  component: CadastroRedirect,
  head: () => ({ meta: [{ title: "DOUTOR AJUDA" }] }),
});

function CadastroRedirect() {
  return <Navigate to="/" replace />;
}
