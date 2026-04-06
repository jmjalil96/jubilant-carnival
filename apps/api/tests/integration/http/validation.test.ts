import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { errorHandler } from "../../../src/http/error-handler.js";
import { validatedRoute } from "../../../src/http/validation.js";

function createValidationApp() {
  const app = express();

  app.use(express.json());

  app.post(
    "/validate/:id",
    validatedRoute(
      {
        params: z.object({
          id: z.coerce.number().int().positive(),
        }),
        query: z.object({
          active: z
            .enum(["true", "false"])
            .transform((value) => value === "true"),
        }),
        body: z.object({
          count: z.coerce.number().int().positive(),
          name: z.string().min(1),
        }),
      },
      ({ body, params, query, res }) => {
        res.status(200).json({
          body,
          params,
          query,
        });
      },
    ),
  );

  app.use(errorHandler);

  return app;
}

describe("validatedRoute integration", () => {
  it("parses params, query, and body into typed values", async () => {
    const app = createValidationApp();

    const response = await request(app).post("/validate/42?active=true").send({
      count: "5",
      name: "starter",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      body: {
        count: 5,
        name: "starter",
      },
      params: {
        id: 42,
      },
      query: {
        active: true,
      },
    });
  });

  it("returns validation_error for invalid params", async () => {
    const app = createValidationApp();

    const response = await request(app)
      .post("/validate/not-a-number?active=true")
      .send({
        count: 5,
        name: "starter",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("validation_error");
    expect(response.body.error.message).toBe("Request validation failed");
    expect(response.body.error.details.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["id"],
        }),
      ]),
    );
  });

  it("returns validation_error for invalid query values", async () => {
    const app = createValidationApp();

    const response = await request(app).post("/validate/42?active=maybe").send({
      count: 5,
      name: "starter",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("validation_error");
    expect(response.body.error.details.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["active"],
        }),
      ]),
    );
  });

  it("returns validation_error for invalid body values", async () => {
    const app = createValidationApp();

    const response = await request(app).post("/validate/42?active=true").send({
      count: 0,
      name: "",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("validation_error");
    expect(response.body.error.details.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["count"],
        }),
        expect.objectContaining({
          path: ["name"],
        }),
      ]),
    );
  });
});
