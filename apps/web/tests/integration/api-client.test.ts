import { AUTHENTICATION_REQUIRED_ERROR_CODE } from "@jubilant-carnival/contracts/errors";
import { systemStatusSchema } from "@jubilant-carnival/contracts/system";
import { http, HttpResponse } from "msw";
import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createApiErrorEnvelope,
  createServiceNotReadyErrorEnvelope,
} from "../helpers/api-fixtures";
import {
  healthEndpointPattern,
  readinessEndpointPattern,
} from "../setup/handlers";
import { server } from "../setup/server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function importApiClient() {
  return await import("@/lib/api/client");
}

describe("API client normalization", () => {
  it("normalizes API envelope failures into ApiError", async () => {
    const { requestJson } = await importApiClient();

    server.use(
      http.get(readinessEndpointPattern, () =>
        HttpResponse.json(createServiceNotReadyErrorEnvelope(), {
          status: 503,
        }),
      ),
    );

    await expect(
      requestJson({
        path: "/ready",
        schema: systemStatusSchema,
      }),
    ).rejects.toMatchObject({
      code: "service_not_ready",
      message: "Service is not ready",
      status: 503,
    });
  });

  it("normalizes malformed JSON payloads", async () => {
    const { requestJson } = await importApiClient();

    server.use(
      http.get(
        healthEndpointPattern,
        () =>
          new HttpResponse('{"status":', {
            headers: {
              "Content-Type": "application/json",
            },
            status: 200,
          }),
      ),
    );

    await expect(
      requestJson({
        path: "/health",
        schema: systemStatusSchema,
      }),
    ).rejects.toMatchObject({
      code: "invalid_api_response",
      message: "API returned malformed JSON",
      status: 200,
    });
  });

  it("normalizes unexpected success payload shapes", async () => {
    const { requestJson } = await importApiClient();

    server.use(
      http.get(healthEndpointPattern, () =>
        HttpResponse.json({
          status: "degraded",
        }),
      ),
    );

    await expect(
      requestJson({
        path: "/health",
        schema: systemStatusSchema,
      }),
    ).rejects.toMatchObject({
      code: "invalid_api_response",
      message: "API returned an unexpected response shape",
      status: 200,
    });
  });

  it("normalizes network failures", async () => {
    const { requestJson } = await importApiClient();

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline"));

    await expect(
      requestJson({
        path: "/health",
        schema: systemStatusSchema,
      }),
    ).rejects.toMatchObject({
      code: "network_error",
      message: "Could not reach the API",
      status: 0,
    });
  });

  it("builds requests correctly from a root-relative API base URL", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1/");

    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        headers: {
          "Content-Type": "application/json",
        },
        status: 200,
      }),
    );

    vi.spyOn(globalThis, "fetch").mockImplementation(fetchSpy);

    const { requestJson } = await importApiClient();

    await expect(
      requestJson({
        path: "/health",
        schema: systemStatusSchema,
      }),
    ).resolves.toEqual({ status: "ok" });

    expect(fetchSpy).toHaveBeenCalledWith("/api/v1/health", {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
      method: "GET",
    });
  });

  it("builds requests correctly from an absolute API base URL", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://localhost:3001/api/v1/");

    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        headers: {
          "Content-Type": "application/json",
        },
        status: 200,
      }),
    );

    vi.spyOn(globalThis, "fetch").mockImplementation(fetchSpy);

    const { requestJson } = await importApiClient();

    await expect(
      requestJson({
        path: "/health",
        schema: systemStatusSchema,
      }),
    ).resolves.toEqual({ status: "ok" });

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/health",
      {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
        method: "GET",
      },
    );
  });

  it("serializes JSON bodies for requestJson", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");

    const payload = {
      email: "person@example.com",
      password: "super-secret-password",
    };
    const responseSchema = z.object({
      session: z.object({
        expiresAt: z.string(),
      }),
    });
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          session: {
            expiresAt: "2026-05-01T00:00:00.000Z",
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        },
      ),
    );

    vi.spyOn(globalThis, "fetch").mockImplementation(fetchSpy);

    const { requestJson } = await importApiClient();

    await expect(
      requestJson({
        path: "/auth/session",
        schema: responseSchema,
        method: "POST",
        body: payload,
      }),
    ).resolves.toEqual({
      session: {
        expiresAt: "2026-05-01T00:00:00.000Z",
      },
    });

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

  it("returns undefined for requestVoid on 204 responses", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");

    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    );

    vi.spyOn(globalThis, "fetch").mockImplementation(fetchSpy);

    const { requestVoid } = await importApiClient();

    await expect(
      requestVoid({
        path: "/auth/session",
        method: "DELETE",
      }),
    ).resolves.toBeUndefined();

    expect(fetchSpy).toHaveBeenCalledWith("/api/v1/auth/session", {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
      method: "DELETE",
    });
  });

  it("normalizes API envelope failures for requestVoid", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");

    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(
          createApiErrorEnvelope({
            code: AUTHENTICATION_REQUIRED_ERROR_CODE,
            message: "Authentication required",
          }),
        ),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 401,
        },
      ),
    );

    vi.spyOn(globalThis, "fetch").mockImplementation(fetchSpy);

    const { requestVoid } = await importApiClient();

    await expect(
      requestVoid({
        path: "/auth/session",
        method: "DELETE",
      }),
    ).rejects.toMatchObject({
      code: AUTHENTICATION_REQUIRED_ERROR_CODE,
      message: "Authentication required",
      status: 401,
    });
  });
});
