import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from "react-router";

import { createQueryClient } from "@/app/query-client";
import { appRoutes } from "@/app/router";

export function renderRouterWithProviders({
  initialEntries = ["/"],
  routes,
}: {
  initialEntries?: string[];
  routes: RouteObject[];
}) {
  const queryClient = createQueryClient();
  const router = createMemoryRouter(routes, { initialEntries });
  const user = userEvent.setup();

  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return {
    ...renderResult,
    queryClient,
    router,
    user,
  };
}

export function renderAppRoute(initialEntry = "/") {
  return renderRouterWithProviders({
    initialEntries: [initialEntry],
    routes: appRoutes,
  });
}
