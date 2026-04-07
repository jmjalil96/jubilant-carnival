import { http, HttpResponse } from "msw";
import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  healthEndpointPattern,
  readinessEndpointPattern,
} from "../setup/handlers";
import { server } from "../setup/server";

const statusSchema = z.object({
  status: z.literal("ok"),
});

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
        HttpResponse.json(
          {
            error: {
              code: "service_not_ready",
              message: "Service is not ready",
            },
          },
          { status: 503 },
        ),
      ),
    );

    await expect(
      requestJson({
        path: "/ready",
        schema: statusSchema,
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
        schema: statusSchema,
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
        schema: statusSchema,
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
        schema: statusSchema,
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
        schema: statusSchema,
      }),
    ).resolves.toEqual({ status: "ok" });

    expect(fetchSpy).toHaveBeenCalledWith("/api/v1/health", {
      headers: {
        Accept: "application/json",
      },
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
        schema: statusSchema,
      }),
    ).resolves.toEqual({ status: "ok" });

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/health",
      {
        headers: {
          Accept: "application/json",
        },
      },
    );
  });
});
