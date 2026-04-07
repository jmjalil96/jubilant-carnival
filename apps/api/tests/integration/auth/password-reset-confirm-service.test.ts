import pino from "pino";
import { describe, expect, it, vi } from "vitest";

import { createPasswordResetConfirmService } from "../../../src/modules/auth/password-reset/confirm/service.js";
import { hashPasswordResetToken } from "../../../src/modules/auth/password-reset/token.js";

describe("password reset confirm service", () => {
  it("returns invalid_password_reset_token without hashing when precheck fails", async () => {
    const repository = {
      precheckPasswordResetToken: vi.fn().mockResolvedValue({
        kind: "invalid_token",
        reason: "token_not_found",
      }),
      consumePasswordResetToken: vi.fn(),
    };
    const hashPassword = vi.fn();
    const service = createPasswordResetConfirmService({
      repository,
      hashPassword,
    });

    await expect(
      service.confirmPasswordReset({
        token: "missing-token",
        password: "new-super-secret-password",
        logger: pino({ level: "silent" }),
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "invalid_password_reset_token",
      message: "Invalid or expired password reset token",
    });

    expect(repository.precheckPasswordResetToken).toHaveBeenCalledWith(
      hashPasswordResetToken("missing-token"),
      expect.any(Date),
    );
    expect(hashPassword).not.toHaveBeenCalled();
    expect(repository.consumePasswordResetToken).not.toHaveBeenCalled();
  });

  it("hashes the password only after a valid precheck and then consumes the token", async () => {
    const repository = {
      precheckPasswordResetToken: vi.fn().mockResolvedValue({
        kind: "valid",
      }),
      consumePasswordResetToken: vi.fn().mockResolvedValue({
        kind: "confirmed",
        userId: "user-1",
      }),
    };
    const hashPassword = vi.fn().mockResolvedValue("$argon2id$hash");
    const service = createPasswordResetConfirmService({
      repository,
      hashPassword,
    });

    await expect(
      service.confirmPasswordReset({
        token: "valid-token",
        password: "new-super-secret-password",
        logger: pino({ level: "silent" }),
      }),
    ).resolves.toBeUndefined();

    const tokenHash = hashPasswordResetToken("valid-token");
    const precheckNow =
      repository.precheckPasswordResetToken.mock.calls[0]?.[1];
    const consumeInput =
      repository.consumePasswordResetToken.mock.calls[0]?.[0];

    expect(repository.precheckPasswordResetToken).toHaveBeenCalledWith(
      tokenHash,
      expect.any(Date),
    );
    expect(hashPassword).toHaveBeenCalledWith("new-super-secret-password");
    expect(repository.consumePasswordResetToken).toHaveBeenCalledWith({
      tokenHash,
      passwordHash: "$argon2id$hash",
      now: expect.any(Date),
    });
    expect(consumeInput?.now).not.toBe(precheckNow);
  });

  it("maps consume failures after a valid precheck to invalid_password_reset_token", async () => {
    const repository = {
      precheckPasswordResetToken: vi.fn().mockResolvedValue({
        kind: "valid",
      }),
      consumePasswordResetToken: vi.fn().mockResolvedValue({
        kind: "invalid_token",
        reason: "token_consumed",
      }),
    };
    const hashPassword = vi.fn().mockResolvedValue("$argon2id$hash");
    const service = createPasswordResetConfirmService({
      repository,
      hashPassword,
    });

    await expect(
      service.confirmPasswordReset({
        token: "racy-token",
        password: "new-super-secret-password",
        logger: pino({ level: "silent" }),
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "invalid_password_reset_token",
      message: "Invalid or expired password reset token",
    });

    expect(hashPassword).toHaveBeenCalledTimes(1);
    expect(repository.consumePasswordResetToken).toHaveBeenCalledTimes(1);
  });
});
