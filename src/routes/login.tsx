import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  component: LoginRedirect,
  head: () => ({ meta: [{ title: "DOUTOR AJUDA" }] }),
});

function LoginRedirect() {
  return <Navigate to="/" replace />;
}
