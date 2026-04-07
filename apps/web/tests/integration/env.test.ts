import { describe, expect, it } from "vitest";

import { parseBrowserEnv } from "@/lib/env";

describe("browser env parsing", () => {
  it("accepts a root-relative API base URL", () => {
    expect(
      parseBrowserEnv({
        VITE_API_BASE_URL: "/api/v1",
      }),
    ).toEqual({
      VITE_API_BASE_URL: "/api/v1",
    });
  });

  it("accepts an absolute API base URL", () => {
    expect(
      parseBrowserEnv({
        VITE_API_BASE_URL: "https://example.com/api/v1",
      }),
    ).toEqual({
      VITE_API_BASE_URL: "https://example.com/api/v1",
    });
  });

  it("rejects a bare relative API base URL", () => {
    expect(() =>
      parseBrowserEnv({
        VITE_API_BASE_URL: "api/v1",
      }),
    ).toThrow(
      "VITE_API_BASE_URL must be root-relative like '/api/v1' or an absolute http(s) URL",
    );
  });
});
