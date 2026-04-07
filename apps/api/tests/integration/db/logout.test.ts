import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "../../../src/infra/db.js";
import { sessions, userPasswords } from "../../../src/infra/schema.js";
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
const ORIGINAL_REVOKED_AT = new Date("2026-05-10T00:00:00.000Z");
const PENDING_REQUEST_TIMEOUT_MS = 300;

function createCookieHeader(sessionToken: string): string {
  return `${AUTH_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`;
}

function findSessionCookieHeader(
  setCookieHeader: string[] | string | undefined,
): string | undefined {
  const cookieHeaders =
    setCookieHeader === undefined
      ? []
      : Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [setCookieHeader];

  return cookieHeaders.find((value) =>
    value.startsWith(`${AUTH_SESSION_COOKIE_NAME}=`),
  );
}

function expectClearedSessionCookie(
  setCookieHeader: string[] | string | undefined,
) {
  const sessionCookieHeader = findSessionCookieHeader(setCookieHeader);

  expect(sessionCookieHeader).toBeDefined();
  expect(sessionCookieHeader).toContain(`${AUTH_SESSION_COOKIE_NAME}=`);
  expect(sessionCookieHeader).toContain("HttpOnly");
  expect(sessionCookieHeader).toContain("Path=/api");
  expect(sessionCookieHeader).toContain("SameSite=Lax");
  expect(sessionCookieHeader).toContain("Expires=");
  expect(sessionCookieHeader).not.toContain("Secure");
}

describe("DELETE /api/v1/auth/session", () => {
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

  it("revokes the current session, clears the cookie, and returns 204", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "logout-valid-session-token",
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
      .delete("/api/v1/auth/session")
      .set("Cookie", createCookieHeader(session.sessionToken));

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expectClearedSessionCookie(response.headers["set-cookie"]);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers.vary).toContain("Cookie");

    const [storedSession] = await db!
      .select({
        revokedAt: sessions.revokedAt,
      })
      .from(sessions)
      .where(eq(sessions.id, session.sessionId))
      .limit(1);

    expect(storedSession?.revokedAt).not.toBeNull();
  });

  it("returns 204 and clears the cookie when the cookie is missing", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    const response = await request(app).delete("/api/v1/auth/session");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expectClearedSessionCookie(response.headers["set-cookie"]);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers.vary).toContain("Cookie");
  });

  it("returns 204 and clears the cookie when the cookie is malformed", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    const response = await request(app)
      .delete("/api/v1/auth/session")
      .set("Cookie", `${AUTH_SESSION_COOKIE_NAME}=%E0%A4%A`);

    expect(response.status).toBe(204);
    expectClearedSessionCookie(response.headers["set-cookie"]);
  });

  it("returns 204 and clears the cookie for an unknown session", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    const response = await request(app)
      .delete("/api/v1/auth/session")
      .set("Cookie", createCookieHeader("missing-session-token"));

    expect(response.status).toBe(204);
    expectClearedSessionCookie(response.headers["set-cookie"]);
  });

  it("returns 204 for an already revoked session without changing it again", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "logout-already-revoked-session-token",
      createdAt: VALID_SESSION_CREATED_AT,
      expiresAt: VALID_SESSION_EXPIRES_AT,
      revokedAt: ORIGINAL_REVOKED_AT,
    });
    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    const response = await request(app)
      .delete("/api/v1/auth/session")
      .set("Cookie", createCookieHeader(session.sessionToken));

    expect(response.status).toBe(204);
    expectClearedSessionCookie(response.headers["set-cookie"]);

    const [storedSession] = await db!
      .select({
        revokedAt: sessions.revokedAt,
      })
      .from(sessions)
      .where(eq(sessions.id, session.sessionId))
      .limit(1);

    expect(storedSession?.revokedAt?.toISOString()).toBe(
      ORIGINAL_REVOKED_AT.toISOString(),
    );
  });

  it("returns 204 and revokes an expired session", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "logout-expired-session-token",
      createdAt: VALID_SESSION_CREATED_AT,
      expiresAt: new Date("2026-05-10T00:00:00.000Z"),
    });
    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    const response = await request(app)
      .delete("/api/v1/auth/session")
      .set("Cookie", createCookieHeader(session.sessionToken));

    expect(response.status).toBe(204);
    expectClearedSessionCookie(response.headers["set-cookie"]);

    const [storedSession] = await db!
      .select({
        revokedAt: sessions.revokedAt,
      })
      .from(sessions)
      .where(eq(sessions.id, session.sessionId))
      .limit(1);

    expect(storedSession?.revokedAt).not.toBeNull();
  });

  it("returns 204 and revokes a stale session after password update", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "logout-stale-session-token",
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
      .delete("/api/v1/auth/session")
      .set("Cookie", createCookieHeader(session.sessionToken));

    expect(response.status).toBe(204);
    expectClearedSessionCookie(response.headers["set-cookie"]);

    const [storedSession] = await db!
      .select({
        revokedAt: sessions.revokedAt,
      })
      .from(sessions)
      .where(eq(sessions.id, session.sessionId))
      .limit(1);

    expect(storedSession?.revokedAt).not.toBeNull();
  });

  it("revokes only the current session when multiple sessions exist for the same user", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
    });
    const currentSession = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "logout-current-session-token",
      createdAt: VALID_SESSION_CREATED_AT,
      expiresAt: VALID_SESSION_EXPIRES_AT,
    });
    const siblingSession = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "logout-sibling-session-token",
      createdAt: new Date("2026-05-02T00:00:00.000Z"),
      expiresAt: VALID_SESSION_EXPIRES_AT,
    });
    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    const response = await request(app)
      .delete("/api/v1/auth/session")
      .set("Cookie", createCookieHeader(currentSession.sessionToken));

    expect(response.status).toBe(204);
    expectClearedSessionCookie(response.headers["set-cookie"]);

    const sessionRows = await db!
      .select({
        id: sessions.id,
        revokedAt: sessions.revokedAt,
      })
      .from(sessions)
      .where(eq(sessions.userId, fixture.userId));

    const currentSessionRow = sessionRows.find(
      (row) => row.id === currentSession.sessionId,
    );
    const siblingSessionRow = sessionRows.find(
      (row) => row.id === siblingSession.sessionId,
    );

    expect(currentSessionRow?.revokedAt).not.toBeNull();
    expect(siblingSessionRow?.revokedAt).toBeNull();
  });

  it("preserves credential CORS headers for allowed origins", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "logout-cors-session-token",
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
      .delete("/api/v1/auth/session")
      .set("Origin", "http://localhost:3000")
      .set("Cookie", createCookieHeader(session.sessionToken));

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("waits for concurrent session revocation to commit before protected auth fails", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();
    expect(databaseContainer).toBeDefined();

    const lockingClient = createDatabaseClient({
      connectionString: databaseContainer!.connectionString,
    });
    const fixture = await seedLoginUserFixture({
      db: db!,
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "logout-concurrent-session-token",
      createdAt: VALID_SESSION_CREATED_AT,
      expiresAt: VALID_SESSION_EXPIRES_AT,
    });
    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });
    let releaseRevocationTransaction: (() => void) | undefined;
    let markRevocationReady: (() => void) | undefined;
    const revocationReady = new Promise<void>((resolve) => {
      markRevocationReady = resolve;
    });
    const holdRevocationTransaction = new Promise<void>((resolve) => {
      releaseRevocationTransaction = resolve;
    });

    try {
      const revocationTransactionPromise = lockingClient.db.transaction(
        async (tx) => {
          await tx
            .update(sessions)
            .set({
              revokedAt: new Date("2026-05-20T00:00:00.000Z"),
            })
            .where(eq(sessions.id, session.sessionId));

          markRevocationReady?.();
          await holdRevocationTransaction;
        },
      );

      await revocationReady;

      const mePromise = request(app)
        .get("/api/v1/auth/me")
        .set("Cookie", createCookieHeader(session.sessionToken));
      const meState = await Promise.race([
        mePromise.then(() => "resolved" as const),
        new Promise<"pending">((resolve) => {
          setTimeout(() => resolve("pending"), PENDING_REQUEST_TIMEOUT_MS);
        }),
      ]);

      expect(meState).toBe("pending");

      releaseRevocationTransaction?.();
      await revocationTransactionPromise;

      const meResponse = await mePromise;

      expect(meResponse.status).toBe(401);
      expect(meResponse.body).toEqual({
        error: {
          code: "authentication_required",
          message: "Authentication required",
        },
      });
    } finally {
      releaseRevocationTransaction?.();
      await lockingClient.pool.end();
    }
  });
});
