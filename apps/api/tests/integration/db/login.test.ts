import {
  currentSessionSchema,
  EMAIL_NOT_VERIFIED_ERROR_CODE,
  INVALID_CREDENTIALS_ERROR_CODE,
  PASSWORD_RESET_REQUIRED_ERROR_CODE,
} from "@jubilant-carnival/contracts";
import { VALIDATION_ERROR_CODE } from "@jubilant-carnival/contracts/errors";
import { createHash } from "node:crypto";

import argon2 from "argon2";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "../../../src/infra/db.js";
import { sessions, userPasswords, users } from "../../../src/infra/schema.js";
import { createTestApp } from "../../helpers/create-app.js";
import { seedLoginUserFixture } from "../../helpers/auth-fixtures.js";
import { runDatabaseMigrations } from "../../helpers/database-migrations.js";
import {
  startPostgresContainer,
  type StartedPostgresContainer,
} from "../../helpers/postgres-container.js";

function getCookieValue(
  setCookieHeader: string[] | string | undefined,
  cookieName: string,
): string | null {
  const cookieHeaders =
    setCookieHeader === undefined
      ? []
      : Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [setCookieHeader];
  const cookieHeader = cookieHeaders.find((value) =>
    value.startsWith(`${cookieName}=`),
  );

  if (cookieHeader === undefined) {
    return null;
  }

  const [cookiePair] = cookieHeader.split(";", 1);

  if (cookiePair === undefined) {
    return null;
  }

  return cookiePair.slice(`${cookieName}=`.length);
}

describe("POST /api/v1/auth/session", () => {
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

  it("returns the actor payload, sets a cookie, and stores only the token hash", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
      roleKeys: ["affiliate", "client_admin"],
    });
    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    const response = await request(app).post("/api/v1/auth/session").send({
      email: fixture.email,
      password: fixture.password,
    });

    expect(response.status).toBe(200);
    expect(currentSessionSchema.parse(response.body)).toEqual({
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
        expiresAt: expect.any(String),
      },
    });

    const setCookieHeaders = Array.isArray(response.headers["set-cookie"])
      ? response.headers["set-cookie"]
      : response.headers["set-cookie"] === undefined
        ? []
        : [response.headers["set-cookie"]];
    const sessionCookieHeader = setCookieHeaders.find((header) =>
      header.startsWith("auth_session="),
    );

    expect(sessionCookieHeader).toBeDefined();
    expect(sessionCookieHeader).toContain("HttpOnly");
    expect(sessionCookieHeader).toContain("Path=/api");
    expect(sessionCookieHeader).toContain("SameSite=Lax");
    expect(sessionCookieHeader).toContain("Expires=");
    expect(sessionCookieHeader).not.toContain("Secure");

    const rawSessionToken = getCookieValue(
      response.headers["set-cookie"],
      "auth_session",
    );

    expect(rawSessionToken).not.toBeNull();

    const [storedSession] = await db!
      .select({
        tokenHash: sessions.tokenHash,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .where(eq(sessions.userId, fixture.userId))
      .limit(1);

    expect(storedSession).toBeDefined();
    expect(storedSession?.tokenHash).toBe(
      createHash("sha256").update(rawSessionToken!).digest("hex"),
    );
    expect(storedSession?.tokenHash).not.toBe(rawSessionToken);
    expect(storedSession?.expiresAt.toISOString()).toBe(
      response.body.session.expiresAt,
    );
  });

  it("returns invalid_credentials when the email is unknown", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    const response = await request(app).post("/api/v1/auth/session").send({
      email: "missing@example.com",
      password: "super-secret-password",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: INVALID_CREDENTIALS_ERROR_CODE,
        message: "Invalid email or password",
      },
    });
  });

  it("returns invalid_credentials when the user has no password row", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
      includePasswordRow: false,
    });
    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    const response = await request(app).post("/api/v1/auth/session").send({
      email: fixture.email,
      password: fixture.password,
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(INVALID_CREDENTIALS_ERROR_CODE);

    const sessionRows = await db!
      .select({
        id: sessions.id,
      })
      .from(sessions)
      .where(eq(sessions.userId, fixture.userId));

    expect(sessionRows).toHaveLength(0);
  });

  it("returns invalid_credentials when the password is wrong", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
    });
    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    const response = await request(app).post("/api/v1/auth/session").send({
      email: fixture.email,
      password: "not-the-right-password",
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(INVALID_CREDENTIALS_ERROR_CODE);
  });

  it("returns invalid_credentials when the user is disabled", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
      userStatus: "disabled",
    });
    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    const response = await request(app).post("/api/v1/auth/session").send({
      email: fixture.email,
      password: fixture.password,
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(INVALID_CREDENTIALS_ERROR_CODE);
  });

  it("returns invalid_credentials when the tenant is disabled", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
      tenantStatus: "disabled",
    });
    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    const response = await request(app).post("/api/v1/auth/session").send({
      email: fixture.email,
      password: fixture.password,
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(INVALID_CREDENTIALS_ERROR_CODE);
  });

  it("returns email_not_verified when the password is valid but the email is unverified", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
      emailVerifiedAt: null,
    });
    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    const response = await request(app).post("/api/v1/auth/session").send({
      email: fixture.email,
      password: fixture.password,
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: EMAIL_NOT_VERIFIED_ERROR_CODE,
        message: "Email address is not verified",
      },
    });
  });

  it("returns password_reset_required when the password is valid but reset is required", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
      resetRequired: true,
    });
    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    const response = await request(app).post("/api/v1/auth/session").send({
      email: fixture.email,
      password: fixture.password,
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: PASSWORD_RESET_REQUIRED_ERROR_CODE,
        message: "Password reset is required",
      },
    });
  });

  it("waits for a concurrent disablement to commit, then rejects login", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();
    expect(databaseContainer).toBeDefined();

    const lockingClient = createDatabaseClient({
      connectionString: databaseContainer!.connectionString,
    });
    const fixture = await seedLoginUserFixture({
      db: db!,
    });
    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });
    let releaseDisableTransaction: (() => void) | undefined;
    let markDisableReady: (() => void) | undefined;
    const disableReady = new Promise<void>((resolve) => {
      markDisableReady = resolve;
    });
    const holdDisableTransaction = new Promise<void>((resolve) => {
      releaseDisableTransaction = resolve;
    });

    await db!
      .update(userPasswords)
      .set({
        passwordHash: await argon2.hash(fixture.password, {
          type: argon2.argon2id,
          memoryCost: 4096,
          timeCost: 1,
          parallelism: 1,
        }),
      })
      .where(eq(userPasswords.userId, fixture.userId));

    try {
      const disableTransactionPromise = lockingClient.db.transaction(
        async (tx) => {
          await tx
            .update(users)
            .set({ status: "disabled" })
            .where(eq(users.id, fixture.userId));

          markDisableReady?.();
          await holdDisableTransaction;
        },
      );

      await disableReady;

      const loginPromise = request(app).post("/api/v1/auth/session").send({
        email: fixture.email,
        password: fixture.password,
      });
      const loginState = await Promise.race([
        loginPromise.then(() => "resolved" as const),
        new Promise<"pending">((resolve) => {
          setTimeout(() => resolve("pending"), 300);
        }),
      ]);

      expect(loginState).toBe("pending");

      releaseDisableTransaction?.();
      await disableTransactionPromise;

      const response = await loginPromise;

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: {
          code: INVALID_CREDENTIALS_ERROR_CODE,
          message: "Invalid email or password",
        },
      });

      const sessionRows = await db!
        .select({
          id: sessions.id,
        })
        .from(sessions)
        .where(eq(sessions.userId, fixture.userId));

      expect(sessionRows).toHaveLength(0);
    } finally {
      releaseDisableTransaction?.();
      await lockingClient.pool.end();
    }
  });

  it("returns validation_error for an invalid body", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    const response = await request(app).post("/api/v1/auth/session").send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(VALIDATION_ERROR_CODE);
  });

  it("returns an empty role list when the user has no roles", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
      roleKeys: [],
    });
    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    const response = await request(app).post("/api/v1/auth/session").send({
      email: fixture.email,
      password: fixture.password,
    });

    expect(response.status).toBe(200);
    expect(response.body.actor.roleKeys).toEqual([]);
  });

  it("allows credentials for configured origins on login responses", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
    });
    const app = createTestApp({
      auth: {
        db: db!,
        nodeEnv: "test",
      },
    });

    const response = await request(app)
      .post("/api/v1/auth/session")
      .set("Origin", "http://localhost:3000")
      .send({
        email: fixture.email,
        password: fixture.password,
      });

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });
});
