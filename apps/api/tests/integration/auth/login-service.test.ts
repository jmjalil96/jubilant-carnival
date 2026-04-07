import pino from "pino";
import { describe, expect, it, vi } from "vitest";

import { createLoginService } from "../../../src/modules/auth/login/service.js";

describe("login service", () => {
  it("retries once when session token hash creation collides", async () => {
    const repository = {
      findLoginCandidateByEmailNormalized: vi.fn().mockResolvedValue({
        userId: "user-1",
        tenantId: "tenant-1",
        email: "user@example.com",
        displayName: "User One",
        emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
        userStatus: "active",
        tenantSlug: "tenant-one",
        tenantName: "Tenant One",
        tenantStatus: "active",
        passwordHash: "$argon2id$hash",
        passwordUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
        resetRequired: false,
      }),
      createSessionAfterRecheck: vi
        .fn()
        .mockRejectedValueOnce({
          code: "23505",
          constraint: "sessions_token_hash_unique",
        })
        .mockResolvedValueOnce({ kind: "created" }),
      listRoleKeysForUser: vi.fn().mockResolvedValue(["client_admin"]),
    };
    const sessionManager = {
      cookieName: "auth_session",
      issueSession: vi
        .fn()
        .mockReturnValueOnce({
          sessionId: "session-1",
          sessionToken: "raw-token-1",
          tokenHash: "hash-1",
          expiresAt: new Date("2026-02-01T00:00:00.000Z"),
        })
        .mockReturnValueOnce({
          sessionId: "session-2",
          sessionToken: "raw-token-2",
          tokenHash: "hash-2",
          expiresAt: new Date("2026-02-01T00:00:00.000Z"),
        }),
      getCookieOptions: vi.fn(),
      getClearedCookieOptions: vi.fn(),
    };
    const service = createLoginService({
      repository,
      sessionManager,
      verifyPasswordHash: vi.fn().mockResolvedValue(true),
    });

    const result = await service.login({
      email: "user@example.com",
      password: "super-secret-password",
      logger: pino({ level: "silent" }),
    });

    expect(repository.createSessionAfterRecheck).toHaveBeenCalledTimes(2);
    expect(result.sessionToken).toBe("raw-token-2");
    expect(result.actor.roleKeys).toEqual(["client_admin"]);
  });

  it("maps a late session user foreign key violation to invalid_credentials", async () => {
    const repository = {
      findLoginCandidateByEmailNormalized: vi.fn().mockResolvedValue({
        userId: "user-1",
        tenantId: "tenant-1",
        email: "user@example.com",
        displayName: "User One",
        emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
        userStatus: "active",
        tenantSlug: "tenant-one",
        tenantName: "Tenant One",
        tenantStatus: "active",
        passwordHash: "$argon2id$hash",
        passwordUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
        resetRequired: false,
      }),
      createSessionAfterRecheck: vi.fn().mockRejectedValue({
        code: "23503",
        constraint: "sessions_user_id_users_id_fk",
      }),
      listRoleKeysForUser: vi.fn(),
    };
    const sessionManager = {
      cookieName: "auth_session",
      issueSession: vi.fn().mockReturnValue({
        sessionId: "session-1",
        sessionToken: "raw-token-1",
        tokenHash: "hash-1",
        expiresAt: new Date("2026-02-01T00:00:00.000Z"),
      }),
      getCookieOptions: vi.fn(),
      getClearedCookieOptions: vi.fn(),
    };
    const service = createLoginService({
      repository,
      sessionManager,
      verifyPasswordHash: vi.fn().mockResolvedValue(true),
    });

    await expect(
      service.login({
        email: "user@example.com",
        password: "super-secret-password",
        logger: pino({ level: "silent" }),
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: "invalid_credentials",
      message: "Invalid email or password",
    });

    expect(repository.createSessionAfterRecheck).toHaveBeenCalledTimes(1);
    expect(repository.listRoleKeysForUser).not.toHaveBeenCalled();
  });
});
