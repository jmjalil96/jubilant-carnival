import type { Logger } from "pino";

import type { EmailService } from "../../../../infra/email/index.js";
import type { PasswordResetRequestRepository } from "./repository.js";
import { issuePasswordResetToken } from "../token.js";

type PasswordResetRequestServiceDependencies = {
  repository: PasswordResetRequestRepository;
  emailService: EmailService;
  passwordResetUrlBase: string;
};

type PasswordResetRequestInput = {
  email: string;
  logger: Logger;
};

export type PasswordResetRequestService = ReturnType<
  typeof createPasswordResetRequestService
>;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function buildPasswordResetUrl(baseUrl: string, token: string): string {
  const url = new URL(baseUrl);

  url.searchParams.set("token", token);

  return url.toString();
}

export function createPasswordResetRequestService({
  repository,
  emailService,
  passwordResetUrlBase,
}: PasswordResetRequestServiceDependencies) {
  return {
    async requestPasswordReset({
      email,
      logger,
    }: PasswordResetRequestInput): Promise<void> {
      const now = new Date();
      const emailNormalized = normalizeEmail(email);
      const resetToken = issuePasswordResetToken(now);
      const result = await repository.issuePasswordResetToken({
        emailNormalized,
        tokenId: resetToken.tokenId,
        tokenHash: resetToken.tokenHash,
        expiresAt: resetToken.expiresAt,
        now,
      });

      if (result.kind === "noop") {
        logger.info(
          {
            emailNormalized,
            reason: result.reason,
          },
          "Password reset request no-op",
        );
        return;
      }

      const resetUrl = buildPasswordResetUrl(
        passwordResetUrlBase,
        resetToken.token,
      );

      try {
        await emailService.sendPasswordReset({
          to: result.email,
          resetUrl,
          expiresAt: result.expiresAt,
        });
      } catch (error) {
        logger.error(
          {
            err: error,
            emailNormalized,
            userId: result.userId,
            reason: "password_reset_email_send_failed",
          },
          "Password reset email send failed",
        );
        return;
      }

      logger.info(
        {
          emailNormalized,
          userId: result.userId,
        },
        "Password reset token issued",
      );
    },
  };
}
