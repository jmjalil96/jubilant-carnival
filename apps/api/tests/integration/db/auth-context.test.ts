import express, { Router } from "express";

import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { errorHandler } from "../../../src/http/error-handler.js";
import { createDatabaseClient } from "../../../src/infra/db.js";
import { createHttpLogger, createLogger } from "../../../src/infra/logger.js";
import {
  sessions,
  tenants,
  userPasswords,
  users,
} from "../../../src/infra/schema.js";
import {
  createAuthContextRepository,
  createAuthContextResolver,
  createOptionalAuth,
  createRequireAuth,
} from "../../../src/modules/auth/router.js";
import { AUTH_SESSION_COOKIE_NAME } from "../../../src/modules/auth/shared/session.js";
import type { AuthenticatedRequestContext } from "../../../src/modules/auth/shared/contracts.js";
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
const VALID_RESOLVE_AT = new Date("2026-05-15T00:00:00.000Z");
const PENDING_REQUEST_TIMEOUT_MS = 300;

type InvalidationDb = Pick<
  ReturnType<typeof createDatabaseClient>["db"],
  "update"
>;
type InvalidationFixture = Awaited<ReturnType<typeof seedLoginUserFixture>>;
type InvalidationSession = Awaited<ReturnType<typeof createSessionFixture>>;
type InvalidationContext = {
  lockingDb: InvalidationDb;
  fixture: InvalidationFixture;
  session: InvalidationSession;
};

function serializeAuthContext(
  auth: AuthenticatedRequestContext | null | undefined,
) {
  if (auth === undefined || auth === null) {
    return null;
  }

  return {
    actor: auth.actor,
    session: {
      id: auth.session.id,
      expiresAt: auth.session.expiresAt.toISOString(),
      createdAt: auth.session.createdAt.toISOString(),
    },
  };
}

function createCookieHeader(sessionToken: string): string {
  return `${AUTH_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`;
}

function createMiddlewareTestApp({
  resolver,
}: {
  resolver: ReturnType<typeof createAuthContextResolver>;
}) {
  const logger = createLogger({
    logLevel: "silent",
    nodeEnv: "test",
  });
  const app = express();
  const router = Router();

  router.get("/optional", createOptionalAuth({ resolver }), (req, res) => {
    res.status(200).json({
      auth: serializeAuthContext(req.auth),
    });
  });

  router.get("/required", createRequireAuth({ resolver }), (req, res) => {
    res.status(200).json({
      auth: serializeAuthContext(req.auth),
    });
  });

  app.use(createHttpLogger({ logger }));
  app.use(router);
  app.use(errorHandler);

  return app;
}

describe("auth context resolver", () => {
  let databaseContainer: StartedPostgresContainer | undefined;
  let databaseClient: ReturnType<typeof createDatabaseClient> | undefined;

  async function expectRequireAuthBlocksOnConcurrentInvalidation({
    invalidate,
  }: {
    invalidate: (context: InvalidationContext) => Promise<void>;
  }): Promise<void> {
    const db = databaseClient?.db;

    expect(db).toBeDefined();
    expect(databaseContainer).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: `concurrent-auth-session-${fixture.userId}`,
      createdAt: VALID_SESSION_CREATED_AT,
      expiresAt: VALID_SESSION_EXPIRES_AT,
    });
    const resolver = createAuthContextResolver({
      repository: createAuthContextRepository({ db: db! }),
    });
    const app = createMiddlewareTestApp({ resolver });
    const lockingClient = createDatabaseClient({
      connectionString: databaseContainer!.connectionString,
    });
    let releaseInvalidationTransaction: (() => void) | undefined;
    let markInvalidationReady: (() => void) | undefined;
    const invalidationReady = new Promise<void>((resolve) => {
      markInvalidationReady = resolve;
    });
    const holdInvalidationTransaction = new Promise<void>((resolve) => {
      releaseInvalidationTransaction = resolve;
    });

    try {
      const invalidationTransactionPromise = lockingClient.db.transaction(
        async (tx) => {
          await invalidate({
            lockingDb: tx,
            fixture,
            session,
          });
          markInvalidationReady?.();
          await holdInvalidationTransaction;
        },
      );

      await invalidationReady;

      const responsePromise = request(app)
        .get("/required")
        .set("Cookie", createCookieHeader(session.sessionToken));
      const responseState = await Promise.race([
        responsePromise.then(() => "resolved" as const),
        new Promise<"pending">((resolve) => {
          setTimeout(() => resolve("pending"), PENDING_REQUEST_TIMEOUT_MS);
        }),
      ]);

      expect(responseState).toBe("pending");

      releaseInvalidationTransaction?.();
      await invalidationTransactionPromise;

      const response = await responsePromise;

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: {
          code: "authentication_required",
          message: "Authentication required",
        },
      });
    } finally {
      releaseInvalidationTransaction?.();
      await lockingClient.pool.end();
    }
  }

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

  it("returns auth context for a valid session and fresh role keys", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
      roleKeys: ["client_admin", "affiliate"],
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "valid-session-token",
      createdAt: VALID_SESSION_CREATED_AT,
      expiresAt: VALID_SESSION_EXPIRES_AT,
    });
    const repository = createAuthContextRepository({ db: db! });
    const resolver = createAuthContextResolver({ repository });

    const result = await resolver.resolveFromSessionToken(
      session.sessionToken,
      VALID_RESOLVE_AT,
    );

    expect(result).toEqual({
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
        id: session.sessionId,
        expiresAt: VALID_SESSION_EXPIRES_AT,
        createdAt: VALID_SESSION_CREATED_AT,
      },
    });
  });

  it("returns a detailed missing_session_cookie reason when the cookie is absent", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const resolver = createAuthContextResolver({
      repository: createAuthContextRepository({ db: db! }),
    });

    const result = await resolver.resolveDetailedFromCookieHeader(
      undefined,
      VALID_RESOLVE_AT,
    );

    expect(result).toEqual({
      kind: "unauthenticated",
      reason: "missing_session_cookie",
    });
  });

  it("returns null for a revoked session", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "revoked-session-token",
      createdAt: VALID_SESSION_CREATED_AT,
      expiresAt: VALID_SESSION_EXPIRES_AT,
      revokedAt: new Date("2026-05-10T00:00:00.000Z"),
    });
    const resolver = createAuthContextResolver({
      repository: createAuthContextRepository({ db: db! }),
    });

    const result = await resolver.resolveFromSessionToken(
      session.sessionToken,
      VALID_RESOLVE_AT,
    );

    expect(result).toBeNull();
  });

  it("returns null for an expired session", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "expired-session-token",
      createdAt: VALID_SESSION_CREATED_AT,
      expiresAt: new Date("2026-05-10T00:00:00.000Z"),
    });
    const resolver = createAuthContextResolver({
      repository: createAuthContextRepository({ db: db! }),
    });

    const result = await resolver.resolveFromSessionToken(
      session.sessionToken,
      VALID_RESOLVE_AT,
    );

    expect(result).toBeNull();
  });

  it("returns null for a disabled user", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
      userStatus: "disabled",
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "disabled-user-session-token",
      createdAt: VALID_SESSION_CREATED_AT,
      expiresAt: VALID_SESSION_EXPIRES_AT,
    });
    const resolver = createAuthContextResolver({
      repository: createAuthContextRepository({ db: db! }),
    });

    const result = await resolver.resolveFromSessionToken(
      session.sessionToken,
      VALID_RESOLVE_AT,
    );

    expect(result).toBeNull();
  });

  it("returns null for a disabled tenant", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
      tenantStatus: "disabled",
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "disabled-tenant-session-token",
      createdAt: VALID_SESSION_CREATED_AT,
      expiresAt: VALID_SESSION_EXPIRES_AT,
    });
    const resolver = createAuthContextResolver({
      repository: createAuthContextRepository({ db: db! }),
    });

    const result = await resolver.resolveFromSessionToken(
      session.sessionToken,
      VALID_RESOLVE_AT,
    );

    expect(result).toBeNull();
  });

  it("returns null when the password row is missing", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
      includePasswordRow: false,
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "missing-password-session-token",
      createdAt: VALID_SESSION_CREATED_AT,
      expiresAt: VALID_SESSION_EXPIRES_AT,
    });
    const resolver = createAuthContextResolver({
      repository: createAuthContextRepository({ db: db! }),
    });

    const result = await resolver.resolveFromSessionToken(
      session.sessionToken,
      VALID_RESOLVE_AT,
    );

    expect(result).toBeNull();
  });

  it("returns a detailed missing_password_row reason when the password row is missing", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
      includePasswordRow: false,
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "missing-password-detailed-session-token",
      createdAt: VALID_SESSION_CREATED_AT,
      expiresAt: VALID_SESSION_EXPIRES_AT,
    });
    const resolver = createAuthContextResolver({
      repository: createAuthContextRepository({ db: db! }),
    });

    const result = await resolver.resolveDetailedFromSessionToken(
      session.sessionToken,
      VALID_RESOLVE_AT,
    );

    expect(result).toEqual({
      kind: "unauthenticated",
      reason: "missing_password_row",
    });
  });

  it("returns null when the email is unverified", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
      emailVerifiedAt: null,
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "unverified-email-session-token",
      createdAt: VALID_SESSION_CREATED_AT,
      expiresAt: VALID_SESSION_EXPIRES_AT,
    });
    const resolver = createAuthContextResolver({
      repository: createAuthContextRepository({ db: db! }),
    });

    const result = await resolver.resolveFromSessionToken(
      session.sessionToken,
      VALID_RESOLVE_AT,
    );

    expect(result).toBeNull();
  });

  it("returns null when password reset is required", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
      resetRequired: true,
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "reset-required-session-token",
      createdAt: VALID_SESSION_CREATED_AT,
      expiresAt: VALID_SESSION_EXPIRES_AT,
    });
    const resolver = createAuthContextResolver({
      repository: createAuthContextRepository({ db: db! }),
    });

    const result = await resolver.resolveFromSessionToken(
      session.sessionToken,
      VALID_RESOLVE_AT,
    );

    expect(result).toBeNull();
  });

  it("returns null when the session predates the last password update", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "stale-session-token",
      createdAt: VALID_SESSION_CREATED_AT,
      expiresAt: VALID_SESSION_EXPIRES_AT,
    });
    const resolver = createAuthContextResolver({
      repository: createAuthContextRepository({ db: db! }),
    });

    await db!
      .update(userPasswords)
      .set({
        passwordUpdatedAt: new Date("2026-05-20T00:00:00.000Z"),
      })
      .where(eq(userPasswords.userId, fixture.userId));

    const result = await resolver.resolveFromSessionToken(
      session.sessionToken,
      new Date("2026-05-25T00:00:00.000Z"),
    );

    expect(result).toBeNull();
  });

  it("sets req.auth to null for optional auth when the cookie is missing", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const resolver = createAuthContextResolver({
      repository: createAuthContextRepository({ db: db! }),
    });
    const app = createMiddlewareTestApp({ resolver });

    const response = await request(app).get("/optional");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ auth: null });
  });

  it("sets req.auth for optional auth when the cookie is valid", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
      roleKeys: ["client_admin", "affiliate"],
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "optional-auth-valid-session",
      createdAt: VALID_SESSION_CREATED_AT,
      expiresAt: VALID_SESSION_EXPIRES_AT,
    });
    const resolver = createAuthContextResolver({
      repository: createAuthContextRepository({ db: db! }),
    });
    const app = createMiddlewareTestApp({ resolver });

    const response = await request(app)
      .get("/optional")
      .set("Cookie", createCookieHeader(session.sessionToken));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      auth: {
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
          id: session.sessionId,
          expiresAt: VALID_SESSION_EXPIRES_AT.toISOString(),
          createdAt: VALID_SESSION_CREATED_AT.toISOString(),
        },
      },
    });
  });

  it("returns authentication_required when require auth has no cookie", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const resolver = createAuthContextResolver({
      repository: createAuthContextRepository({ db: db! }),
    });
    const app = createMiddlewareTestApp({ resolver });

    const response = await request(app).get("/required");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "authentication_required",
        message: "Authentication required",
      },
    });
  });

  it.each([
    {
      label: "invalid",
      cookieHeader: createCookieHeader("missing-session-token"),
    },
    {
      label: "revoked",
      createCookie: async () => {
        const fixture = await seedLoginUserFixture({
          db: databaseClient!.db,
        });
        const session = await createSessionFixture({
          db: databaseClient!.db,
          userId: fixture.userId,
          sessionToken: "require-auth-revoked-token",
          createdAt: VALID_SESSION_CREATED_AT,
          expiresAt: VALID_SESSION_EXPIRES_AT,
          revokedAt: new Date("2026-05-10T00:00:00.000Z"),
        });

        return createCookieHeader(session.sessionToken);
      },
    },
    {
      label: "stale",
      createCookie: async () => {
        const fixture = await seedLoginUserFixture({
          db: databaseClient!.db,
        });
        const session = await createSessionFixture({
          db: databaseClient!.db,
          userId: fixture.userId,
          sessionToken: "require-auth-stale-token",
          createdAt: VALID_SESSION_CREATED_AT,
          expiresAt: VALID_SESSION_EXPIRES_AT,
        });

        await databaseClient!.db
          .update(userPasswords)
          .set({
            passwordUpdatedAt: new Date("2026-05-20T00:00:00.000Z"),
          })
          .where(eq(userPasswords.userId, fixture.userId));

        return createCookieHeader(session.sessionToken);
      },
    },
  ])(
    "returns authentication_required for $label auth",
    async ({ cookieHeader, createCookie }) => {
      const db = databaseClient?.db;

      expect(db).toBeDefined();

      const resolver = createAuthContextResolver({
        repository: createAuthContextRepository({ db: db! }),
      });
      const app = createMiddlewareTestApp({ resolver });
      const resolvedCookieHeader =
        cookieHeader ??
        (await createCookie?.()) ??
        createCookieHeader("missing");

      const response = await request(app)
        .get("/required")
        .set("Cookie", resolvedCookieHeader);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: {
          code: "authentication_required",
          message: "Authentication required",
        },
      });
    },
  );

  it.each([
    {
      label: "session revocation",
      invalidate: async ({ lockingDb, session }: InvalidationContext) => {
        await lockingDb
          .update(sessions)
          .set({
            revokedAt: new Date("2026-05-20T00:00:00.000Z"),
          })
          .where(eq(sessions.id, session.sessionId));
      },
    },
    {
      label: "password update",
      invalidate: async ({ lockingDb, fixture }: InvalidationContext) => {
        await lockingDb
          .update(userPasswords)
          .set({
            passwordUpdatedAt: new Date("2026-05-20T00:00:00.000Z"),
          })
          .where(eq(userPasswords.userId, fixture.userId));
      },
    },
    {
      label: "password reset requirement",
      invalidate: async ({ lockingDb, fixture }: InvalidationContext) => {
        await lockingDb
          .update(userPasswords)
          .set({
            resetRequired: true,
          })
          .where(eq(userPasswords.userId, fixture.userId));
      },
    },
    {
      label: "user disablement",
      invalidate: async ({ lockingDb, fixture }: InvalidationContext) => {
        await lockingDb
          .update(users)
          .set({
            status: "disabled",
          })
          .where(eq(users.id, fixture.userId));
      },
    },
    {
      label: "tenant disablement",
      invalidate: async ({ lockingDb, fixture }: InvalidationContext) => {
        await lockingDb
          .update(tenants)
          .set({
            status: "disabled",
          })
          .where(eq(tenants.id, fixture.tenantId));
      },
    },
  ])(
    "waits for concurrent $label to commit before rejecting require auth",
    async ({ invalidate }) => {
      await expectRequireAuthBlocksOnConcurrentInvalidation({
        invalidate,
      });
    },
  );

  it("passes through require auth when the cookie is valid", async () => {
    const db = databaseClient?.db;

    expect(db).toBeDefined();

    const fixture = await seedLoginUserFixture({
      db: db!,
      roleKeys: ["client_admin", "affiliate"],
    });
    const session = await createSessionFixture({
      db: db!,
      userId: fixture.userId,
      sessionToken: "require-auth-valid-session",
      createdAt: VALID_SESSION_CREATED_AT,
      expiresAt: VALID_SESSION_EXPIRES_AT,
    });
    const resolver = createAuthContextResolver({
      repository: createAuthContextRepository({ db: db! }),
    });
    const app = createMiddlewareTestApp({ resolver });

    const response = await request(app)
      .get("/required")
      .set("Cookie", createCookieHeader(session.sessionToken));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      auth: {
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
          id: session.sessionId,
          expiresAt: VALID_SESSION_EXPIRES_AT.toISOString(),
          createdAt: VALID_SESSION_CREATED_AT.toISOString(),
        },
      },
    });
  });
});
