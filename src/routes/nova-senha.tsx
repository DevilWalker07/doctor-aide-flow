import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/nova-senha")({
  component: NovaSenhaRedirect,
});

function NovaSenhaRedirect() {
  return <Navigate to="/" replace />;
}
