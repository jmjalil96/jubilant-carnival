import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

import { server } from "./server";

const NativeRequest = globalThis.Request;

class RequestWithCompatibleSignal extends NativeRequest {
  constructor(
    input: ConstructorParameters<typeof NativeRequest>[0],
    init?: ConstructorParameters<typeof NativeRequest>[1],
  ) {
    try {
      super(input, init);
    } catch (error) {
      if (
        error instanceof TypeError &&
        init?.signal !== undefined &&
        error.message.includes('Expected signal ("AbortSignal {}")')
      ) {
        const requestInit = { ...init };

        delete requestInit.signal;

        super(input, requestInit);
        return;
      }

      throw error;
    }
  }
}

globalThis.Request = RequestWithCompatibleSignal as typeof Request;

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
});

afterAll(() => {
  server.close();
});
