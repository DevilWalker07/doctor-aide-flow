import { createFileRoute, Outlet } from "@tanstack/react-router";

export type EvolucaoSearch = { from?: string };

export const Route = createFileRoute("/evolucao/$id")({
  component: () => <Outlet />,
  validateSearch: (search: Record<string, unknown>): EvolucaoSearch => ({
    from: typeof search.from === "string" ? search.from : undefined,
  }),
});
