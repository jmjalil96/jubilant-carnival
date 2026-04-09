import { screen, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/app/query-client";
import { authQueryKeys, useAuthSession } from "@/features/auth/queries";

import {
  createApiErrorEnvelope,
  createAuthenticationRequiredErrorEnvelope,
  createCurrentSessionResponse,
} from "../helpers/api-fixtures";
import { renderRouterWithProviders } from "../helpers/render-router";
import { currentSessionEndpointPattern } from "../setup/handlers";
import { server } from "../setup/server";

function AuthSessionProbe() {
  const authSession = useAuthSession();

  return (
    <div>
      <div>{`Status:${authSession.status}`}</div>
      <div>{`Refreshing:${authSession.isRefreshing ? "yes" : "no"}`}</div>
      <div>
        {`Verifying:${authSession.isVerifyingCachedAuthentication ? "yes" : "no"}`}
      </div>
      <div>
        {`Session:${authSession.session === null ? "none" : authSession.session.actor.user.email}`}
      </div>
      <div>
        {`ExpiresAt:${authSession.session === null ? "none" : authSession.session.session.expiresAt}`}
      </div>
      <div>
        {`Error:${authSession.error === null ? "none" : `${authSession.error.code}:${authSession.error.message}:${authSession.error.status}`}`}
      </div>
    </div>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("auth session integration", () => {
  it("resolves to authenticated state for a valid current-session response", async () => {
    server.use(
      http.get(currentSessionEndpointPattern, () =>
        HttpResponse.json(createCurrentSessionResponse()),
      ),
    );

    renderRouterWithProviders({
      routes: [
        {
          path: "/",
          Component: AuthSessionProbe,
        },
      ],
    });

    expect(screen.getByText("Status:checking")).toBeInTheDocument();
    expect(await screen.findByText("Status:authenticated")).toBeInTheDocument();
    expect(screen.getByText("Session:user@example.com")).toBeInTheDocument();
    expect(
      screen.getByText("ExpiresAt:2099-05-01T00:00:00.000Z"),
    ).toBeInTheDocument();
    expect(screen.getByText("Error:none")).toBeInTheDocument();
  });

  it("normalizes authentication_required into unauthenticated state", async () => {
    server.use(
      http.get(currentSessionEndpointPattern, () =>
        HttpResponse.json(createAuthenticationRequiredErrorEnvelope(), {
          status: 401,
        }),
      ),
    );

    renderRouterWithProviders({
      routes: [
        {
          path: "/",
          Component: AuthSessionProbe,
        },
      ],
    });

    expect(
      await screen.findByText("Status:unauthenticated"),
    ).toBeInTheDocument();
    expect(screen.getByText("Session:none")).toBeInTheDocument();
    expect(screen.getByText("Error:none")).toBeInTheDocument();
  });

  it("surfaces initial non-auth failures as unauthenticated state with an error", async () => {
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

    renderRouterWithProviders({
      routes: [
        {
          path: "/",
          Component: AuthSessionProbe,
        },
      ],
    });

    expect(
      await screen.findByText("Status:unauthenticated"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Error:internal_server_error:Internal server error:500"),
    ).toBeInTheDocument();
    expect(screen.getByText("Session:none")).toBeInTheDocument();
  });

  it("keeps cached authenticated state when a revalidation fails", async () => {
    const queryClient = createQueryClient();

    queryClient.setQueryData(
      authQueryKeys.currentSession(),
      createCurrentSessionResponse(),
    );

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

    renderRouterWithProviders({
      queryClient,
      routes: [
        {
          path: "/",
          Component: AuthSessionProbe,
        },
      ],
    });

    expect(screen.getByText("Status:authenticated")).toBeInTheDocument();
    expect(screen.getByText("Verifying:yes")).toBeInTheDocument();

    expect(
      await screen.findByText(
        "Error:internal_server_error:Internal server error:500",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Status:authenticated")).toBeInTheDocument();
    expect(screen.getByText("Session:user@example.com")).toBeInTheDocument();
    expect(screen.getByText("Verifying:no")).toBeInTheDocument();
  });

  it("keeps verifying cached authenticated state until a revalidation returns unauthenticated", async () => {
    const queryClient = createQueryClient();

    queryClient.setQueryData(
      authQueryKeys.currentSession(),
      createCurrentSessionResponse(),
    );

    server.use(
      http.get(currentSessionEndpointPattern, async () => {
        await delay(150);

        return HttpResponse.json(createAuthenticationRequiredErrorEnvelope(), {
          status: 401,
        });
      }),
    );

    renderRouterWithProviders({
      queryClient,
      routes: [
        {
          path: "/",
          Component: AuthSessionProbe,
        },
      ],
    });

    expect(screen.getByText("Status:authenticated")).toBeInTheDocument();
    expect(screen.getByText("Verifying:yes")).toBeInTheDocument();
    expect(screen.getByText("Session:user@example.com")).toBeInTheDocument();

    expect(
      await screen.findByText("Status:unauthenticated"),
    ).toBeInTheDocument();
    expect(screen.getByText("Verifying:no")).toBeInTheDocument();
    expect(screen.getByText("Session:none")).toBeInTheDocument();
    expect(screen.getByText("Error:none")).toBeInTheDocument();
  });

  it("invalidates the current session again when the cached expiry is reached", async () => {
    const queryClient = createQueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    const currentSessionResponse = createCurrentSessionResponse({
      session: {
        expiresAt: new Date(Date.now() + 50).toISOString(),
      },
    });

    queryClient.setQueryData(
      authQueryKeys.currentSession(),
      currentSessionResponse,
    );

    server.use(
      http.get(currentSessionEndpointPattern, () =>
        HttpResponse.json(currentSessionResponse),
      ),
    );

    renderRouterWithProviders({
      queryClient,
      routes: [
        {
          path: "/",
          Component: AuthSessionProbe,
        },
      ],
    });

    expect(await screen.findByText("Status:authenticated")).toBeInTheDocument();
    expect(
      screen.getByText(`ExpiresAt:${currentSessionResponse.session.expiresAt}`),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: authQueryKeys.currentSession(),
      });
    });
  });
});
