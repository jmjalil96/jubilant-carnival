import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function importAuthApi() {
  return await import("@/features/auth/api");
}

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

describe("auth feature API wrappers", () => {
  it("logs in with the current session response shape", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");

    const payload = {
      email: "user@example.com",
      password: "super-secret-password",
    };
    const responseBody = createCurrentSessionResponse();
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        headers: {
          "Content-Type": "application/json",
        },
        status: 200,
      }),
    );

    vi.spyOn(globalThis, "fetch").mockImplementation(fetchSpy);

    const { login } = await importAuthApi();

    await expect(login(payload)).resolves.toEqual(responseBody);

    expect(fetchSpy).toHaveBeenCalledWith("/api/v1/auth/session", {
      body: JSON.stringify(payload),
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  });

  it("fetches the current session", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");

    const responseBody = createCurrentSessionResponse();
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        headers: {
          "Content-Type": "application/json",
        },
        status: 200,
      }),
    );

    vi.spyOn(globalThis, "fetch").mockImplementation(fetchSpy);

    const { fetchCurrentSession } = await importAuthApi();

    await expect(fetchCurrentSession()).resolves.toEqual(responseBody);

    expect(fetchSpy).toHaveBeenCalledWith("/api/v1/auth/me", {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
      method: "GET",
    });
  });

  it("logs out with a void response", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");

    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    );

    vi.spyOn(globalThis, "fetch").mockImplementation(fetchSpy);

    const { logout } = await importAuthApi();

    await expect(logout()).resolves.toBeUndefined();

    expect(fetchSpy).toHaveBeenCalledWith("/api/v1/auth/session", {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
      method: "DELETE",
    });
  });

  it("requests password reset with the expected body", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");

    const payload = {
      email: "user@example.com",
    };
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    );

    vi.spyOn(globalThis, "fetch").mockImplementation(fetchSpy);

    const { requestPasswordReset } = await importAuthApi();

    await expect(requestPasswordReset(payload)).resolves.toBeUndefined();

    expect(fetchSpy).toHaveBeenCalledWith("/api/v1/auth/password-reset", {
      body: JSON.stringify(payload),
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  });

  it("confirms password reset with the expected body", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");

    const payload = {
      token: "password-reset-token",
      password: "super-secret-password",
    };
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    );

    vi.spyOn(globalThis, "fetch").mockImplementation(fetchSpy);

    const { confirmPasswordReset } = await importAuthApi();

    await expect(confirmPasswordReset(payload)).resolves.toBeUndefined();

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/auth/password-reset/confirm",
      {
        body: JSON.stringify(payload),
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
  });

  it("propagates invalid_credentials from login unchanged", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");

    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "invalid_credentials",
            message: "Invalid email or password",
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 401,
        },
      ),
    );

    vi.spyOn(globalThis, "fetch").mockImplementation(fetchSpy);

    const { login } = await importAuthApi();

    await expect(
      login({
        email: "user@example.com",
        password: "wrong-password",
      }),
    ).rejects.toMatchObject({
      code: "invalid_credentials",
      message: "Invalid email or password",
      status: 401,
    });
  });

  it("propagates authentication_required from current session unchanged", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");

    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "authentication_required",
            message: "Authentication required",
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 401,
        },
      ),
    );

    vi.spyOn(globalThis, "fetch").mockImplementation(fetchSpy);

    const { fetchCurrentSession } = await importAuthApi();

    await expect(fetchCurrentSession()).rejects.toMatchObject({
      code: "authentication_required",
      message: "Authentication required",
      status: 401,
    });
  });
});
