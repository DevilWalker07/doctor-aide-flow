import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  component: LoginRedirect,
  head: () => ({ meta: [{ title: "MEDFLUXO" }] }),
});

function LoginRedirect() {
  return <Navigate to="/" replace />;
}
