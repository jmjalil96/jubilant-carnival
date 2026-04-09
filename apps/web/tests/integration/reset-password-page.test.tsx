import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { authQueryKeys } from "@/features/auth/queries";

import { renderAppRoute } from "../helpers/render-router";
import { server } from "../setup/server";

const resetPasswordEndpointPattern =
  /\/api\/v1\/auth\/password-reset\/confirm(?:\?.*)?$/;

function createCurrentSessionResponse() {
  return {
    actor: {
      user: {
        id: "user-123",
        email: "user@example.com",
        displayName: "Test User",
      },
      tenant: {
        id: "tenant-123",
        slug: "test-tenant",
        name: "Test Tenant",
      },
      roleKeys: ["affiliate", "client_admin"],
    },
    session: {
      expiresAt: "2026-05-01T00:00:00.000Z",
    },
  };
}

describe("/reset-password route integration", () => {
  it("renders the invalid-link state when the token is missing", async () => {
    renderAppRoute("/reset-password");

    expect(
      await screen.findByRole("heading", { name: "Invalid reset link" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Request a new link" }),
    ).toHaveAttribute("href", "/forgot-password");
    expect(
      screen.getByRole("link", { name: "Back to sign in" }),
    ).toHaveAttribute("href", "/login");
  });

  it("renders the invalid-link state when the token is empty", async () => {
    renderAppRoute("/reset-password?token=");

    expect(
      await screen.findByRole("heading", { name: "Invalid reset link" }),
    ).toBeInTheDocument();
  });

  it("renders the invalid-link state without calling the confirm endpoint when the token is too long", async () => {
    let confirmRequestCount = 0;

    server.use(
      http.post(resetPasswordEndpointPattern, () => {
        confirmRequestCount += 1;

        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderAppRoute(`/reset-password?token=${"a".repeat(1_025)}`);

    expect(
      await screen.findByRole("heading", { name: "Invalid reset link" }),
    ).toBeInTheDocument();
    expect(confirmRequestCount).toBe(0);
  });

  it("renders the reset form when the token is valid", async () => {
    renderAppRoute("/reset-password?token=valid-reset-token");

    expect(
      await screen.findByRole("heading", { name: "Reset password" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reset password" }),
    ).toBeInTheDocument();
  });

  it("shows client validation messages for an empty submit", async () => {
    const { user } = renderAppRoute("/reset-password?token=valid-reset-token");

    await screen.findByRole("button", { name: "Reset password" });
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(
      await screen.findByText("Password must be at least 8 characters"),
    ).toBeInTheDocument();
  });

  it("shows client validation messages for a password shorter than 8 characters", async () => {
    const { user } = renderAppRoute("/reset-password?token=valid-reset-token");

    await screen.findByRole("button", { name: "Reset password" });
    await user.type(screen.getByLabelText("New password"), "short7!");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(
      await screen.findByText("Password must be at least 8 characters"),
    ).toBeInTheDocument();
  });

  it("submits the password reset, shows the success state, and clears current-session data", async () => {
    let submittedBody: unknown;

    server.use(
      http.post(resetPasswordEndpointPattern, async ({ request }) => {
        submittedBody = await request.json();

        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { queryClient, user } = renderAppRoute(
      "/reset-password?token=valid-reset-token",
    );

    queryClient.setQueryData(
      authQueryKeys.currentSession(),
      createCurrentSessionResponse(),
    );

    await screen.findByRole("heading", { name: "Reset password" });
    await user.type(
      screen.getByLabelText("New password"),
      "new-secret-password",
    );
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(
      await screen.findByRole("heading", { name: "Password updated" }),
    ).toBeInTheDocument();
    expect(submittedBody).toEqual({
      token: "valid-reset-token",
      password: "new-secret-password",
    });
    expect(
      screen.getByRole("link", { name: "Back to sign in" }),
    ).toHaveAttribute("href", "/login");

    await waitFor(() => {
      expect(
        queryClient.getQueryData(authQueryKeys.currentSession()),
      ).toBeNull();
    });
  });

  it("does not redirect authenticated visitors away from the reset page", async () => {
    const { queryClient } = renderAppRoute(
      "/reset-password?token=valid-reset-token",
    );

    queryClient.setQueryData(
      authQueryKeys.currentSession(),
      createCurrentSessionResponse(),
    );

    expect(
      await screen.findByRole("heading", { name: "Reset password" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "`apps/web` is live." }),
    ).not.toBeInTheDocument();
  });

  it("switches to the invalid-link state when the API rejects the token", async () => {
    server.use(
      http.post(resetPasswordEndpointPattern, () =>
        HttpResponse.json(
          {
            error: {
              code: "invalid_password_reset_token",
              message: "Invalid or expired password reset token",
            },
          },
          { status: 400 },
        ),
      ),
    );

    const { user } = renderAppRoute("/reset-password?token=valid-reset-token");

    await screen.findByRole("heading", { name: "Reset password" });
    await user.type(
      screen.getByLabelText("New password"),
      "new-secret-password",
    );
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(
      await screen.findByRole("heading", { name: "Invalid reset link" }),
    ).toBeInTheDocument();
  });

  it("shows the fallback network error message for request failures", async () => {
    server.use(
      http.post(resetPasswordEndpointPattern, () => HttpResponse.error()),
    );

    const { user } = renderAppRoute("/reset-password?token=valid-reset-token");

    await screen.findByRole("heading", { name: "Reset password" });
    await user.type(
      screen.getByLabelText("New password"),
      "new-secret-password",
    );
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(
      await screen.findByText(
        "The frontend could not reach the API. Make sure the backend is running and try again.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Reset password" }),
    ).toBeInTheDocument();
  });

  it("shows the generic reset failure message for API errors", async () => {
    server.use(
      http.post(resetPasswordEndpointPattern, () =>
        HttpResponse.json(
          {
            error: {
              code: "internal_server_error",
              message: "Internal server error",
            },
          },
          { status: 500 },
        ),
      ),
    );

    const { user } = renderAppRoute("/reset-password?token=valid-reset-token");

    await screen.findByRole("heading", { name: "Reset password" });
    await user.type(
      screen.getByLabelText("New password"),
      "new-secret-password",
    );
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(
      await screen.findByText("Password reset failed. Please try again."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Reset password" }),
    ).toBeInTheDocument();
  });
});
