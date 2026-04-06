import request from "supertest";
import { describe, expect, it } from "vitest";

import { createTestApp } from "../../helpers/create-app.js";

describe("HTTP integration", () => {
  it("returns health status for the starter endpoint", async () => {
    const app = createTestApp();

    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns readiness status when dependencies are ready", async () => {
    const app = createTestApp({
      checkReadiness: async () => {},
    });

    const response = await request(app).get("/api/v1/ready");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns service_not_ready when dependencies are unavailable", async () => {
    const app = createTestApp({
      checkReadiness: async () => {
        throw new Error("database unavailable");
      },
    });

    const response = await request(app).get("/api/v1/ready");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: {
        code: "service_not_ready",
        message: "Service is not ready",
      },
    });
  });

  it("returns the JSON not found envelope for unknown routes", async () => {
    const app = createTestApp();

    const response = await request(app).get("/api/v1/unknown");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "not_found",
        message: "Route not found",
      },
    });
  });

  it("normalizes malformed JSON parsing failures", async () => {
    const app = createTestApp();

    const response = await request(app)
      .post("/api/v1/unknown")
      .set("Content-Type", "application/json")
      .send('{"invalidJson":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "invalid_json",
        message: "Request body must be valid JSON",
      },
    });
  });

  it("normalizes oversized JSON bodies", async () => {
    const app = createTestApp();

    const response = await request(app)
      .post("/api/v1/unknown")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ data: "x".repeat(1_100_000) }));

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      error: {
        code: "payload_too_large",
        message: "Request body is too large",
      },
    });
  });

  it("allows configured CORS origins", async () => {
    const app = createTestApp({
      allowedOrigins: ["http://localhost:3000"],
    });

    const response = await request(app)
      .get("/api/v1/health")
      .set("Origin", "http://localhost:3000");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
  });

  it("rejects disallowed CORS origins with the shared error envelope", async () => {
    const app = createTestApp({
      allowedOrigins: ["http://localhost:3000"],
    });

    const response = await request(app)
      .get("/api/v1/health")
      .set("Origin", "http://malicious.example");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: "cors_origin_not_allowed",
        message: "CORS origin not allowed",
        details: {
          origin: "http://malicious.example",
        },
      },
    });
  });

  it("applies helmet headers to API responses", async () => {
    const app = createTestApp();

    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });
});
