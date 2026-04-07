import { afterEach, describe, expect, it, vi } from "vitest";

import { createDatabaseClient } from "../../../src/infra/db.js";

const activePools = new Set<ReturnType<typeof createDatabaseClient>["pool"]>();

afterEach(async () => {
  await Promise.all(
    [...activePools].map(async (pool) => {
      await pool.end();
    }),
  );
  activePools.clear();
});

describe("createDatabaseClient", () => {
  it("registers the optional pool error handler", () => {
    const onError = vi.fn();
    const { pool } = createDatabaseClient({
      connectionString:
        "postgresql://postgres:postgres@127.0.0.1:65535/jubilant_carnival_test",
      onError,
    });
    activePools.add(pool);
    const error = new Error("idle client disconnected");

    expect(() => {
      pool.emit("error", error);
    }).not.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error);
  });
});
