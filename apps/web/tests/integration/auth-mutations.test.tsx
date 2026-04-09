import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { createQueryClient } from "@/app/query-client";
import {
  useConfirmPasswordResetMutation,
  useLoginMutation,
  useLogoutMutation,
} from "@/features/auth/mutations";
import { authQueryKeys, useAuthSession } from "@/features/auth/queries";

import {
  createAuthenticationRequiredErrorEnvelope,
  createCurrentSessionResponse,
} from "../helpers/api-fixtures";
import { currentSessionEndpointPattern } from "../setup/handlers";
import { server } from "../setup/server";

const sessionEndpointPattern = /\/api\/v1\/auth\/session(?:\?.*)?$/;
const resetPasswordEndpointPattern =
  /\/api\/v1\/auth\/password-reset\/confirm(?:\?.*)?$/;

function renderMutationProbe(component: ReactElement) {
  const queryClient = createQueryClient();
  const user = userEvent.setup();

  render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>,
  );

  return {
    queryClient,
    user,
  };
}

function LoginMutationProbe() {
  const authSession = useAuthSession();
  const loginMutation = useLoginMutation();

  return (
    <div>
      <div>{`Status:${authSession.status}`}</div>
      <div>
        {`Session:${authSession.session === null ? "none" : authSession.session.actor.user.email}`}
      </div>
      <button
        onClick={() => {
          loginMutation.mutate({
            email: "user@example.com",
            password: "super-secret-password",
          });
        }}
        type="button"
      >
        Login
      </button>
    </div>
  );
}

function LogoutMutationProbe() {
  const authSession = useAuthSession();
  const logoutMutation = useLogoutMutation();

  return (
    <div>
      <div>{`Status:${authSession.status}`}</div>
      <div>
        {`Session:${authSession.session === null ? "none" : authSession.session.actor.user.email}`}
      </div>
      <button
        onClick={() => {
          logoutMutation.mutate();
        }}
        type="button"
      >
        Logout
      </button>
    </div>
  );
}

function ResetPasswordMutationProbe() {
  const authSession = useAuthSession();
  const resetPasswordMutation = useConfirmPasswordResetMutation();

  return (
    <div>
      <div>{`Status:${authSession.status}`}</div>
      <div>
        {`Session:${authSession.session === null ? "none" : authSession.session.actor.user.email}`}
      </div>
      <button
        onClick={() => {
          resetPasswordMutation.mutate({
            token: "valid-reset-token",
            password: "new-super-secret-password",
          });
        }}
        type="button"
      >
        Reset Password
      </button>
    </div>
  );
}

describe("auth mutation cache integration", () => {
  it("updates the current session cache on login without forcing an immediate /auth/me refetch", async () => {
    let currentSessionCalls = 0;
    const currentSessionResponse = createCurrentSessionResponse();

    server.use(
      http.get(currentSessionEndpointPattern, () => {
        currentSessionCalls += 1;

        return HttpResponse.json(createAuthenticationRequiredErrorEnvelope(), {
          status: 401,
        });
      }),
      http.post(sessionEndpointPattern, () =>
        HttpResponse.json(currentSessionResponse),
      ),
    );

    const { queryClient, user } = renderMutationProbe(<LoginMutationProbe />);

    expect(
      await screen.findByText("Status:unauthenticated"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Status:authenticated")).toBeInTheDocument();
    expect(screen.getByText("Session:user@example.com")).toBeInTheDocument();
    expect(currentSessionCalls).toBe(1);
    expect(queryClient.getQueryData(authQueryKeys.currentSession())).toEqual(
      currentSessionResponse,
    );
  });

  it("updates the current session cache on logout without forcing an immediate /auth/me refetch", async () => {
    let currentSessionCalls = 0;

    server.use(
      http.get(currentSessionEndpointPattern, () => {
        currentSessionCalls += 1;

        return HttpResponse.json(createCurrentSessionResponse());
      }),
      http.delete(
        sessionEndpointPattern,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    const { queryClient, user } = renderMutationProbe(<LogoutMutationProbe />);

    expect(await screen.findByText("Status:authenticated")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(
      await screen.findByText("Status:unauthenticated"),
    ).toBeInTheDocument();
    expect(screen.getByText("Session:none")).toBeInTheDocument();
    expect(currentSessionCalls).toBe(1);
    expect(queryClient.getQueryData(authQueryKeys.currentSession())).toBeNull();
  });

  it("updates the current session cache on password reset confirmation without forcing an immediate /auth/me refetch", async () => {
    let currentSessionCalls = 0;

    server.use(
      http.get(currentSessionEndpointPattern, () => {
        currentSessionCalls += 1;

        return HttpResponse.json(createCurrentSessionResponse());
      }),
      http.post(
        resetPasswordEndpointPattern,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    const { queryClient, user } = renderMutationProbe(
      <ResetPasswordMutationProbe />,
    );

    expect(await screen.findByText("Status:authenticated")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset Password" }));

    await waitFor(() => {
      expect(screen.getByText("Status:unauthenticated")).toBeInTheDocument();
    });
    expect(screen.getByText("Session:none")).toBeInTheDocument();
    expect(currentSessionCalls).toBe(1);
    expect(queryClient.getQueryData(authQueryKeys.currentSession())).toBeNull();
  });
});
