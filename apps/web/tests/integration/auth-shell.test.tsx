import { screen, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { createQueryClient } from "@/app/query-client";
import { authQueryKeys } from "@/features/auth/queries";

import {
  createApiErrorEnvelope,
  createAuthenticationRequiredErrorEnvelope,
  createCurrentSessionResponse,
} from "../helpers/api-fixtures";
import { renderAppRoute } from "../helpers/render-router";
import { currentSessionEndpointPattern } from "../setup/handlers";
import { server } from "../setup/server";

const logoutEndpointPattern = /\/api\/v1\/auth\/session(?:\?.*)?$/;

function unauthenticatedCurrentSessionResponse() {
  return HttpResponse.json(createAuthenticationRequiredErrorEnvelope(), {
    status: 401,
  });
}

describe("auth-aware shell integration", () => {
  it("shows Checking session while the current-session query is unresolved", () => {
    server.use(
      http.get(currentSessionEndpointPattern, async () => {
        await delay(150);

        return unauthenticatedCurrentSessionResponse();
      }),
    );

    renderAppRoute("/");

    expect(
      screen.getByRole("button", { name: "Checking session" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("link", { name: "Login" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Logout" }),
    ).not.toBeInTheDocument();
  });

  it("shows Login and not Logout for unauthenticated users", async () => {
    renderAppRoute("/");

    expect(await screen.findByRole("link", { name: "Login" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(
      screen.queryByRole("button", { name: "Logout" }),
    ).not.toBeInTheDocument();
  });

  it("shows Logout and not Login for authenticated users", async () => {
    server.use(
      http.get(currentSessionEndpointPattern, () =>
        HttpResponse.json(createCurrentSessionResponse()),
      ),
    );

    renderAppRoute("/");

    expect(
      await screen.findByRole("button", { name: "Logout" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Login" }),
    ).not.toBeInTheDocument();
  });

  it("logs out successfully, stays on the current route, and swaps back to Login", async () => {
    let logoutCalls = 0;
    let isAuthenticated = true;

    server.use(
      http.get(currentSessionEndpointPattern, () => {
        if (isAuthenticated) {
          return HttpResponse.json(createCurrentSessionResponse());
        }

        return unauthenticatedCurrentSessionResponse();
      }),
      http.delete(logoutEndpointPattern, () => {
        logoutCalls += 1;
        isAuthenticated = false;

        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { queryClient, user } = renderAppRoute("/system");

    expect(
      await screen.findByRole("button", { name: "Logout" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(await screen.findByRole("link", { name: "Login" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(
      screen.getByRole("heading", { name: "System checks are live." }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(logoutCalls).toBe(1);
      expect(
        queryClient.getQueryData(authQueryKeys.currentSession()),
      ).toBeNull();
    });
  });

  it("shows a non-blocking auth error and keeps Logout visible when logout fails", async () => {
    server.use(
      http.get(currentSessionEndpointPattern, () =>
        HttpResponse.json(createCurrentSessionResponse()),
      ),
      http.delete(logoutEndpointPattern, () => HttpResponse.error()),
    );

    const { queryClient, user } = renderAppRoute("/system");

    expect(
      await screen.findByRole("button", { name: "Logout" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(
      await screen.findByText(
        "The frontend could not reach the API. Make sure the backend is running and try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Login" }),
    ).not.toBeInTheDocument();
    expect(queryClient.getQueryData(authQueryKeys.currentSession())).toEqual(
      createCurrentSessionResponse(),
    );
  });

  it("shows Login plus a non-blocking auth error when the initial current-session query fails", async () => {
    server.use(
      http.get(currentSessionEndpointPattern, () =>
        HttpResponse.json(
          createApiErrorEnvelope({
            code: "internal_server_error",
            message: "Internal server error",
          }),
          { status: 500 },
        ),
      ),
    );

    renderAppRoute("/");

    expect(await screen.findByRole("link", { name: "Login" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(
      await screen.findByText("internal_server_error: Internal server error"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Checking session" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("`apps/web` is live.")).toBeInTheDocument();
  });

  it("keeps Logout visible when cached authenticated state fails revalidation", async () => {
    const queryClient = createQueryClient();

    queryClient.setQueryData(
      authQueryKeys.currentSession(),
      createCurrentSessionResponse(),
    );

    server.use(
      http.get(currentSessionEndpointPattern, async () => {
        await delay(150);

        return HttpResponse.json(
          createApiErrorEnvelope({
            code: "internal_server_error",
            message: "Internal server error",
          }),
          { status: 500 },
        );
      }),
    );

    renderAppRoute("/", { queryClient });

    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();

    expect(
      await screen.findByText("internal_server_error: Internal server error"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Login" }),
    ).not.toBeInTheDocument();
  });
});
