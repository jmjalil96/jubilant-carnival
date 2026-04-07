import pino from "pino";
import { describe, expect, it, vi } from "vitest";

import { createPasswordResetRequestService } from "../../../src/modules/auth/password-reset/request/service.js";
import { hashPasswordResetToken } from "../../../src/modules/auth/password-reset/token.js";

describe("password reset request service", () => {
  it("sends the reset email with a tokenized URL after a successful issuance", async () => {
    const repository = {
      issuePasswordResetToken: vi.fn().mockResolvedValue({
        kind: "issued",
        userId: "user-1",
        email: "user@example.com",
        expiresAt: new Date("2026-05-01T00:00:00.000Z"),
      }),
    };
    const emailService = {
      send: vi.fn(),
      sendPasswordReset: vi.fn().mockResolvedValue(undefined),
    };
    const service = createPasswordResetRequestService({
      repository,
      emailService,
      passwordResetUrlBase:
        "https://app.example.com/reset-password?source=email",
    });

    await service.requestPasswordReset({
      email: " User@Example.com ",
      logger: pino({ level: "silent" }),
    });

    expect(repository.issuePasswordResetToken).toHaveBeenCalledTimes(1);
    expect(emailService.sendPasswordReset).toHaveBeenCalledTimes(1);

    const [repositoryCall] = repository.issuePasswordResetToken.mock.calls;
    const [emailCall] = emailService.sendPasswordReset.mock.calls;
    const resetUrl = new URL(emailCall?.[0].resetUrl);
    const token = resetUrl.searchParams.get("token");

    expect(repositoryCall?.[0].emailNormalized).toBe("user@example.com");
    expect(emailCall?.[0]).toMatchObject({
      to: "user@example.com",
      expiresAt: new Date("2026-05-01T00:00:00.000Z"),
    });
    expect(resetUrl.origin).toBe("https://app.example.com");
    expect(resetUrl.pathname).toBe("/reset-password");
    expect(resetUrl.searchParams.get("source")).toBe("email");
    expect(token).toEqual(expect.any(String));
    expect(token?.length).toBeGreaterThan(0);
    expect(hashPasswordResetToken(token!)).toBe(repositoryCall?.[0].tokenHash);
  });

  it("does not send email for no-op request cases", async () => {
    const repository = {
      issuePasswordResetToken: vi.fn().mockResolvedValue({
        kind: "noop",
        reason: "user_not_found_or_missing_password_row",
      }),
    };
    const emailService = {
      send: vi.fn(),
      sendPasswordReset: vi.fn(),
    };
    const service = createPasswordResetRequestService({
      repository,
      emailService,
      passwordResetUrlBase: "https://app.example.com/reset-password",
    });

    await service.requestPasswordReset({
      email: "missing@example.com",
      logger: pino({ level: "silent" }),
    });

    expect(emailService.sendPasswordReset).not.toHaveBeenCalled();
  });

  it("swallows email delivery failures after token issuance", async () => {
    const repository = {
      issuePasswordResetToken: vi.fn().mockResolvedValue({
        kind: "issued",
        userId: "user-1",
        email: "user@example.com",
        expiresAt: new Date("2026-05-01T00:00:00.000Z"),
      }),
    };
    const emailService = {
      send: vi.fn(),
      sendPasswordReset: vi
        .fn()
        .mockRejectedValue(new Error("smtp unavailable")),
    };
    const service = createPasswordResetRequestService({
      repository,
      emailService,
      passwordResetUrlBase: "https://app.example.com/reset-password",
    });

    await expect(
      service.requestPasswordReset({
        email: "user@example.com",
        logger: pino({ level: "silent" }),
      }),
    ).resolves.toBeUndefined();

    expect(emailService.sendPasswordReset).toHaveBeenCalledTimes(1);
  });
});
