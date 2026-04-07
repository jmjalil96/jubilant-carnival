import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "../../../src/infra/db.js";
import { userPasswords } from "../../../src/infra/schema.js";
import { AUTH_SESSION_COOKIE_NAME } from "../../../src/modules/auth/shared/session.js";
import { createTestApp } from "../../helpers/create-app.js";
import {
  createSessionFixture,
  seedLoginUserFixture,
} from "../../helpers/auth-fixtures.js";
import { runDatabaseMigrations } from "../../helpers/database-migrations.js";
import {
  startPostgresContainer,
  type StartedPostgresContainer,
} from "../../helpers/postgres-container.js";

const VALID_SESSION_CREATED_AT = new Date("2026-05-01T00:00:00.000Z");
const VALID_SESSION_EXPIRES_AT = new Date("2026-06-01T00:00:00.000Z");

function createCookieHeader(sessionToken: string): string {
  return `${AUTH_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`;
}

describe("GET /api/v1/auth/me", () => {
  let databaseContainer: StartedPostgresContainer | undefined;
  let databaseClient: ReturnType<typeof createDatabaseClient> | undefined;

  beforeAll(async () => {
    databaseContainer = await startPostgresContainer();

    const migrationResult = await runDatabaseMigrations(
      databaseContainer.connectionString,
    );

    expect(migrationResult.code).toBe(0);

    databaseClient = createDatabaseClient({
      connectionString: databaseContainer.connectionString,
    });
  });

  afterAll(async () => {
    if (databaseClient !== undefined) {
      await databaseClient.pool.end();
    }

    if (databaseContainer !== undefined) {
      await databaseContainer.container.stop();
    }
  });

  it("returns the current session payload for a valid cookie", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
      roleKeys: ["client_admin", "affiliate"],
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "me-valid-session-token",
      createdAt: VALID_SESSION_CREATED_AT,
      expiresAt: VALID_SESSION_EXPIRES_AT,
    });
    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", createCookieHeader(session.sessionToken));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      actor: {
        user: {
          id: fixture.userId,
          email: fixture.email,
          displayName: "Test User",
        },
        tenant: {
          id: fixture.tenantId,
          slug: expect.any(String),
          name: "Test Tenant",
        },
        roleKeys: ["affiliate", "client_admin"],
      },
      session: {
        expiresAt: VALID_SESSION_EXPIRES_AT.toISOString(),
      },
    });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers.vary).toContain("Cookie");
  });

  it("returns authentication_required when the cookie is missing", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    const response = await request(app).get("/api/v1/auth/me");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "authentication_required",
        message: "Authentication required",
      },
    });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers.vary).toContain("Cookie");
  });

  it("returns authentication_required for an unknown session", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", createCookieHeader("missing-session-token"));

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "authentication_required",
        message: "Authentication required",
      },
    });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers.vary).toContain("Cookie");
  });

  it("returns authentication_required for a revoked session", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "me-revoked-session-token",
      createdAt: VALID_SESSION_CREATED_AT,
      expiresAt: VALID_SESSION_EXPIRES_AT,
      revokedAt: new Date("2026-05-10T00:00:00.000Z"),
    });
    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", createCookieHeader(session.sessionToken));

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "authentication_required",
        message: "Authentication required",
      },
    });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers.vary).toContain("Cookie");
  });

  it("returns authentication_required for a stale session after password update", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "me-stale-session-token",
      createdAt: VALID_SESSION_CREATED_AT,
      expiresAt: VALID_SESSION_EXPIRES_AT,
    });
    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    await db!
      .update(userPasswords)
      .set({
        passwordUpdatedAt: new Date("2026-05-20T00:00:00.000Z"),
      })
      .where(eq(userPasswords.userId, fixture.userId));

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", createCookieHeader(session.sessionToken));

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "authentication_required",
        message: "Authentication required",
      },
    });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers.vary).toContain("Cookie");
  });
});
