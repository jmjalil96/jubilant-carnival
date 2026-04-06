import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "../../../src/infra/db.js";
import { createDatabaseReadinessCheck } from "../../../src/modules/system/readiness.js";
import { createTestApp } from "../../helpers/create-app.js";
import {
  startPostgresContainer,
  type StartedPostgresContainer,
} from "../../helpers/postgres-container.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(currentDir, "../../..");

async function runDatabaseMigrations(
  connectionString: string,
): Promise<{ code: number | null; output: string }> {
  const child = spawn("pnpm", ["db:migrate"], {
    cwd: apiDir,
    env: {
      ...process.env,
      DATABASE_URL: connectionString,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";

  child.stdout.on("data", (chunk: Buffer | string) => {
    output += chunk.toString();
  });

  child.stderr.on("data", (chunk: Buffer | string) => {
    output += chunk.toString();
  });

  const code = await new Promise<number | null>((resolveCode) => {
    child.once("exit", (exitCode) => {
      resolveCode(exitCode);
    });
  });

  return { code, output };
}

describe("database-backed readiness", () => {
  let databaseUrl = "";
  let databaseContainer: StartedPostgresContainer | undefined;
  let pool: ReturnType<typeof createDatabaseClient>["pool"] | undefined;

  beforeAll(async () => {
    databaseContainer = await startPostgresContainer();
    databaseUrl = databaseContainer.connectionString;
  });

  afterAll(async () => {
    if (pool !== undefined) {
      await pool.end();
    }

    if (databaseContainer !== undefined) {
      await databaseContainer.container.stop();
    }
  });

  it("keeps health green and upgrades readiness after migrations", async () => {
    const databaseClient = createDatabaseClient({
      connectionString: databaseUrl,
    });
    pool = databaseClient.pool;
    const app = createTestApp({
      checkReadiness: createDatabaseReadinessCheck(databaseClient.db),
    });

    const healthBefore = await request(app).get("/api/v1/health");
    const readyBefore = await request(app).get("/api/v1/ready");

    expect(healthBefore.status).toBe(200);
    expect(healthBefore.body).toEqual({ status: "ok" });
    expect(readyBefore.status).toBe(503);
    expect(readyBefore.body).toEqual({
      error: {
        code: "service_not_ready",
        message: "Service is not ready",
      },
    });

    const migrationResult = await runDatabaseMigrations(databaseUrl);

    expect(migrationResult.code).toBe(0);

    const readyAfter = await request(app).get("/api/v1/ready");
    const healthAfter = await request(app).get("/api/v1/health");

    expect(readyAfter.status).toBe(200);
    expect(readyAfter.body).toEqual({ status: "ok" });
    expect(healthAfter.status).toBe(200);
    expect(healthAfter.body).toEqual({ status: "ok" });
  });
});
