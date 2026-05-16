import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/recuperar-senha")({
  component: RecuperarSenhaRedirect,
});

function RecuperarSenhaRedirect() {
  return <Navigate to="/" replace />;
}
