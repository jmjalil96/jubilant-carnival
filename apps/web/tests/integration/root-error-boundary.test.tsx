import { screen } from "@testing-library/react";
import type { RouteObject } from "react-router";
import { describe, expect, it, vi } from "vitest";

import RootErrorBoundary from "@/routes/root/RootErrorBoundary";
import RootLayout from "@/routes/root/RootLayout";

import { renderRouterWithProviders } from "../helpers/render-router";

function ThrowingRoute(): never {
  throw new Error("System route crashed");
}

describe("root error boundary integration", () => {
  it("keeps the shell visible when a child route throws", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const routes: RouteObject[] = [
      {
        path: "/",
        Component: RootLayout,
        ErrorBoundary: RootErrorBoundary,
        children: [
          {
            index: true,
            Component: ThrowingRoute,
          },
        ],
      },
    ];

    renderRouterWithProviders({
      initialEntries: ["/"],
      routes,
    });

    expect(await screen.findByText("Jubilant Carnival")).toBeInTheDocument();
    expect(
      await screen.findByText("Something went wrong."),
    ).toBeInTheDocument();
    expect(screen.getByText("System route crashed")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Return home" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reload page" }),
    ).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
