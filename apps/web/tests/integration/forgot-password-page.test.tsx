import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { renderAppRoute } from "../helpers/render-router";
import { server } from "../setup/server";

const currentSessionEndpointPattern = /\/api\/v1\/auth\/me(?:\?.*)?$/;
const forgotPasswordEndpointPattern =
  /\/api\/v1\/auth\/password-reset(?:\?.*)?$/;

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
      expiresAt: "2099-05-01T00:00:00.000Z",
    },
  };
}

function unauthenticatedCurrentSessionHandler() {
  return http.get(currentSessionEndpointPattern, () =>
    HttpResponse.json(
      {
        error: {
          code: "authentication_required",
          message: "Authentication required",
        },
      },
      { status: 401 },
    ),
  );
}

describe("/forgot-password route integration", () => {
  it("renders the forgot-password page", async () => {
    server.use(unauthenticatedCurrentSessionHandler());

    renderAppRoute("/forgot-password");

    expect(
      await screen.findByRole("heading", { name: "Forgot password" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send reset link" }),
    ).toBeInTheDocument();
  });

  it("shows client validation messages for an empty submit", async () => {
    server.use(unauthenticatedCurrentSessionHandler());

    const { user } = renderAppRoute("/forgot-password");

    await screen.findByRole("button", { name: "Send reset link" });
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText("Email is required")).toBeInTheDocument();
  });

  it("submits the password-reset request and shows the generic confirmation state", async () => {
    let submittedBody: unknown;

    server.use(
      unauthenticatedCurrentSessionHandler(),
      http.post(forgotPasswordEndpointPattern, async ({ request }) => {
        submittedBody = await request.json();

        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { user } = renderAppRoute("/forgot-password");

    await screen.findByRole("heading", { name: "Forgot password" });
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(
      await screen.findByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "If an account exists for the email you entered, we’ve sent a password reset link.",
      ),
    ).toBeInTheDocument();
    expect(submittedBody).toEqual({
      email: "user@example.com",
    });
    expect(
      screen.getByRole("link", { name: "Back to sign in" }),
    ).toHaveAttribute("href", "/login");
  });

  it("redirects authenticated visitors from /forgot-password to /", async () => {
    server.use(
      http.get(currentSessionEndpointPattern, () =>
        HttpResponse.json(createCurrentSessionResponse()),
      ),
    );

    renderAppRoute("/forgot-password");

    expect(
      await screen.findByRole("heading", { name: "`apps/web` is live." }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send reset link" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    {
      label: "server error",
      handler: http.get(currentSessionEndpointPattern, () =>
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
      expectedMessage: "internal_server_error: Internal server error",
    },
    {
      label: "network error",
      handler: http.get(currentSessionEndpointPattern, () =>
        HttpResponse.error(),
      ),
      expectedMessage:
        "The frontend could not reach the API. Make sure the backend is running and try again.",
    },
  ])(
    "keeps /forgot-password usable when the current-session probe fails with $label",
    async ({ handler, expectedMessage }) => {
      server.use(handler);

      renderAppRoute("/forgot-password");

      expect(
        await screen.findByRole("heading", { name: "Forgot password" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(await screen.findByText(expectedMessage)).toBeInTheDocument();
      expect(
        screen.queryByText("Something went wrong."),
      ).not.toBeInTheDocument();
    },
  );

  it("shows the fallback network error message for request failures", async () => {
    server.use(
      unauthenticatedCurrentSessionHandler(),
      http.post(forgotPasswordEndpointPattern, () => HttpResponse.error()),
    );

    const { user } = renderAppRoute("/forgot-password");

    await screen.findByRole("heading", { name: "Forgot password" });
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(
      await screen.findByText(
        "The frontend could not reach the API. Make sure the backend is running and try again.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the generic request failure message for API errors", async () => {
    server.use(
      unauthenticatedCurrentSessionHandler(),
      http.post(forgotPasswordEndpointPattern, () =>
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

    const { user } = renderAppRoute("/forgot-password");

    await screen.findByRole("heading", { name: "Forgot password" });
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(
      await screen.findByText(
        "Password reset request failed. Please try again.",
      ),
    ).toBeInTheDocument();
  });

  it("returns to the form when the user chooses a different email", async () => {
    server.use(
      unauthenticatedCurrentSessionHandler(),
      http.post(
        forgotPasswordEndpointPattern,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    const { user } = renderAppRoute("/forgot-password");

    await screen.findByRole("heading", { name: "Forgot password" });
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(
      await screen.findByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Use a different email" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Forgot password" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send reset link" }),
    ).toBeInTheDocument();
  });
});
