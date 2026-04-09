import { screen, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { createQueryClient } from "@/app/query-client";
import { authQueryKeys } from "@/features/auth/queries";

import { renderAppRoute } from "../helpers/render-router";
import { server } from "../setup/server";

const currentSessionEndpointPattern = /\/api\/v1\/auth\/me(?:\?.*)?$/;
const loginEndpointPattern = /\/api\/v1\/auth\/session(?:\?.*)?$/;

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

describe("/login route integration", () => {
  it("renders the dedicated login page", async () => {
    server.use(unauthenticatedCurrentSessionHandler());

    renderAppRoute("/login");

    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Forgot password?" }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("shows client validation messages for an empty submit", async () => {
    server.use(unauthenticatedCurrentSessionHandler());

    const { user } = renderAppRoute("/login");

    await screen.findByRole("button", { name: "Sign in" });
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
  });

  it("logs in successfully, populates the current session query, and navigates home", async () => {
    let isAuthenticated = false;
    let submittedBody: unknown;
    const currentSessionResponse = createCurrentSessionResponse();

    server.use(
      http.get(currentSessionEndpointPattern, () => {
        if (isAuthenticated) {
          return HttpResponse.json(currentSessionResponse);
        }

        return HttpResponse.json(
          {
            error: {
              code: "authentication_required",
              message: "Authentication required",
            },
          },
          { status: 401 },
        );
      }),
      http.post(loginEndpointPattern, async ({ request }) => {
        submittedBody = await request.json();
        isAuthenticated = true;

        return HttpResponse.json(currentSessionResponse);
      }),
    );

    const { queryClient, user } = renderAppRoute("/login");

    await screen.findByRole("heading", { name: "Sign in" });
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "super-secret-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByRole("heading", { name: "`apps/web` is live." }),
    ).toBeInTheDocument();
    expect(submittedBody).toEqual({
      email: "user@example.com",
      password: "super-secret-password",
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(authQueryKeys.currentSession())).toEqual(
        currentSessionResponse,
      );
    });
  });

  it("redirects authenticated visitors from /login to /", async () => {
    server.use(
      http.get(currentSessionEndpointPattern, () =>
        HttpResponse.json(createCurrentSessionResponse()),
      ),
    );

    renderAppRoute("/login");

    expect(
      await screen.findByRole("heading", { name: "`apps/web` is live." }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sign in" }),
    ).not.toBeInTheDocument();
  });

  it("waits for cached authenticated state to revalidate before deciding not to redirect", async () => {
    const queryClient = createQueryClient();

    queryClient.setQueryData(
      authQueryKeys.currentSession(),
      createCurrentSessionResponse(),
    );

    server.use(
      http.get(currentSessionEndpointPattern, async () => {
        await delay(150);

        return HttpResponse.json(
          {
            error: {
              code: "authentication_required",
              message: "Authentication required",
            },
          },
          { status: 401 },
        );
      }),
    );

    renderAppRoute("/login", { queryClient });

    expect(
      screen.getByRole("heading", { name: "Preparing access" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Sign in" }),
    ).not.toBeInTheDocument();

    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "`apps/web` is live." }),
    ).not.toBeInTheDocument();
  });

  it("keeps /login usable when cached authenticated state fails revalidation", async () => {
    const queryClient = createQueryClient();

    queryClient.setQueryData(
      authQueryKeys.currentSession(),
      createCurrentSessionResponse(),
    );

    server.use(
      http.get(currentSessionEndpointPattern, async () => {
        await delay(150);

        return HttpResponse.json(
          {
            error: {
              code: "internal_server_error",
              message: "Internal server error",
            },
          },
          { status: 500 },
        );
      }),
    );

    renderAppRoute("/login", { queryClient });

    expect(
      screen.getByRole("heading", { name: "Preparing access" }),
    ).toBeInTheDocument();

    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("internal_server_error: Internal server error"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "`apps/web` is live." }),
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
    "keeps /login usable when the current-session probe fails with $label",
    async ({ handler, expectedMessage }) => {
      server.use(handler);

      renderAppRoute("/login");

      expect(
        await screen.findByRole("heading", { name: "Sign in" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
      expect(await screen.findByText(expectedMessage)).toBeInTheDocument();
      expect(
        screen.queryByText("Something went wrong."),
      ).not.toBeInTheDocument();
    },
  );

  it.each([
    {
      error: {
        code: "invalid_credentials",
        message: "Invalid email or password",
      },
      status: 401,
      expectedMessage: "Invalid email or password",
    },
    {
      error: {
        code: "email_not_verified",
        message: "Email address is not verified",
      },
      status: 403,
      expectedMessage: "Email address is not verified",
    },
    {
      error: {
        code: "password_reset_required",
        message: "Password reset is required",
      },
      status: 403,
      expectedMessage: "Password reset is required",
    },
  ])(
    "shows the server auth error for $error.code and stays on /login",
    async ({ error, status, expectedMessage }) => {
      server.use(
        unauthenticatedCurrentSessionHandler(),
        http.post(loginEndpointPattern, () =>
          HttpResponse.json({ error }, { status }),
        ),
      );

      const { user } = renderAppRoute("/login");

      await screen.findByRole("heading", { name: "Sign in" });
      await user.type(screen.getByLabelText("Email"), "user@example.com");
      await user.type(screen.getByLabelText("Password"), "wrong-password");
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      expect(await screen.findByText(expectedMessage)).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Sign in" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "`apps/web` is live." }),
      ).not.toBeInTheDocument();
    },
  );

  it("shows the fallback network error message for request failures", async () => {
    server.use(
      unauthenticatedCurrentSessionHandler(),
      http.post(loginEndpointPattern, () => HttpResponse.error()),
    );

    const { user } = renderAppRoute("/login");

    await screen.findByRole("heading", { name: "Sign in" });
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText(
        "The frontend could not reach the API. Make sure the backend is running and try again.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the Login link in the shared shell navigation", async () => {
    renderAppRoute("/");

    expect(await screen.findByRole("link", { name: "Login" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
