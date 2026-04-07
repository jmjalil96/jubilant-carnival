import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "../../../src/infra/db.js";
import {
  sessions,
  userPasswords,
  userTokens,
} from "../../../src/infra/schema.js";
import { AUTH_SESSION_COOKIE_NAME } from "../../../src/modules/auth/shared/session.js";
import { createTestApp } from "../../helpers/create-app.js";
import {
  createSessionFixture,
  createUserTokenFixture,
  seedLoginUserFixture,
} from "../../helpers/auth-fixtures.js";
import { runDatabaseMigrations } from "../../helpers/database-migrations.js";
import {
  startPostgresContainer,
  type StartedPostgresContainer,
} from "../../helpers/postgres-container.js";

const VALID_SESSION_CREATED_AT = new Date("2026-05-01T00:00:00.000Z");
const VALID_SESSION_EXPIRES_AT = new Date("2026-06-01T00:00:00.000Z");
const PENDING_REQUEST_TIMEOUT_MS = 300;

function createCookieHeader(sessionToken: string): string {
  return `${AUTH_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`;
}

describe("password reset endpoints", () => {
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

  describe("POST /api/v1/auth/password-reset", () => {
    it("creates one active reset token for an eligible user and invalidates older ones on repeat request", async () => {
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

      const firstResponse = await request(app)
        .post("/api/v1/auth/password-reset")
        .send({
          email: fixture.email,
        });

      expect(firstResponse.status).toBe(204);
      expect(firstResponse.text).toBe("");
      expect(firstResponse.headers["cache-control"]).toBe("no-store");

      const secondResponse = await request(app)
        .post("/api/v1/auth/password-reset")
        .send({
          email: fixture.email,
        });

      expect(secondResponse.status).toBe(204);

      const tokenRows = await db!
        .select({
          id: userTokens.id,
          consumedAt: userTokens.consumedAt,
        })
        .from(userTokens)
        .where(eq(userTokens.userId, fixture.userId));

      expect(tokenRows).toHaveLength(2);
      expect(tokenRows.filter((row) => row.consumedAt === null)).toHaveLength(
        1,
      );
      expect(tokenRows.filter((row) => row.consumedAt !== null)).toHaveLength(
        1,
      );
    });

    it.each([
      {
        label: "unknown email",
        email: "missing@example.com",
        seed: async (db: NonNullable<typeof databaseClient>["db"]) => {
          const countBefore = await db
            .select({
              id: userTokens.id,
            })
            .from(userTokens);

          return {
            email: "missing@example.com",
            countBefore: countBefore.length,
          };
        },
      },
      {
        label: "disabled user",
        seed: async (db: NonNullable<typeof databaseClient>["db"]) =>
          await seedLoginUserFixture({
            db,
            userStatus: "disabled",
          }),
      },
      {
        label: "disabled tenant",
        seed: async (db: NonNullable<typeof databaseClient>["db"]) =>
          await seedLoginUserFixture({
            db,
            tenantStatus: "disabled",
          }),
      },
      {
        label: "unverified email",
        seed: async (db: NonNullable<typeof databaseClient>["db"]) =>
          await seedLoginUserFixture({
            db,
            emailVerifiedAt: null,
          }),
      },
      {
        label: "missing password row",
        seed: async (db: NonNullable<typeof databaseClient>["db"]) =>
          await seedLoginUserFixture({
            db,
            includePasswordRow: false,
          }),
      },
    ])(
      "returns 204 and does not create a token for $label",
      async ({ seed }) => {
        const db = databaseClient?.db;

        expect(db).toBeDefined();

        const fixture = await seed(db!);
        const app = createTestApp({
          auth: {
            db: db!,
            nodeEnv: "test",
          },
        });

        const response = await request(app)
          .post("/api/v1/auth/password-reset")
          .send({
            email: fixture.email,
          });

        expect(response.status).toBe(204);
        expect(response.headers["cache-control"]).toBe("no-store");

        if ("userId" in fixture) {
          const tokenRows = await db!
            .select({
              id: userTokens.id,
            })
            .from(userTokens)
            .where(eq(userTokens.userId, fixture.userId));

          expect(tokenRows).toHaveLength(0);
        } else {
          const tokenRows = await db!
            .select({
              id: userTokens.id,
            })
            .from(userTokens);

          expect(tokenRows).toHaveLength(fixture.countBefore);
        }
      },
    );

    it("preserves credential CORS headers for allowed origins", async () => {
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
        .post("/api/v1/auth/password-reset")
        .set("Origin", "http://localhost:3000")
        .send({
          email: fixture.email,
        });

      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3000",
      );
      expect(response.headers["access-control-allow-credentials"]).toBe("true");
    });
  });

  describe("POST /api/v1/auth/password-reset/confirm", () => {
    it("updates the password, clears reset_required, consumes tokens, revokes sessions, and does not set auth cookies", async () => {
      const db = databaseClient?.db;

      expect(db).toBeDefined();

      const fixture = await seedLoginUserFixture({
        db: db!,
        resetRequired: true,
      });
      const [passwordRowBeforeReset] = await db!
        .select({
          passwordUpdatedAt: userPasswords.passwordUpdatedAt,
        })
        .from(userPasswords)
        .where(eq(userPasswords.userId, fixture.userId))
        .limit(1);
      await createSessionFixture({
        db: db!,
        userId: fixture.userId,
        sessionToken: "reset-confirm-session-one",
        createdAt: VALID_SESSION_CREATED_AT,
        expiresAt: VALID_SESSION_EXPIRES_AT,
      });
      await createSessionFixture({
        db: db!,
        userId: fixture.userId,
        sessionToken: "reset-confirm-session-two",
        createdAt: new Date("2026-05-02T00:00:00.000Z"),
        expiresAt: VALID_SESSION_EXPIRES_AT,
      });
      const resetToken = await createUserTokenFixture({
        db: db!,
        userId: fixture.userId,
        token: "valid-password-reset-token",
      });
      const app = createTestApp({
        auth: {
          db: db!,
          nodeEnv: "test",
        },
      });

      const response = await request(app)
        .post("/api/v1/auth/password-reset/confirm")
        .send({
          token: resetToken.token,
          password: "new-super-secret-password",
        });

      expect(response.status).toBe(204);
      expect(response.text).toBe("");
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.headers["set-cookie"]).toBeUndefined();

      const [passwordRow] = await db!
        .select({
          resetRequired: userPasswords.resetRequired,
          passwordUpdatedAt: userPasswords.passwordUpdatedAt,
        })
        .from(userPasswords)
        .where(eq(userPasswords.userId, fixture.userId))
        .limit(1);

      expect(passwordRow?.resetRequired).toBe(false);
      expect(passwordRow?.passwordUpdatedAt.getTime()).toBeGreaterThanOrEqual(
        passwordRowBeforeReset?.passwordUpdatedAt.getTime() ?? 0,
      );

      const tokenRows = await db!
        .select({
          id: userTokens.id,
          consumedAt: userTokens.consumedAt,
        })
        .from(userTokens)
        .where(eq(userTokens.userId, fixture.userId));

      expect(tokenRows).toHaveLength(1);
      expect(tokenRows[0]?.consumedAt).not.toBeNull();

      const sessionRows = await db!
        .select({
          revokedAt: sessions.revokedAt,
        })
        .from(sessions)
        .where(eq(sessions.userId, fixture.userId));

      expect(sessionRows).toHaveLength(2);
      expect(sessionRows.every((row) => row.revokedAt !== null)).toBe(true);

      const oldPasswordLoginResponse = await request(app)
        .post("/api/v1/auth/session")
        .send({
          email: fixture.email,
          password: fixture.password,
        });

      expect(oldPasswordLoginResponse.status).toBe(401);
      expect(oldPasswordLoginResponse.body).toEqual({
        error: {
          code: "invalid_credentials",
          message: "Invalid email or password",
        },
      });

      const newPasswordLoginResponse = await request(app)
        .post("/api/v1/auth/session")
        .send({
          email: fixture.email,
          password: "new-super-secret-password",
        });

      expect(newPasswordLoginResponse.status).toBe(200);
      expect(newPasswordLoginResponse.body.actor.user.id).toBe(fixture.userId);
    });

    it.each([
      {
        label: "unknown token",
        setup: async () => ({
          token: "missing-password-reset-token",
        }),
      },
      {
        label: "consumed token",
        setup: async (db: NonNullable<typeof databaseClient>["db"]) => {
          const fixture = await seedLoginUserFixture({
            db,
          });
          const token = await createUserTokenFixture({
            db,
            userId: fixture.userId,
            token: "consumed-password-reset-token",
            consumedAt: new Date("2026-05-10T00:00:00.000Z"),
          });

          return {
            token: token.token,
          };
        },
      },
      {
        label: "expired token",
        setup: async (db: NonNullable<typeof databaseClient>["db"]) => {
          const fixture = await seedLoginUserFixture({
            db,
          });
          const token = await createUserTokenFixture({
            db,
            userId: fixture.userId,
            token: "expired-password-reset-token",
            expiresAt: new Date("2026-03-10T00:00:00.000Z"),
          });

          return {
            token: token.token,
          };
        },
      },
      {
        label: "wrong-kind token",
        setup: async (db: NonNullable<typeof databaseClient>["db"]) => {
          const fixture = await seedLoginUserFixture({
            db,
          });
          const token = await createUserTokenFixture({
            db,
            userId: fixture.userId,
            token: "email-verification-token",
            kind: "email_verification",
          });

          return {
            token: token.token,
          };
        },
      },
    ])("returns invalid_password_reset_token for $label", async ({ setup }) => {
      const db = databaseClient?.db;

      expect(db).toBeDefined();

      const { token } = await setup(db!);
      const app = createTestApp({
        auth: {
          db: db!,
          nodeEnv: "test",
        },
      });

      const response = await request(app)
        .post("/api/v1/auth/password-reset/confirm")
        .send({
          token,
          password: "new-super-secret-password",
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: {
          code: "invalid_password_reset_token",
          message: "Invalid or expired password reset token",
        },
      });
    });

    it("allows only one successful concurrent confirmation for the same token", async () => {
      const db = databaseClient?.db;

      expect(db).toBeDefined();

      const fixture = await seedLoginUserFixture({
        db: db!,
      });
      const token = await createUserTokenFixture({
        db: db!,
        userId: fixture.userId,
        token: "concurrent-password-reset-token",
      });
      const app = createTestApp({
        auth: {
          db: db!,
          nodeEnv: "test",
        },
      });

      const [firstResponse, secondResponse] = await Promise.all([
        request(app).post("/api/v1/auth/password-reset/confirm").send({
          token: token.token,
          password: "shared-new-password",
        }),
        request(app).post("/api/v1/auth/password-reset/confirm").send({
          token: token.token,
          password: "shared-new-password",
        }),
      ]);

      const statuses = [firstResponse.status, secondResponse.status].sort();

      expect(statuses).toEqual([204, 400]);

      const loginResponse = await request(app)
        .post("/api/v1/auth/session")
        .send({
          email: fixture.email,
          password: "shared-new-password",
        });

      expect(loginResponse.status).toBe(200);
    });

    it("rolls back session revocation when the password row disappears after precheck", async () => {
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
        sessionToken: "missing-password-row-race-session",
        createdAt: VALID_SESSION_CREATED_AT,
        expiresAt: VALID_SESSION_EXPIRES_AT,
      });
      const token = await createUserTokenFixture({
        db: db!,
        userId: fixture.userId,
        token: "missing-password-row-race-token",
      });
      const app = createTestApp({
        auth: {
          db: db!,
          nodeEnv: "test",
        },
      });
      let releaseDeleteTransaction: (() => void) | undefined;
      let markPasswordLockReady: (() => void) | undefined;
      const passwordLockReady = new Promise<void>((resolve) => {
        markPasswordLockReady = resolve;
      });
      const holdDeleteTransaction = new Promise<void>((resolve) => {
        releaseDeleteTransaction = resolve;
      });

      try {
        const deleteTransactionPromise = lockingClient.db.transaction(
          async (tx) => {
            await tx
              .select({
                userId: userPasswords.userId,
              })
              .from(userPasswords)
              .where(eq(userPasswords.userId, fixture.userId))
              .limit(1)
              .for("update", { of: [userPasswords] });

            markPasswordLockReady?.();
            await holdDeleteTransaction;

            await tx
              .delete(userPasswords)
              .where(eq(userPasswords.userId, fixture.userId));
          },
        );

        await passwordLockReady;

        const confirmPromise = request(app)
          .post("/api/v1/auth/password-reset/confirm")
          .send({
            token: token.token,
            password: "new-super-secret-password",
          });
        const confirmState = await Promise.race([
          confirmPromise.then(() => "resolved" as const),
          new Promise<"pending">((resolve) => {
            setTimeout(() => resolve("pending"), PENDING_REQUEST_TIMEOUT_MS);
          }),
        ]);

        expect(confirmState).toBe("pending");

        releaseDeleteTransaction?.();
        await deleteTransactionPromise;

        const confirmResponse = await confirmPromise;

        expect(confirmResponse.status).toBe(400);
        expect(confirmResponse.body).toEqual({
          error: {
            code: "invalid_password_reset_token",
            message: "Invalid or expired password reset token",
          },
        });

        const [storedSession] = await db!
          .select({
            revokedAt: sessions.revokedAt,
          })
          .from(sessions)
          .where(eq(sessions.id, session.sessionId))
          .limit(1);
        const [storedToken] = await db!
          .select({
            consumedAt: userTokens.consumedAt,
          })
          .from(userTokens)
          .where(eq(userTokens.id, token.tokenId))
          .limit(1);

        expect(storedSession?.revokedAt).toBeNull();
        expect(storedToken?.consumedAt).toBeNull();
      } finally {
        releaseDeleteTransaction?.();
        await lockingClient.pool.end();
      }
    });

    it("waits for a concurrent password reset confirm transaction to commit before protected auth fails", async () => {
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
        sessionToken: "concurrent-password-reset-auth-session",
        createdAt: VALID_SESSION_CREATED_AT,
        expiresAt: VALID_SESSION_EXPIRES_AT,
      });
      const token = await createUserTokenFixture({
        db: db!,
        userId: fixture.userId,
        token: "concurrent-password-reset-confirm-token",
      });
      const app = createTestApp({
        auth: {
          db: db!,
          nodeEnv: "test",
        },
      });
      let releaseConfirmTransaction: (() => void) | undefined;
      let markConfirmReady: (() => void) | undefined;
      const confirmReady = new Promise<void>((resolve) => {
        markConfirmReady = resolve;
      });
      const holdConfirmTransaction = new Promise<void>((resolve) => {
        releaseConfirmTransaction = resolve;
      });

      try {
        const confirmTransactionPromise = lockingClient.db.transaction(
          async (tx) => {
            await tx
              .select({
                id: userTokens.id,
              })
              .from(userTokens)
              .where(eq(userTokens.id, token.tokenId))
              .limit(1)
              .for("update", { of: [userTokens] });

            await tx
              .update(sessions)
              .set({
                revokedAt: new Date("2026-05-20T00:00:00.000Z"),
                updatedAt: new Date("2026-05-20T00:00:00.000Z"),
              })
              .where(eq(sessions.userId, fixture.userId));

            await tx
              .select({
                userId: userPasswords.userId,
              })
              .from(userPasswords)
              .where(eq(userPasswords.userId, fixture.userId))
              .limit(1)
              .for("update", { of: [userPasswords] });

            await tx
              .update(userPasswords)
              .set({
                passwordUpdatedAt: new Date("2026-05-20T00:00:00.000Z"),
              })
              .where(eq(userPasswords.userId, fixture.userId));

            await tx
              .update(userTokens)
              .set({
                consumedAt: new Date("2026-05-20T00:00:00.000Z"),
              })
              .where(eq(userTokens.id, token.tokenId));

            markConfirmReady?.();
            await holdConfirmTransaction;
          },
        );

        await confirmReady;

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

        releaseConfirmTransaction?.();
        await confirmTransactionPromise;

        const meResponse = await mePromise;

        expect(meResponse.status).toBe(401);
        expect(meResponse.body).toEqual({
          error: {
            code: "authentication_required",
            message: "Authentication required",
          },
        });
      } finally {
        releaseConfirmTransaction?.();
        await lockingClient.pool.end();
      }
    });
  });
});
