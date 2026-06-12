import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import ErrorPage from "./components/ErrorPage";

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: ({ error, reset }) => <ErrorPage error={error} reset={reset} />,
  });

  return router;
};
