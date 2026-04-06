import { afterEach, describe, expect, it } from "vitest";

import {
  type BootstrapChildProcess,
  openIncompleteHttpConnection,
  startBootstrapProcess,
  stopProcess,
  waitForProcessExit,
} from "../../helpers/process.js";
import { waitForHttp } from "../../helpers/wait-for-http.js";

const activeChildren = new Set<BootstrapChildProcess>();

afterEach(async () => {
  await Promise.all(
    [...activeChildren].map(async (child) => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
        await waitForProcessExit(child, 2_000).catch(() => {});
      }
    }),
  );
  activeChildren.clear();
});

describe("bootstrap process integration", () => {
  it("boots successfully and serves the health endpoint", async () => {
    const process = await startBootstrapProcess();
    activeChildren.add(process.child);

    await waitForHttp(`${process.url}/api/v1/health`);

    const response = await fetch(`${process.url}/api/v1/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });

    const exit = await stopProcess(process.child, "SIGTERM");

    expect(exit.code).toBe(0);
    expect(process.getOutput()).toContain("API server listening");
  });

  it.each([
    {
      field: "DATABASE_URL",
      overrides: {
        DATABASE_URL: "mysql://localhost:5432/not-postgres",
      },
    },
    {
      field: "CORS_ORIGINS",
      overrides: {
        CORS_ORIGINS: "",
      },
    },
    {
      field: "LOG_LEVEL",
      overrides: {
        LOG_LEVEL: "verbose",
      },
    },
    {
      field: "SHUTDOWN_TIMEOUT_MS",
      overrides: {
        SHUTDOWN_TIMEOUT_MS: "0",
      },
    },
  ])(
    "fails fast before listening when $field is invalid",
    async ({ field, overrides }) => {
      const process = await startBootstrapProcess({
        env: overrides,
      });
      activeChildren.add(process.child);

      const exit = await waitForProcessExit(process.child, 5_000);

      expect(exit.code).not.toBe(0);
      expect(process.getOutput()).toContain(field);
    },
  );

  it("shuts down cleanly on SIGINT", async () => {
    const process = await startBootstrapProcess();
    activeChildren.add(process.child);

    await waitForHttp(`${process.url}/api/v1/health`);

    const exit = await stopProcess(process.child, "SIGINT");

    expect(exit.code).toBe(0);
    expect(process.getOutput()).toContain("Shutting down API server");
  });

  it("shuts down cleanly on SIGTERM", async () => {
    const process = await startBootstrapProcess();
    activeChildren.add(process.child);

    await waitForHttp(`${process.url}/api/v1/health`);

    const exit = await stopProcess(process.child, "SIGTERM");

    expect(exit.code).toBe(0);
    expect(process.getOutput()).toContain("Shutting down API server");
  });

  it("forces shutdown when active connections prevent graceful close", async () => {
    const process = await startBootstrapProcess({
      env: {
        SHUTDOWN_TIMEOUT_MS: "500",
      },
    });
    activeChildren.add(process.child);

    await waitForHttp(`${process.url}/api/v1/health`);

    const socket = await openIncompleteHttpConnection(process.port);

    try {
      const exit = await stopProcess(process.child, "SIGTERM", 5_000);

      expect(exit.code).toBe(1);
      expect(process.getOutput()).toContain("Forced shutdown after timeout");
    } finally {
      socket.destroy();
    }
  });
});
