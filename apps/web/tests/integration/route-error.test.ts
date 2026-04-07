import { describe, expect, it } from "vitest";

import { normalizeRouteError } from "@/routes/root/route-error";

describe("normalizeRouteError", () => {
  it("normalizes route-response errors", () => {
    expect(
      normalizeRouteError({
        data: undefined,
        internal: false,
        status: 404,
        statusText: "Not Found",
      }),
    ).toEqual({
      description: "The requested page could not be found.",
      eyebrow: "Route Error",
      title: "404 Not Found",
    });
  });

  it("normalizes Error instances", () => {
    expect(normalizeRouteError(new Error("Route exploded"))).toEqual({
      description: "Route exploded",
      eyebrow: "Application Error",
      title: "Something went wrong.",
    });
  });

  it("normalizes unknown thrown values", () => {
    expect(normalizeRouteError("unknown")).toEqual({
      description: "The route crashed before it could finish rendering.",
      eyebrow: "Application Error",
      title: "Something went wrong.",
    });
  });
});
