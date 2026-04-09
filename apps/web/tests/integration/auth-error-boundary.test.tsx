import { screen } from "@testing-library/react";
import type { RouteObject } from "react-router";
import { describe, expect, it, vi } from "vitest";

import AuthErrorBoundary from "@/routes/auth/AuthErrorBoundary";

import { renderRouterWithProviders } from "../helpers/render-router";

function ThrowingRoute(): never {
  throw new Error("Forgot password route crashed");
}

describe("auth error boundary integration", () => {
  it("keeps the auth layout visible when an auth route throws", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const routes: RouteObject[] = [
      {
        path: "/forgot-password",
        Component: ThrowingRoute,
        ErrorBoundary: AuthErrorBoundary,
      },
    ];

    renderRouterWithProviders({
      initialEntries: ["/forgot-password"],
      routes,
    });

    expect(
      await screen.findByText(
        "Infrastructure-first access for the web client.",
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Something went wrong."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Forgot password route crashed"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Return home" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reload page" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Infrastructure-first React starter"),
    ).not.toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
